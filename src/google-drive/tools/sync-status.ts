// Tool: google-drive-sync-status
// Returns current sync status and statistics
import { getGoogleDriveSkillState } from '../state';

export const syncStatusTool: ToolDefinition = {
  name: 'google-drive-sync-status',
  description:
    'Get the current Google Drive sync status including last sync time, ' +
    'total synced files, sync progress, and any errors.',
  input_schema: { type: 'object', properties: {} },
  execute(): Promise<string> {
    try {
      const s = getGoogleDriveSkillState();

      return Promise.resolve(
        JSON.stringify({
          success: true,
          connected: !!oauth.getCredential(),
          user_email: s.config.userEmail || null,
          sync_in_progress: s.syncStatus.syncInProgress,
          last_sync_time: s.syncStatus.lastSyncTime
            ? new Date(s.syncStatus.lastSyncTime).toISOString()
            : null,
          next_sync_time: s.syncStatus.nextSyncTime
            ? new Date(s.syncStatus.nextSyncTime).toISOString()
            : null,
          last_sync_duration_ms: s.syncStatus.lastSyncDurationMs,
          last_sync_error: s.syncStatus.lastSyncError,
          totals: {
            files: s.syncStatus.totalFiles,
            spreadsheets: s.syncStatus.totalSpreadsheets,
            documents: s.syncStatus.totalDocuments,
          },
          config: { sync_interval_minutes: s.config.syncIntervalMinutes },
        })
      );
    } catch (e) {
      return Promise.resolve(
        JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) })
      );
    }
  },
};
