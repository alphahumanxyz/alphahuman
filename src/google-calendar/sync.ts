import './state';
import type {
  CalendarApiFetchResponse,
  CalendarEvent,
  CalendarListEntry,
  LocalCalendarRecord,
} from './types';

/** Minimal db shape used by sync (avoids Record<string, any>). */
interface SyncDbHelpers {
  getCalendarListSyncToken?: () => string | null;
  setCalendarListSyncToken?: (token: string) => void;
  upsertCalendars?: (calendars: CalendarListEntry[]) => void;
  getEventsSyncToken?: (calendarId: string) => string | null;
  setEventsSyncToken?: (calendarId: string, token: string) => void;
  clearEventsSyncToken?: (calendarId: string) => void;
  bulkUpsertEvents?: (calendarId: string, events: CalendarEvent[]) => void;
  markCalendarSynced?: (
    calendarId: string,
    opts: { lastFullSync?: number; nextSyncToken?: string | null }
  ) => void;
  deleteEventsBefore?: (calendarId: string, cutoffTs: number) => void;
  listCalendarsNeedingSync?: (limit: number, staleBeforeMs: number) => LocalCalendarRecord[];
}

const MAX_CALENDARS_PER_RUN = 10;
const CALENDAR_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
const EVENTS_WINDOW_DAYS = 30;
const MAX_EVENTS_RESULTS = 250;
const MAX_EVENT_PAGES = 5;

function daysAgoIso(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

type CalendarFetchFn = (endpoint: string, options?: object) => Promise<CalendarApiFetchResponse>;

function getCalendarFetch(): CalendarFetchFn | null {
  return (globalThis as { calendarFetch?: CalendarFetchFn }).calendarFetch ?? null;
}

function buildQuery(params: Record<string, string | undefined | null>): string {
  return Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join('&');
}

async function syncCalendarList(forceFull: boolean): Promise<void> {
  const calendarFetch = getCalendarFetch();
  const db = (globalThis as { googleCalendarDb?: SyncDbHelpers }).googleCalendarDb;
  if (!calendarFetch || !db) return;

  let syncToken: string | null = forceFull ? null : (db.getCalendarListSyncToken?.() ?? null);
  let nextPageToken: string | undefined;
  let retrying = false;

  do {
    const qs = buildQuery({
      minAccessRole: 'reader',
      maxResults: '250',
      pageToken: nextPageToken,
      syncToken,
    });
    const path = `/calendar/v3/users/me/calendarList${qs ? `?${qs}` : ''}`;
    const response = await calendarFetch(path);
    if (!response.success) {
      const code = response.error?.code;
      if ((code === 400 || code === 410) && !retrying) {
        db.setCalendarListSyncToken?.('');
        syncToken = null;
        nextPageToken = undefined;
        retrying = true;
        continue;
      }
      console.warn('[google-calendar] calendarList sync failed:', response.error?.message || code);
      return;
    }
    const data = response.data as {
      items?: CalendarListEntry[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (Array.isArray(data.items) && data.items.length > 0) {
      db.upsertCalendars?.(data.items);
    }
    if (data.nextSyncToken) {
      db.setCalendarListSyncToken?.(data.nextSyncToken);
    }
    nextPageToken = data.nextPageToken || undefined;
  } while (nextPageToken);
}

async function syncEventsForCalendar(calendarId: string, forceFull: boolean): Promise<void> {
  const calendarFetch = getCalendarFetch();
  const db = (globalThis as { googleCalendarDb?: SyncDbHelpers }).googleCalendarDb;
  if (!calendarFetch || !db) return;

  let syncToken = !forceFull ? (db.getEventsSyncToken?.(calendarId) ?? null) : null;
  let nextPageToken: string | undefined;
  let pages = 0;
  const baseQuery: Record<string, string> = {
    singleEvents: 'true',
    maxResults: String(MAX_EVENTS_RESULTS),
    orderBy: 'startTime',
  };
  if (!syncToken) {
    baseQuery.timeMin = daysAgoIso(EVENTS_WINDOW_DAYS);
  }

  let retrying = false;

  do {
    const qs = buildQuery({ ...baseQuery, syncToken, pageToken: nextPageToken });
    const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${qs}`;
    const response = await calendarFetch(path);
    if (!response.success) {
      const code = response.error?.code;
      if ((code === 400 || code === 410) && !retrying) {
        db.clearEventsSyncToken?.(calendarId);
        syncToken = null;
        nextPageToken = undefined;
        retrying = true;
        continue;
      }
      if (code === 404) {
        console.warn(
          '[google-calendar] events sync skipped for',
          calendarId,
          '— API returned 404 (likely read-only/holiday calendar)'
        );
        return;
      }
      console.warn(
        '[google-calendar] events sync failed for',
        calendarId,
        response.error?.message || code
      );
      return;
    }
    const data = response.data as {
      items?: CalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (Array.isArray(data.items) && data.items.length > 0) {
      db.bulkUpsertEvents?.(calendarId, data.items);
    }
    if (data.nextSyncToken) {
      db.setEventsSyncToken?.(calendarId, data.nextSyncToken);
    }
    nextPageToken = data.nextPageToken || undefined;
    pages += 1;
  } while (nextPageToken && pages < MAX_EVENT_PAGES);

  if (pages >= MAX_EVENT_PAGES && nextPageToken) {
    console.warn(
      '[google-calendar] Events sync truncated for',
      calendarId,
      '— hit MAX_EVENT_PAGES; not marking fully synced or pruning'
    );
    return;
  }
  db.markCalendarSynced?.(calendarId, {
    lastFullSync: Date.now(),
    nextSyncToken: db.getEventsSyncToken?.(calendarId) ?? null,
  });
  const pruneBefore = Date.now() - EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  db.deleteEventsBefore?.(calendarId, pruneBefore);
}

function publishState(): void {
  (globalThis as { publishGoogleCalendarState?: () => void }).publishGoogleCalendarState?.();
}

async function performSync(options?: { forceFull?: boolean; calendars?: string[] }): Promise<void> {
  if (!oauth.getCredential()) return;
  const s = globalThis.getGoogleCalendarSkillState();
  if (s.syncInProgress) {
    return;
  }
  s.syncInProgress = true;
  publishState();
  try {
    await syncCalendarList(Boolean(options?.forceFull));
    const db = (globalThis as { googleCalendarDb?: SyncDbHelpers }).googleCalendarDb;
    if (!db) return;
    let calendars: string[];
    if (options?.calendars?.length) {
      calendars = options.calendars;
    } else {
      const staleBefore = Date.now() - CALENDAR_STALE_MS;
      calendars =
        db
          .listCalendarsNeedingSync?.(MAX_CALENDARS_PER_RUN, staleBefore)
          ?.map((c: LocalCalendarRecord) => c.id) ?? [];
    }
    for (const calendarId of calendars) {
      await syncEventsForCalendar(calendarId, Boolean(options?.forceFull));
    }
    s.lastSyncTime = Date.now();
    s.lastSyncedCalendars = calendars.length;
  } catch (err) {
    console.error('[google-calendar] Sync run failed:', err);
  } finally {
    s.syncInProgress = false;
    publishState();
  }
}

declare global {
  var googleCalendarSync: { performSync: typeof performSync };
}

globalThis.googleCalendarSync = { performSync };
