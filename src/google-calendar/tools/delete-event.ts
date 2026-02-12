// Tool: google-calendar-delete-event
import '../state';
import type { CalendarApiFetchResponse } from '../types';

type CalendarDbHelpers = { deleteEvent?: (calendarId: string, eventId: string) => void };

type CalendarFetchFn = (endpoint: string, options?: object) => Promise<CalendarApiFetchResponse>;

export const deleteEventTool: ToolDefinition = {
  name: 'google-calendar-delete-event',
  description: 'Delete an event from a Google Calendar.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar)',
      },
      event_id: { type: 'string', description: 'Event ID to delete' },
    },
    required: ['calendar_id', 'event_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const calendarFetch = (globalThis as { calendarFetch?: CalendarFetchFn }).calendarFetch;
      const calendarDb = (globalThis as { googleCalendarDb?: CalendarDbHelpers }).googleCalendarDb;
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
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const response = await calendarFetch(path, { method: 'DELETE' });
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to delete event',
        });
      }
      calendarDb?.deleteEvent?.(calendarId, eventId);
      return JSON.stringify({ success: true, deleted: true });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
