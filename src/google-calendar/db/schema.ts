// Database schema definition for Google Calendar skill
import '../state';

export function initializeGoogleCalendarSchema(): void {
  console.log('[google-calendar] Initializing database schema...');
  db.exec(
    `CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      description TEXT,
      time_zone TEXT,
      primary_flag INTEGER NOT NULL DEFAULT 0,
      access_role TEXT NOT NULL,
      background_color TEXT,
      foreground_color TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      selected INTEGER NOT NULL DEFAULT 0,
      writable INTEGER NOT NULL DEFAULT 0,
      color_id TEXT,
      etag TEXT,
      conference_properties_json TEXT,
      updated TEXT,
      raw_json TEXT
    )`,
    []
  );
  console.log('[google-calendar] Calendars table created');

  db.exec(
    `CREATE TABLE IF NOT EXISTS events (
      calendar_id TEXT NOT NULL,
      id TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      location TEXT,
      status TEXT,
      html_link TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      start_ts INTEGER NOT NULL,
      end_ts INTEGER NOT NULL,
      start_json TEXT NOT NULL,
      end_json TEXT NOT NULL,
      attendees_json TEXT,
      created TEXT,
      updated TEXT,
      recurring_event_id TEXT,
      recurrence_json TEXT,
      sequence INTEGER,
      raw_json TEXT,
      synced_at INTEGER NOT NULL,
      PRIMARY KEY (calendar_id, id)
    )`,
    []
  );
  console.log('[google-calendar] Events table created');

  db.exec(
    `CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    []
  );

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_events_calendar_time ON events(calendar_id, start_ts)',
    []
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_updated ON events(updated)', []);

  console.log('[google-calendar] Database schema initialized');
}

declare global {
  var initializeGoogleCalendarSchema: () => void;
}

globalThis.initializeGoogleCalendarSchema = initializeGoogleCalendarSchema;
