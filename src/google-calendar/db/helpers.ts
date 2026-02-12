import '../state';
import type {
  CalendarEvent,
  CalendarListEntry,
  CalendarSyncState,
  LocalCalendarRecord,
  LocalEventRecord,
} from '../types';

const CALENDAR_LIST_SYNC_KEY = 'calendarListSyncToken';
const EVENTS_SYNC_PREFIX = 'eventsSyncToken:';
const LAST_REQUEST_PREFIX = 'lastRequestedRange:';

function toBooleanFlag(value: unknown): number {
  return value ? 1 : 0;
}

function normalizeDateTime(dt: CalendarEvent['start']): { iso: string; ts: number; json: string } {
  const dateValue = dt.dateTime || dt.date || '';
  const iso = dateValue;
  // Date.parse handles both RFC3339 and YYYY-MM-DD, though all-day dates parse as UTC midnight.
  const ts = Number.isFinite(Date.parse(dateValue)) ? Date.parse(dateValue) : Date.now();
  return { iso, ts, json: JSON.stringify(dt) };
}

export function upsertCalendars(calendars: CalendarListEntry[]): void {
  db.exec('BEGIN', []);
  try {
    for (const calendar of calendars) {
      db.exec(
        `INSERT INTO calendars (
          id, summary, description, time_zone, primary_flag, access_role,
          background_color, foreground_color, hidden, selected, writable,
          color_id, etag, conference_properties_json, updated, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          summary = excluded.summary,
          description = excluded.description,
          time_zone = excluded.time_zone,
          primary_flag = excluded.primary_flag,
          access_role = excluded.access_role,
          background_color = excluded.background_color,
          foreground_color = excluded.foreground_color,
          hidden = excluded.hidden,
          selected = excluded.selected,
          writable = excluded.writable,
          color_id = excluded.color_id,
          etag = excluded.etag,
          conference_properties_json = excluded.conference_properties_json,
          updated = excluded.updated,
          raw_json = excluded.raw_json`,
        [
          calendar.id,
          calendar.summary || calendar.id,
          calendar.description || null,
          calendar.timeZone || null,
          toBooleanFlag(calendar.primary),
          calendar.accessRole || 'reader',
          calendar.backgroundColor || null,
          calendar.foregroundColor || null,
          toBooleanFlag(calendar.hidden),
          toBooleanFlag(calendar.selected),
          toBooleanFlag(calendar.writable),
          calendar.colorId || null,
          calendar.etag || null,
          calendar.conferenceProperties ? JSON.stringify(calendar.conferenceProperties) : null,
          calendar.updated || null,
          JSON.stringify(calendar),
        ]
      );
    }
    db.exec('COMMIT', []);
  } catch (err) {
    db.exec('ROLLBACK', []);
    throw err;
  }
}

export function getCalendars(options: { includeHidden?: boolean } = {}): LocalCalendarRecord[] {
  const where = options.includeHidden ? '1=1' : 'hidden = 0';
  return db.all(
    `SELECT * FROM calendars WHERE ${where} ORDER BY primary_flag DESC, summary ASC`,
    []
  ) as unknown as LocalCalendarRecord[];
}

export function bulkUpsertEvents(calendarId: string, events: CalendarEvent[]): void {
  const now = Date.now();
  db.exec('BEGIN', []);
  try {
    for (const event of events) {
      const start = normalizeDateTime(event.start);
      const end = normalizeDateTime(event.end);
      db.exec(
        `INSERT INTO events (
          calendar_id, id, summary, description, location, status, html_link,
          start_time, end_time, start_ts, end_ts, start_json, end_json,
          attendees_json, created, updated,
          recurring_event_id, recurrence_json, sequence, raw_json, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(calendar_id, id) DO UPDATE SET
          calendar_id = excluded.calendar_id,
          summary = excluded.summary,
          description = excluded.description,
          location = excluded.location,
          status = excluded.status,
          html_link = excluded.html_link,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          start_ts = excluded.start_ts,
          end_ts = excluded.end_ts,
          start_json = excluded.start_json,
          end_json = excluded.end_json,
          attendees_json = COALESCE(excluded.attendees_json, events.attendees_json),
          created = COALESCE(excluded.created, events.created),
          updated = COALESCE(excluded.updated, events.updated),
          recurring_event_id = excluded.recurring_event_id,
          recurrence_json = COALESCE(excluded.recurrence_json, events.recurrence_json),
          sequence = COALESCE(excluded.sequence, events.sequence),
          raw_json = excluded.raw_json,
          synced_at = excluded.synced_at
        WHERE events.updated IS NULL OR excluded.updated IS NULL OR excluded.updated >= events.updated`,
        [
          calendarId,
          event.id,
          event.summary || null,
          event.description || null,
          event.location || null,
          event.status || null,
          event.htmlLink || null,
          start.iso,
          end.iso,
          start.ts,
          end.ts,
          start.json,
          end.json,
          event.attendees ? JSON.stringify(event.attendees) : null,
          event.created || null,
          event.updated || null,
          event.recurringEventId || null,
          event.recurrence ? JSON.stringify(event.recurrence) : null,
          typeof event.sequence === 'number' ? event.sequence : null,
          JSON.stringify(event),
          now,
        ]
      );
    }
    db.exec('COMMIT', []);
  } catch (err) {
    db.exec('ROLLBACK', []);
    throw err;
  }
}

function toTimestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getEventsForCalendar(options: {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  limit?: number;
}): LocalEventRecord[] {
  const params: unknown[] = [options.calendarId];
  let sql = 'SELECT * FROM events WHERE calendar_id = ?';
  const minTs = toTimestamp(options.timeMin);
  if (minTs != null) {
    sql += ' AND end_ts >= ?';
    params.push(minTs);
  }
  const maxTs = toTimestamp(options.timeMax);
  if (maxTs != null) {
    sql += ' AND start_ts <= ?';
    params.push(maxTs);
  }
  sql += ' ORDER BY start_ts ASC';
  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  return db.all(sql, params) as unknown as LocalEventRecord[];
}

export function listCalendarsNeedingSync(
  limit: number,
  staleBeforeMs: number
): LocalCalendarRecord[] {
  const calendars = getCalendars({ includeHidden: true });
  const ranked = calendars
    .map(cal => {
      const meta = getCalendarSyncMeta(cal.id);
      return { cal, lastFullSync: meta.lastFullSync ?? 0 };
    })
    .filter(item => item.lastFullSync < staleBeforeMs)
    .sort((a, b) => (a.lastFullSync || 0) - (b.lastFullSync || 0))
    .slice(0, limit)
    .map(item => item.cal);
  return ranked;
}

function getCalendarMetaKey(calendarId: string): string {
  return `calendarMeta:${calendarId}`;
}

export function getCalendarSyncMeta(calendarId: string): {
  lastFullSync?: number;
  nextSyncToken?: string;
} {
  const raw = getSyncState(getCalendarMetaKey(calendarId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { lastFullSync?: number; nextSyncToken?: string };
  } catch {
    return {};
  }
}

export function markCalendarSynced(
  calendarId: string,
  options: { lastFullSync?: number; nextSyncToken?: string }
): void {
  const prev = getCalendarSyncMeta(calendarId);
  const next = { ...prev, ...options };
  setSyncState(getCalendarMetaKey(calendarId), JSON.stringify(next));
}

export function deleteEventsBefore(calendarId: string, cutoffTs: number): void {
  db.exec('DELETE FROM events WHERE calendar_id = ? AND end_ts < ?', [calendarId, cutoffTs]);
}

export function deleteEvent(calendarId: string, eventId: string): void {
  db.exec('DELETE FROM events WHERE calendar_id = ? AND id = ?', [calendarId, eventId]);
}

export function getEventById(calendarId: string, eventId: string): LocalEventRecord | null {
  return db.get('SELECT * FROM events WHERE calendar_id = ? AND id = ?', [
    calendarId,
    eventId,
  ]) as LocalEventRecord | null;
}

export function getEventsCoverage(
  calendarId: string,
  startTs: number,
  endTs: number
): { hasEvents: boolean; earliestStart: number | null; latestEnd: number | null } {
  const row = db.get(
    `SELECT
        COUNT(*) AS count,
        MIN(start_ts) AS minStart,
        MAX(end_ts) AS maxEnd
     FROM events
     WHERE calendar_id = ?
       AND end_ts >= ?
       AND start_ts <= ?`,
    [calendarId, startTs, endTs]
  ) as { count: number; minStart: number | null; maxEnd: number | null } | null;
  if (!row) {
    return { hasEvents: false, earliestStart: null, latestEnd: null };
  }
  return { hasEvents: row.count > 0, earliestStart: row.minStart, latestEnd: row.maxEnd };
}

export function getSyncState(key: string): string | null {
  const row = db.get('SELECT value FROM sync_state WHERE key = ?', [key]) as {
    value: string;
  } | null;
  return row ? row.value : null;
}

export function setSyncState(key: string, value: string): void {
  db.exec(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export function clearSyncState(key: string): void {
  db.exec('DELETE FROM sync_state WHERE key = ?', [key]);
}

export function getCalendarListSyncToken(): string | null {
  return getSyncState(CALENDAR_LIST_SYNC_KEY);
}

export function setCalendarListSyncToken(token: string): void {
  setSyncState(CALENDAR_LIST_SYNC_KEY, token);
}

export function getEventsSyncToken(calendarId: string): string | null {
  return getSyncState(`${EVENTS_SYNC_PREFIX}${calendarId}`);
}

export function setEventsSyncToken(calendarId: string, token: string): void {
  setSyncState(`${EVENTS_SYNC_PREFIX}${calendarId}`, token);
}

export function clearEventsSyncToken(calendarId: string): void {
  clearSyncState(`${EVENTS_SYNC_PREFIX}${calendarId}`);
}

export function recordRequestedRange(calendarId: string, startTs: number, endTs: number): void {
  setSyncState(
    `${LAST_REQUEST_PREFIX}${calendarId}`,
    JSON.stringify({ startTs, endTs, at: Date.now() })
  );
}

export function getCalendarSyncState(calendarId: string): CalendarSyncState {
  const meta = getCalendarSyncMeta(calendarId);
  const lastRangeRaw = getSyncState(`${LAST_REQUEST_PREFIX}${calendarId}`);
  let lastRequestedStart: number | null = null;
  let lastRequestedEnd: number | null = null;
  if (lastRangeRaw) {
    try {
      const parsed = JSON.parse(lastRangeRaw) as { startTs?: number; endTs?: number };
      lastRequestedStart = parsed.startTs ?? null;
      lastRequestedEnd = parsed.endTs ?? null;
    } catch {
      lastRequestedStart = null;
      lastRequestedEnd = null;
    }
  }
  return {
    calendarId,
    eventsSyncToken: getEventsSyncToken(calendarId),
    lastFullSync: meta.lastFullSync ?? null,
    lastRequestedStart,
    lastRequestedEnd,
  };
}

declare global {
  var googleCalendarDb: {
    upsertCalendars: typeof upsertCalendars;
    getCalendars: typeof getCalendars;
    bulkUpsertEvents: typeof bulkUpsertEvents;
    getEventsForCalendar: typeof getEventsForCalendar;
    listCalendarsNeedingSync: typeof listCalendarsNeedingSync;
    markCalendarSynced: typeof markCalendarSynced;
    deleteEventsBefore: typeof deleteEventsBefore;
    deleteEvent: typeof deleteEvent;
    getEventsCoverage: typeof getEventsCoverage;
    getEventById: typeof getEventById;
    getCalendarListSyncToken: typeof getCalendarListSyncToken;
    setCalendarListSyncToken: typeof setCalendarListSyncToken;
    getEventsSyncToken: typeof getEventsSyncToken;
    setEventsSyncToken: typeof setEventsSyncToken;
    clearEventsSyncToken: typeof clearEventsSyncToken;
    getCalendarSyncState: typeof getCalendarSyncState;
    recordRequestedRange: typeof recordRequestedRange;
    getCalendarSyncMeta: typeof getCalendarSyncMeta;
  };
}

globalThis.googleCalendarDb = {
  upsertCalendars,
  getCalendars,
  bulkUpsertEvents,
  getEventsForCalendar,
  listCalendarsNeedingSync,
  markCalendarSynced,
  deleteEventsBefore,
  deleteEvent,
  getEventsCoverage,
  getEventById,
  getCalendarListSyncToken,
  setCalendarListSyncToken,
  getEventsSyncToken,
  setEventsSyncToken,
  clearEventsSyncToken,
  getCalendarSyncState,
  recordRequestedRange,
  getCalendarSyncMeta,
};
