// google-calendar/index.ts — Orchestrator
import './api/calendar';
import './db/helpers';
import './db/schema';
import './state';
import './sync';
import {
  createEventTool,
  deleteEventTool,
  getEventTool,
  listCalendarsTool,
  listEventsTool,
  syncNowTool,
  updateEventTool,
} from './tools';
import type { SkillConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  console.log(`[google-calendar] Initializing on ${platform.os()}`);
  if (typeof globalThis.initializeGoogleCalendarSchema === 'function') {
    globalThis.initializeGoogleCalendarSchema();
  }
  const s = globalThis.getGoogleCalendarSkillState();
  const saved = state.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    s.config.credentialId = saved.credentialId || s.config.credentialId;
    s.config.userEmail = saved.userEmail || s.config.userEmail;
  }
  const isConnected = !!oauth.getCredential();
  console.log(`[google-calendar] Initialized. Connected: ${isConnected}`);
}

async function start(): Promise<void> {
  console.log('[google-calendar] Starting skill...');
  publishSkillState();
  try {
    cron.register('google-calendar-sync', '0 */10 * * * *');
  } catch (e) {
    console.warn('[google-calendar] Failed to register sync cron', e);
  }
  try {
    await (
      globalThis as { googleCalendarSync?: { performSync: () => Promise<void> } }
    ).googleCalendarSync?.performSync();
  } catch (err) {
    console.warn('[google-calendar] Initial sync failed:', err);
  }
}

async function stop(): Promise<void> {
  console.log('[google-calendar] Stopping skill...');
  const s = globalThis.getGoogleCalendarSkillState();
  state.set('config', s.config);
  console.log('[google-calendar] Skill stopped');
  try {
    cron.unregister('google-calendar-sync');
  } catch {
    // ignore
  }
}

async function onSessionStart(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  s.activeSessions.push(args.sessionId);
}

async function onSessionEnd(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  const i = s.activeSessions.indexOf(args.sessionId);
  if (i > -1) s.activeSessions.splice(i, 1);
}

async function onCronTrigger(scheduleId: string): Promise<void> {
  if (scheduleId === 'google-calendar-sync') {
    await (
      globalThis as { googleCalendarSync?: { performSync: () => Promise<void> } }
    ).googleCalendarSync?.performSync();
  }
}

async function onOAuthComplete(args: OAuthCompleteArgs): Promise<void> {
  console.log(`[google-calendar] OAuth complete: ${args.provider}`);
  const s = globalThis.getGoogleCalendarSkillState();
  s.config.credentialId = args.credentialId;
  if (args.accountLabel) s.config.userEmail = args.accountLabel;
  state.set('config', s.config);
  publishSkillState();
}

async function onOAuthRevoked(_args: OAuthRevokedArgs): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.set('config', s.config);
  publishSkillState();
}

async function onDisconnect(): Promise<void> {
  oauth.revoke();
  const s = globalThis.getGoogleCalendarSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.delete('config');
  publishSkillState();
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishSkillState(): void {
  const s = globalThis.getGoogleCalendarSkillState();
  const isConnected = !!oauth.getCredential();
  state.setPartial({
    connection_status: isConnected ? 'connected' : 'disconnected',
    auth_status: isConnected ? 'authenticated' : 'not_authenticated',
    connection_error: s.lastApiError || null,
    auth_error: null,
    is_initialized: isConnected,
    userEmail: s.config.userEmail,
    activeSessions: s.activeSessions.length,
    rateLimitRemaining: s.rateLimitRemaining,
    lastError: s.lastApiError,
    sync_in_progress: s.syncInProgress,
    last_sync_time: s.lastSyncTime,
    last_synced_calendars: s.lastSyncedCalendars,
  });
}

// ---------------------------------------------------------------------------
// Expose on globalThis for tools
// ---------------------------------------------------------------------------

const _g = globalThis as Record<string, unknown>;
_g.calendarFetch = globalThis.googleCalendarApi.calendarFetch;
_g.publishGoogleCalendarState = publishSkillState;

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  listCalendarsTool,
  listEventsTool,
  getEventTool,
  createEventTool,
  updateEventTool,
  deleteEventTool,
  syncNowTool,
];

const skill: Skill = {
  info: {
    id: 'google-calendar',
    name: 'Google Calendar',
    version: '1.0.0',
    description: 'Google Calendar integration',
    auto_start: false,
    setup: { required: true, label: 'Google Calendar' },
  },
  tools,
  init,
  start,
  stop,
  onSessionStart,
  onSessionEnd,
  onOAuthComplete,
  onOAuthRevoked,
  onDisconnect,
  onCronTrigger,
};

export default skill;
