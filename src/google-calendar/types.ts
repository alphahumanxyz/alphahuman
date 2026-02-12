// Google Calendar skill type definitions

export interface SkillConfig {
  credentialId: string;
  userEmail: string;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
  hidden?: boolean;
  selected?: boolean;
  writable?: boolean;
  colorId?: string;
  conferenceProperties?: Record<string, unknown>;
  etag?: string;
  updated?: string;
}

export interface CalendarEventDateTime {
  date?: string; // YYYY-MM-DD for all-day
  dateTime?: string; // RFC3339
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: CalendarEventDateTime;
  end: CalendarEventDateTime;
  status?: string;
  htmlLink?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  created?: string;
  updated?: string;
  recurringEventId?: string;
  recurrence?: string[];
  sequence?: number;
}

export interface ApiError {
  code: number;
  message: string;
  errors?: Array<{ domain: string; reason: string; message: string }>;
}

/** Response shape from the calendar OAuth proxy (calendarFetch). */
export interface CalendarApiFetchResponse {
  success: boolean;
  data?: unknown;
  error?: { code: number; message: string };
}

export interface LocalCalendarRecord {
  id: string;
  summary: string;
  description: string | null;
  time_zone: string | null;
  primary_flag: number;
  access_role: string;
  background_color: string | null;
  foreground_color: string | null;
  hidden: number;
  selected: number;
  writable: number;
  color_id: string | null;
  etag: string | null;
  conference_properties_json: string | null;
  updated: string | null;
}

export interface LocalEventRecord {
  id: string;
  calendar_id: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  status: string | null;
  html_link: string | null;
  start_time: string;
  end_time: string;
  start_ts: number;
  end_ts: number;
  start_json: string;
  end_json: string;
  attendees_json: string | null;
  created: string | null;
  updated: string | null;
  recurring_event_id: string | null;
  recurrence_json: string | null;
  sequence: number | null;
  raw_json?: string | null;
}

export interface CalendarSyncState {
  calendarId: string;
  eventsSyncToken: string | null;
  lastFullSync: number | null;
  lastRequestedStart: number | null;
  lastRequestedEnd: number | null;
}
