// Google Drive skill type definitions (Drive, Sheets, Docs)

export interface SkillConfig {
  credentialId: string;
  userEmail: string;
  syncIntervalMinutes: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

/** Drive API file list response (normalized for DB) */
export interface DriveFileApiItem {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

/** Local DB row for a synced file */
export interface LocalFile {
  id: string;
  name: string;
  mime_type: string;
  size: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  parents_json: string | null;
  synced_at: number;
}

// Sheets API
export const SHEETS_BASE = 'https://sheets.googleapis.com/v4';
export const SHEETS_MIMETYPE = 'application/vnd.google-apps.spreadsheet';

// Docs API
export const DOCS_BASE = 'https://docs.googleapis.com/v1';
export const DOCS_MIMETYPE = 'application/vnd.google-apps.document';

export interface ApiError {
  code: number;
  message: string;
  errors?: Array<{ domain: string; reason: string; message: string }>;
}

export interface DriveFetchOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number;
  baseUrl?: string;
  /** When true, return response body as string in data (no JSON parse). Use for export/binary. */
  rawBody?: boolean;
}

export interface DriveFetchResult {
  success: boolean;
  data?: unknown;
  error?: { code: number; message: string };
}

export type DriveFetchFn = (endpoint: string, options?: DriveFetchOptions) => DriveFetchResult;
