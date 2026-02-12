// Tool: google-calendar-list-calendars
import '../state';
import type { CalendarApiFetchResponse, CalendarListEntry, LocalCalendarRecord } from '../types';

type CalendarFetchFn = (endpoint: string, options?: object) => Promise<CalendarApiFetchResponse>;

const CALENDAR_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

type CalendarDbHelpers = {
  getCalendars: (opts?: { includeHidden?: boolean }) => LocalCalendarRecord[];
  upsertCalendars: (items: CalendarListEntry[]) => void;
  getCalendarSyncState?: (calendarId: string) => { lastFullSync: number | null } | undefined;
};

export const listCalendarsTool: ToolDefinition = {
  name: 'google-calendar-list-calendars',
  description:
    'List all Google Calendars the user has access to. Returns id, summary, timeZone, primary, and accessRole.',
  input_schema: {
    type: 'object',
    properties: {
      show_hidden: { type: 'boolean', description: 'Include hidden calendars (default: false)' },
    },
    required: [],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const calendarFetch = (globalThis as { calendarFetch?: CalendarFetchFn }).calendarFetch;
      const calendarDb = (globalThis as { googleCalendarDb?: CalendarDbHelpers }).googleCalendarDb;
      const calendarSync = (
        globalThis as {
          googleCalendarSync?: {
            performSync: (options?: Record<string, unknown>) => Promise<void>;
          };
        }
      ).googleCalendarSync;
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Google Calendar not connected. Complete OAuth setup first.',
        });
      }
      const showHidden = Boolean(args.show_hidden);
      if (!calendarDb || !calendarSync?.performSync) {
        if (!calendarFetch) {
          return JSON.stringify({ success: false, error: 'Calendar API helper not available' });
        }
        const qs = showHidden ? '?showHidden=true' : '';
        const response = await calendarFetch(`/calendar/v3/users/me/calendarList${qs}`);
        if (!response.success) {
          return JSON.stringify({
            success: false,
            error: response.error?.message || 'Failed to list calendars',
          });
        }
        const data = response.data as { items?: Array<Record<string, unknown>> };
        const items = Array.isArray(data.items) ? data.items : [];
        calendarDb?.upsertCalendars?.(items as unknown as CalendarListEntry[]);
        return JSON.stringify({
          success: true,
          calendars: items.map(c => ({
            id: c.id,
            summary: c.summary,
            description: c.description,
            timeZone: c.timeZone,
            primary: c.primary,
            accessRole: c.accessRole,
          })),
        });
      }
      let cached = calendarDb.getCalendars({ includeHidden: showHidden });
      const staleBefore = Date.now() - CALENDAR_STALE_MS;
      const needsSync =
        cached.length === 0 ||
        cached.some(cal => {
          const meta = calendarDb.getCalendarSyncState?.(cal.id);
          return !meta?.lastFullSync || meta.lastFullSync < staleBefore;
        });
      if (needsSync && calendarSync?.performSync) {
        await calendarSync.performSync({ forceFull: cached.length === 0 });
        cached = calendarDb.getCalendars({ includeHidden: showHidden });
      }
      const calendars = cached.map((c: LocalCalendarRecord) => ({
        id: c.id,
        summary: c.summary,
        description: c.description,
        timeZone: c.time_zone,
        primary: Boolean(c.primary_flag),
        accessRole: c.access_role,
      }));
      return JSON.stringify({ success: true, calendars, from_cache: true });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
