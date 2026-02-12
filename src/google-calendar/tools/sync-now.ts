// Tool: google-calendar-sync-now — trigger an immediate sync run
import '../state';

export const syncNowTool: ToolDefinition = {
  name: 'google-calendar-sync-now',
  description: 'Trigger an immediate Google Calendar sync to refresh cached calendars and events.',
  input_schema: {
    type: 'object',
    properties: {
      force_full: {
        type: 'boolean',
        description: 'Force a full resync (ignores incremental sync tokens).',
        default: false,
      },
      calendar_id: {
        type: 'string',
        description: 'Optional calendar ID to sync. Defaults to all calendars needing updates.',
      },
    },
    required: [],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const sync = (
      globalThis as {
        googleCalendarSync?: { performSync: (options?: Record<string, unknown>) => Promise<void> };
      }
    ).googleCalendarSync;
    if (!oauth.getCredential()) {
      return JSON.stringify({ success: false, error: 'Google Calendar not connected.' });
    }
    if (!sync?.performSync) {
      return JSON.stringify({ success: false, error: 'Sync engine unavailable' });
    }
    try {
      await sync.performSync({
        forceFull: Boolean(args.force_full),
        calendars: args.calendar_id ? [String(args.calendar_id)] : undefined,
      });
      return JSON.stringify({ success: true });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
