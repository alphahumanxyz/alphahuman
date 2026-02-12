// Database helper functions for Google Drive skill
// CRUD operations for files and sync state
import '../state';

export interface LocalFileRow {
  id: string;
  name: string;
  mime_type: string;
  size: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  parents_json: string | null;
  synced_at: number;
}

/**
 * Upsert a file from Drive API response into local DB (idempotent).
 */
export function upsertFile(file: {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}): void {
  const now = Date.now();
  const parentsJson = file.parents && file.parents.length > 0 ? JSON.stringify(file.parents) : null;

  db.exec(
    `INSERT INTO files (
      id, name, mime_type, size, modified_time, web_view_link, parents_json, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      mime_type = excluded.mime_type,
      size = excluded.size,
      modified_time = excluded.modified_time,
      web_view_link = excluded.web_view_link,
      parents_json = excluded.parents_json,
      synced_at = excluded.synced_at`,
    [
      file.id,
      file.name,
      file.mimeType ?? 'application/octet-stream',
      file.size ?? null,
      file.modifiedTime ?? null,
      file.webViewLink ?? null,
      parentsJson,
      now,
    ]
  );
}

/**
 * Get a single file by ID.
 */
export function getFileById(fileId: string): LocalFileRow | null {
  return db.get('SELECT * FROM files WHERE id = ?', [fileId]) as LocalFileRow | null;
}

/**
 * Query local files with optional filters.
 */
export function getLocalFiles(
  options: { query?: string; limit?: number; mimeType?: string } = {}
): LocalFileRow[] {
  let sql = 'SELECT * FROM files WHERE 1=1';
  const params: unknown[] = [];

  if (options.mimeType) {
    sql += ' AND mime_type = ?';
    params.push(options.mimeType);
  }

  if (options.query) {
    sql += ' AND name LIKE ?';
    params.push(`%${options.query}%`);
  }

  sql += ' ORDER BY modified_time DESC';

  const limit = options.limit ?? 50;
  sql += ' LIMIT ?';
  params.push(limit);

  return db.all(sql, params) as unknown as LocalFileRow[];
}

export interface LocalSpreadsheetRow {
  id: string;
  title: string;
  sheets_json: string;
  synced_at: number;
}

export interface LocalSheetValuesRow {
  spreadsheet_id: string;
  range_a1: string;
  values_json: string;
  synced_at: number;
}

export interface LocalDocumentRow {
  id: string;
  title: string;
  content_text: string;
  synced_at: number;
}

/**
 * Upsert spreadsheet metadata (id = Drive file id).
 */
export function upsertSpreadsheet(
  id: string,
  title: string,
  sheets: Array<{ sheetId?: number; title?: string }>
): void {
  const now = Date.now();
  const sheetsJson = JSON.stringify(sheets);
  db.exec(
    `INSERT INTO spreadsheets (id, title, sheets_json, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, sheets_json = excluded.sheets_json, synced_at = excluded.synced_at`,
    [id, title, sheetsJson, now]
  );
}

/**
 * Upsert sheet range values.
 */
export function upsertSheetValues(
  spreadsheetId: string,
  rangeA1: string,
  values: unknown[][]
): void {
  const now = Date.now();
  const valuesJson = JSON.stringify(values);
  db.exec(
    `INSERT INTO sheet_values (spreadsheet_id, range_a1, values_json, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(spreadsheet_id, range_a1) DO UPDATE SET values_json = excluded.values_json, synced_at = excluded.synced_at`,
    [spreadsheetId, rangeA1, valuesJson, now]
  );
}

/**
 * Get spreadsheet metadata by id.
 */
export function getSpreadsheetById(id: string): LocalSpreadsheetRow | null {
  return db.get('SELECT * FROM spreadsheets WHERE id = ?', [id]) as LocalSpreadsheetRow | null;
}

/**
 * Get sheet values for a range (or first range for spreadsheet if range omitted).
 */
export function getSheetValues(
  spreadsheetId: string,
  rangeA1?: string
): { range_a1: string; values: unknown[][] } | null {
  if (rangeA1) {
    const row = db.get(
      'SELECT range_a1, values_json FROM sheet_values WHERE spreadsheet_id = ? AND range_a1 = ?',
      [spreadsheetId, rangeA1]
    ) as { range_a1: string; values_json: string } | null;
    if (!row) return null;
    try {
      return { range_a1: row.range_a1, values: JSON.parse(row.values_json) as unknown[][] };
    } catch {
      return null;
    }
  }
  const row = db.get(
    'SELECT range_a1, values_json FROM sheet_values WHERE spreadsheet_id = ? ORDER BY range_a1 LIMIT 1',
    [spreadsheetId]
  ) as { range_a1: string; values_json: string } | null;
  if (!row) return null;
  try {
    return { range_a1: row.range_a1, values: JSON.parse(row.values_json) as unknown[][] };
  } catch {
    return null;
  }
}

/**
 * List all stored ranges for a spreadsheet.
 */
export function getSheetValueRanges(spreadsheetId: string): string[] {
  const rows = db.all(
    'SELECT range_a1 FROM sheet_values WHERE spreadsheet_id = ? ORDER BY range_a1',
    [spreadsheetId]
  ) as { range_a1: string }[];
  return rows.map(r => r.range_a1);
}

/**
 * Upsert document content (id = Drive file id).
 */
export function upsertDocument(id: string, title: string, contentText: string): void {
  const now = Date.now();
  db.exec(
    `INSERT INTO documents (id, title, content_text, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_text = excluded.content_text, synced_at = excluded.synced_at`,
    [id, title, contentText, now]
  );
}

/**
 * Get document by id.
 */
export function getDocumentById(id: string): LocalDocumentRow | null {
  return db.get('SELECT * FROM documents WHERE id = ?', [id]) as LocalDocumentRow | null;
}

/**
 * Get entity counts for sync status.
 */
export function getEntityCounts(): {
  totalFiles: number;
  totalSpreadsheets: number;
  totalSheetRanges: number;
  totalDocuments: number;
} {
  const files = db.get('SELECT COUNT(*) as cnt FROM files', []) as { cnt: number } | null;
  const spreadsheets = db.get('SELECT COUNT(*) as cnt FROM spreadsheets', []) as {
    cnt: number;
  } | null;
  const sheetRanges = db.get('SELECT COUNT(*) as cnt FROM sheet_values', []) as {
    cnt: number;
  } | null;
  const documents = db.get('SELECT COUNT(*) as cnt FROM documents', []) as { cnt: number } | null;
  return {
    totalFiles: files?.cnt ?? 0,
    totalSpreadsheets: spreadsheets?.cnt ?? 0,
    totalSheetRanges: sheetRanges?.cnt ?? 0,
    totalDocuments: documents?.cnt ?? 0,
  };
}

/**
 * Get sync state value by key.
 */
export function getSyncState(key: string): string | null {
  const row = db.get('SELECT value FROM sync_state WHERE key = ?', [key]) as {
    value: string;
  } | null;
  return row?.value ?? null;
}

/**
 * Set sync state value (idempotent).
 */
export function setSyncState(key: string, value: string): void {
  db.exec('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

declare global {
  var GOOGLE_DRIVE_DB_HELPERS: {
    upsertFile: typeof upsertFile;
    getFileById: typeof getFileById;
    getLocalFiles: typeof getLocalFiles;
    upsertSpreadsheet: typeof upsertSpreadsheet;
    upsertSheetValues: typeof upsertSheetValues;
    getSpreadsheetById: typeof getSpreadsheetById;
    getSheetValues: typeof getSheetValues;
    getSheetValueRanges: typeof getSheetValueRanges;
    upsertDocument: typeof upsertDocument;
    getDocumentById: typeof getDocumentById;
    getEntityCounts: typeof getEntityCounts;
    getSyncState: typeof getSyncState;
    setSyncState: typeof setSyncState;
  };
}

globalThis.GOOGLE_DRIVE_DB_HELPERS = {
  upsertFile,
  getFileById,
  getLocalFiles,
  upsertSpreadsheet,
  upsertSheetValues,
  getSpreadsheetById,
  getSheetValues,
  getSheetValueRanges,
  upsertDocument,
  getDocumentById,
  getEntityCounts,
  getSyncState,
  setSyncState,
};
