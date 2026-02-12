// Tool: google-calendar-get-event
import '../state';
import type { CalendarApiFetchResponse, CalendarEvent } from '../types';

type CalendarFetchFn = (endpoint: string, options?: object) => Promise<CalendarApiFetchResponse>;

type CalendarDbHelpers = {
  getEventById?: (
    calendarId: string,
    eventId: string
  ) => {
    id: string;
    summary: string | null;
    description: string | null;
    location: string | null;
    status: string | null;
    start_json: string;
    end_json: string;
    attendees_json: string | null;
    html_link: string | null;
  } | null;
  bulkUpsertEvents?: (calendarId: string, events: CalendarEvent[]) => void;
};

export const getEventTool: ToolDefinition = {
  name: 'google-calendar-get-event',
  description: 'Get a single event by calendar ID and event ID.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar)',
      },
      event_id: { type: 'string', description: 'Event ID' },
    },
    required: ['calendar_id', 'event_id'],
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
      if (!calendarFetch) {
        return JSON.stringify({ success: false, error: 'Calendar API helper not available' });
      }
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Google Calendar not connected. Complete OAuth setup first.',
        });
      }
      const calendarId = args.calendar_id as string;
      const eventId = args.event_id as string;
      if (!calendarId || !eventId) {
        return JSON.stringify({ success: false, error: 'calendar_id and event_id are required' });
      }
      if (calendarDb) {
        let cached = calendarDb.getEventById?.(calendarId, eventId);
        if (!cached && calendarSync?.performSync) {
          await calendarSync.performSync({ calendars: [calendarId], forceFull: false });
          cached = calendarDb.getEventById?.(calendarId, eventId);
        }
        if (cached) {
          return JSON.stringify({
            success: true,
            event: {
              id: cached.id,
              summary: cached.summary ?? undefined,
              description: cached.description ?? undefined,
              location: cached.location ?? undefined,
              status: cached.status ?? undefined,
              start: JSON.parse(cached.start_json),
              end: JSON.parse(cached.end_json),
              attendees: cached.attendees_json ? JSON.parse(cached.attendees_json) : undefined,
              htmlLink: cached.html_link ?? undefined,
            },
            from_cache: true,
          });
        }
      }
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const response = await calendarFetch(path);
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to get event',
        });
      }
      calendarDb?.bulkUpsertEvents?.(calendarId, [response.data as CalendarEvent]);
      return JSON.stringify({ success: true, event: response.data });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
