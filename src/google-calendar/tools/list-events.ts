// Tool: google-calendar-list-events
import '../state';
import type { CalendarApiFetchResponse, LocalEventRecord } from '../types';

type CalendarFetchFn = (endpoint: string, options?: object) => Promise<CalendarApiFetchResponse>;

const DEFAULT_WINDOW_DAYS = 7;

type CalendarDbHelpers = {
  getEventsForCalendar: (options: {
    calendarId: string;
    timeMin?: string;
    timeMax?: string;
    limit?: number;
  }) => LocalEventRecord[];
  getEventsCoverage?: (
    calendarId: string,
    startTs: number,
    endTs: number
  ) => { hasEvents: boolean; earliestStart: number | null; latestEnd: number | null };
  recordRequestedRange?: (calendarId: string, startTs: number, endTs: number) => void;
};

export const listEventsTool: ToolDefinition = {
  name: 'google-calendar-list-events',
  description:
    'List events in a Google Calendar. Optional time range and max results. Use calendar_id "primary" for primary calendar.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar). Default: primary',
      },
      time_min: { type: 'string', description: 'Lower bound (RFC3339 or date) for event start' },
      time_max: { type: 'string', description: 'Upper bound (RFC3339 or date) for event end' },
      max_results: {
        type: 'number',
        description: 'Max number of events (default: 50)',
        minimum: 1,
        maximum: 2500,
      },
      single_events: {
        type: 'boolean',
        description: 'Expand recurring events into instances (default: true)',
      },
      order_by: {
        type: 'string',
        description: 'Order by startTime or lastModified (default: startTime)',
        enum: ['startTime', 'lastModified'],
      },
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
      if (!calendarDb || !calendarSync?.performSync) {
        if (!calendarFetch) {
          return JSON.stringify({ success: false, error: 'Calendar API helper not available' });
        }
        const calendarId = (args.calendar_id as string) || 'primary';
        const params: string[] = [];
        if (args.time_min) params.push(`timeMin=${encodeURIComponent(args.time_min as string)}`);
        if (args.time_max) params.push(`timeMax=${encodeURIComponent(args.time_max as string)}`);
        const maxResults = Math.min(Number(args.max_results) || 50, 2500);
        params.push(`maxResults=${maxResults}`);
        if (args.single_events === true) params.push('singleEvents=true');
        else if (args.single_events === false) params.push('singleEvents=false');
        const orderBy = (args.order_by as string) || 'startTime';
        params.push(`orderBy=${orderBy}`);
        const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.join('&')}`;
        const response = await calendarFetch(path);
        if (!response.success) {
          return JSON.stringify({
            success: false,
            error: response.error?.message || 'Failed to list events',
          });
        }
        const data = response.data as { items?: Record<string, unknown>[]; nextPageToken?: string };
        return JSON.stringify({
          success: true,
          events: (data.items || []).map(ev => ({
            id: ev.id,
            summary: ev.summary,
            description: ev.description,
            location: ev.location,
            start: ev.start,
            end: ev.end,
            status: ev.status,
            htmlLink: ev.htmlLink,
            attendees: ev.attendees,
          })),
          next_page_token: data.nextPageToken || null,
        });
      }
      const calendarId = (args.calendar_id as string) || 'primary';
      const timeMinIso =
        (args.time_min as string) ||
        new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const timeMaxIso =
        (args.time_max as string) ||
        new Date(Date.parse(timeMinIso) + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const startTs = Date.parse(timeMinIso);
      const endTs = Date.parse(timeMaxIso);
      const maxResults = Math.min(Number(args.max_results) || 50, 2500);

      calendarDb.recordRequestedRange?.(calendarId, startTs, endTs);

      let coverage = calendarDb.getEventsCoverage?.(calendarId, startTs, endTs);
      const needsCoverage =
        !coverage ||
        !coverage.hasEvents ||
        coverage.earliestStart == null ||
        coverage.latestEnd == null ||
        coverage.earliestStart > startTs ||
        coverage.latestEnd < endTs;
      if (needsCoverage && calendarSync?.performSync) {
        await calendarSync.performSync({
          calendars: [calendarId],
          forceFull: !coverage?.hasEvents,
        });
        coverage = calendarDb.getEventsCoverage?.(calendarId, startTs, endTs);
      }

      const rows = calendarDb.getEventsForCalendar({
        calendarId,
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
        limit: maxResults,
      });
      const events = rows.map(ev => ({
        id: ev.id,
        summary: ev.summary ?? undefined,
        description: ev.description ?? undefined,
        location: ev.location ?? undefined,
        start: JSON.parse(ev.start_json),
        end: JSON.parse(ev.end_json),
        status: ev.status ?? undefined,
        htmlLink: ev.html_link ?? undefined,
        attendees: ev.attendees_json ? JSON.parse(ev.attendees_json) : undefined,
      }));
      return JSON.stringify({ success: true, events, from_cache: true });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
