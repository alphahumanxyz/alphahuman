// Database schema initialization for Google Drive skill
// Creates SQLite tables for files, spreadsheets, sheet values, documents, and sync state
import '../state';

/**
 * Initialize Google Drive database schema
 */
export function initializeGoogleDriveSchema(): void {
  console.log('[google-drive] Initializing database schema...');

  db.exec(
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size TEXT,
      modified_time TEXT,
      web_view_link TEXT,
      parents_json TEXT,
      synced_at INTEGER NOT NULL
    )`,
    []
  );

  db.exec(
    `CREATE TABLE IF NOT EXISTS spreadsheets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sheets_json TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )`,
    []
  );

  db.exec(
    `CREATE TABLE IF NOT EXISTS sheet_values (
      spreadsheet_id TEXT NOT NULL,
      range_a1 TEXT NOT NULL,
      values_json TEXT NOT NULL,
      synced_at INTEGER NOT NULL,
      PRIMARY KEY (spreadsheet_id, range_a1),
      FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id)
    )`,
    []
  );

  db.exec(
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_text TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )`,
    []
  );

  db.exec(
    `CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    []
  );

  db.exec('CREATE INDEX IF NOT EXISTS idx_files_modified_time ON files(modified_time DESC)', []);
  db.exec('CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type)', []);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_sheet_values_spreadsheet ON sheet_values(spreadsheet_id)',
    []
  );

  console.log('[google-drive] Database schema initialized successfully');
}
