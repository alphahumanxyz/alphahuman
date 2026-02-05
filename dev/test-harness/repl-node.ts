#!/usr/bin/env tsx
/**
 * repl-node.ts - Interactive REPL for skill testing
 *
 * Loads a compiled skill and provides an interactive prompt to call tools,
 * lifecycle hooks, walk through setup wizards, and inspect state.
 *
 * Usage:
 *   yarn repl [skill-id] [--clean]
 *   npx tsx dev/test-harness/repl-node.ts [skill-id] [--clean]
 */

import * as readline from 'readline/promises';
import { existsSync, readFileSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createBridgeAPIs } from './bootstrap-node';
import {
  getMockState,
  initMockState,
  mockFetchError,
  mockFetchResponse,
  setEnv,
} from './mock-state';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

const c = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

// ─── Types ─────────────────────────────────────────────────────────

interface Manifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  setup?: { required?: boolean; label?: string };
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => string;
}

interface SetupField {
  name: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean';
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  fields: SetupField[];
}

// The global context shared between REPL and skill code
type G = Record<string, unknown>;

// ─── Helpers ───────────────────────────────────────────────────────

function prettyJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  // Colorize keys and strings lightly
  return json
    .replace(/"([^"]+)":/g, `${c.cyan}"$1"${c.reset}:`)
    .replace(/: "(.*?)"/g, `: ${c.green}"$1"${c.reset}`);
}

function discoverSkills(): Array<{ id: string; manifest: Manifest }> {
  const skillsDir = resolve(rootDir, 'skills');
  if (!existsSync(skillsDir)) return [];
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const result: Array<{ id: string; manifest: Manifest }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = resolve(skillsDir, entry.name, 'manifest.json');
    const indexPath = resolve(skillsDir, entry.name, 'index.js');
    if (existsSync(manifestPath) && existsSync(indexPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        result.push({ id: entry.name, manifest });
      } catch {
        // skip malformed manifests
      }
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Skill Loader ──────────────────────────────────────────────────

function runInContext(G: G, code: string): void {
  const fn = new Function('G', `
    "use strict";
    var console = G.console;
    var store = G.store;
    var db = G.db;
    var net = G.net;
    var platform = G.platform;
    var state = G.state;
    var data = G.data;
    var cron = G.cron;
    var skills = G.skills;
    var model = G.model;
    var setTimeout = G.setTimeout;
    var setInterval = G.setInterval;
    var clearTimeout = G.clearTimeout;
    var clearInterval = G.clearInterval;
    var Date = G.Date;
    var JSON = G.JSON;
    var Object = G.Object;
    var Array = G.Array;
    var String = G.String;
    var Number = G.Number;
    var Boolean = G.Boolean;
    var Math = G.Math;
    var Error = G.Error;
    var TypeError = G.TypeError;
    var ReferenceError = G.ReferenceError;
    var Map = G.Map;
    var Set = G.Set;
    var WeakMap = G.WeakMap;
    var WeakSet = G.WeakSet;
    var Promise = G.Promise;
    var RegExp = G.RegExp;
    var Symbol = G.Symbol;
    var BigInt = G.BigInt;
    var parseInt = G.parseInt;
    var parseFloat = G.parseFloat;
    var isNaN = G.isNaN;
    var isFinite = G.isFinite;
    var encodeURIComponent = G.encodeURIComponent;
    var decodeURIComponent = G.decodeURIComponent;
    var encodeURI = G.encodeURI;
    var decodeURI = G.decodeURI;
    var Uint8Array = G.Uint8Array;
    var Int8Array = G.Int8Array;
    var Uint16Array = G.Uint16Array;
    var Int16Array = G.Int16Array;
    var Uint32Array = G.Uint32Array;
    var Int32Array = G.Int32Array;
    var Float32Array = G.Float32Array;
    var Float64Array = G.Float64Array;
    var ArrayBuffer = G.ArrayBuffer;
    var DataView = G.DataView;
    var TextEncoder = G.TextEncoder;
    var TextDecoder = G.TextDecoder;
    var btoa = G.btoa;
    var atob = G.atob;
    var globalThis = G;
    var self = G;
    var window = G;
    var __helpers = G.__helpers;
    var Buffer = G.Buffer;
    var location = G.location;
    var WebSocket = G.WebSocket;
    var crypto = G.crypto;

    ${code}

    G.__skill = (typeof __skill !== 'undefined') ? __skill : ((typeof globalThis !== 'undefined' && globalThis.__skill) ? globalThis.__skill : G.__skill);
    if (typeof init !== 'undefined') G.init = init;
    if (typeof start !== 'undefined') G.start = start;
    if (typeof stop !== 'undefined') G.stop = stop;
    if (typeof onCronTrigger !== 'undefined') G.onCronTrigger = onCronTrigger;
    if (typeof onSetupStart !== 'undefined') G.onSetupStart = onSetupStart;
    if (typeof onSetupSubmit !== 'undefined') G.onSetupSubmit = onSetupSubmit;
    if (typeof onSetupCancel !== 'undefined') G.onSetupCancel = onSetupCancel;
    if (typeof onDisconnect !== 'undefined') G.onDisconnect = onDisconnect;
    if (typeof onSessionStart !== 'undefined') G.onSessionStart = onSessionStart;
    if (typeof onSessionEnd !== 'undefined') G.onSessionEnd = onSessionEnd;
    if (typeof onListOptions !== 'undefined') G.onListOptions = onListOptions;
    if (typeof onSetOption !== 'undefined') G.onSetOption = onSetOption;
  `);
  fn(G);
}

function extractSkillExports(G: G): void {
  const skillExport = G.__skill as { default?: Record<string, unknown> } | undefined;
  const skill = skillExport?.default;
  if (!skill) return;
  if (skill.tools) G.tools = skill.tools;
  const hooks = [
    'init', 'start', 'stop', 'onCronTrigger', 'onSetupStart',
    'onSetupSubmit', 'onSetupCancel', 'onDisconnect',
    'onSessionStart', 'onSessionEnd', 'onListOptions', 'onSetOption',
  ];
  for (const hook of hooks) {
    if (skill[hook] && !G[hook]) G[hook] = skill[hook];
  }
}

async function loadSkill(
  skillId: string,
  cleanFlag: boolean,
): Promise<{ G: G; manifest: Manifest; cleanup: () => void }> {
  const skillDir = resolve(rootDir, 'skills', skillId);
  const skillIndexPath = resolve(skillDir, 'index.js');
  const skillManifestPath = resolve(skillDir, 'manifest.json');

  if (!existsSync(skillIndexPath)) {
    throw new Error(`Skill "${skillId}" not found at ${skillDir}. Run 'yarn build' first.`);
  }

  const manifest: Manifest = JSON.parse(readFileSync(skillManifestPath, 'utf-8'));
  const dataDir = resolve(skillDir, 'data');

  if (cleanFlag && existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
    console.log(`${c.yellow}Cleaned data directory${c.reset}`);
  }

  initMockState();

  // Forward env vars
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_PHONE_NUMBER', 'NOTION_API_KEY', 'OPENAI_API_KEY']) {
    const val = process.env[key];
    if (val) setEnv(key, val);
  }

  const bridgeAPIs = await createBridgeAPIs({ dataDir });

  const G: G = { ...bridgeAPIs };
  G.globalThis = G;
  G.self = G;
  G.window = G;
  G.__helpers = { getMockState, mockFetchResponse, mockFetchError, setEnv };

  if (bridgeAPIs.WebSocket) {
    // @ts-ignore
    globalThis.WebSocket = bridgeAPIs.WebSocket;
    // @ts-ignore
    globalThis.window = globalThis;
  }

  const skillCode = readFileSync(skillIndexPath, 'utf-8');
  runInContext(G, skillCode);
  extractSkillExports(G);

  const cleanup = () => {
    if (typeof bridgeAPIs.__cleanup === 'function') {
      (bridgeAPIs.__cleanup as () => void)();
    }
  };

  return { G, manifest, cleanup };
}

// ─── Setup Wizard ──────────────────────────────────────────────────

async function runSetupWizard(G: G, rl: readline.Interface): Promise<void> {
  const onSetupStart = G.onSetupStart as (() => { step: SetupStep }) | undefined;
  const onSetupSubmit = G.onSetupSubmit as ((args: {
    stepId: string;
    values: Record<string, unknown>;
  }) => { status: string; nextStep?: SetupStep; errors?: Array<{ field: string; message: string }> }) | undefined;

  if (!onSetupStart) {
    console.log(`${c.yellow}This skill does not implement onSetupStart${c.reset}`);
    return;
  }

  console.log(`\n${c.magenta}${c.bold}Setup Wizard${c.reset}`);
  console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);

  let result = onSetupStart();
  let step = result.step;

  while (step) {
    console.log(`\n${c.bold}${step.title}${c.reset}`);
    if (step.description) console.log(`${c.dim}${step.description}${c.reset}\n`);

    const values: Record<string, unknown> = {};

    for (const field of step.fields) {
      const value = await promptField(field, rl);
      values[field.name] = value;
    }

    if (!onSetupSubmit) {
      console.log(`${c.yellow}onSetupSubmit not implemented${c.reset}`);
      return;
    }

    const submitResult = onSetupSubmit({ stepId: step.id, values });

    if (submitResult.status === 'error') {
      console.log(`\n${c.red}Setup errors:${c.reset}`);
      for (const err of submitResult.errors ?? []) {
        console.log(`  ${c.red}- ${err.field}: ${err.message}${c.reset}`);
      }
      console.log(`${c.yellow}Re-running step...${c.reset}`);
      // Re-run same step
      continue;
    }

    if (submitResult.status === 'complete') {
      console.log(`\n${c.green}Setup complete!${c.reset}`);
      return;
    }

    if (submitResult.status === 'next' && submitResult.nextStep) {
      step = submitResult.nextStep;
      continue;
    }

    // Unknown status
    console.log(`${c.yellow}Unknown setup status: ${submitResult.status}${c.reset}`);
    return;
  }
}

async function promptField(field: SetupField, rl: readline.Interface): Promise<unknown> {
  const defaultHint = field.default !== undefined ? ` ${c.dim}(default: ${field.default})${c.reset}` : '';
  const requiredHint = field.required ? ` ${c.red}*${c.reset}` : '';
  const label = `${field.label}${requiredHint}${defaultHint}`;

  if (field.description) {
    console.log(`  ${c.dim}${field.description}${c.reset}`);
  }

  switch (field.type) {
    case 'select': {
      const options = field.options ?? [];
      console.log(`  ${label}`);
      for (let i = 0; i < options.length; i++) {
        const isDefault = String(field.default) === options[i].value;
        console.log(`    ${c.cyan}${i + 1}${c.reset}) ${options[i].label}${isDefault ? ` ${c.dim}(default)${c.reset}` : ''}`);
      }
      while (true) {
        const answer = await rl.question(`  ${c.cyan}>${c.reset} `);
        if (answer === '' && field.default !== undefined) return field.default;
        const idx = parseInt(answer, 10);
        if (idx >= 1 && idx <= options.length) return options[idx - 1].value;
        console.log(`  ${c.red}Enter a number 1-${options.length}${c.reset}`);
      }
    }

    case 'boolean': {
      const def = field.default === true;
      const hint = def ? '[Y/n]' : '[y/N]';
      const answer = await rl.question(`  ${label} ${hint}: `);
      if (answer === '') return def;
      return answer.toLowerCase().startsWith('y');
    }

    case 'number': {
      while (true) {
        const answer = await rl.question(`  ${label}: `);
        if (answer === '' && field.default !== undefined) return field.default;
        const num = parseFloat(answer);
        if (!isNaN(num)) return num;
        console.log(`  ${c.red}Enter a valid number${c.reset}`);
      }
    }

    case 'password': {
      console.log(`  ${c.yellow}(input is visible - dev tooling)${c.reset}`);
      const answer = await rl.question(`  ${label}: `);
      if (answer === '' && field.default !== undefined) return field.default;
      return answer;
    }

    case 'text':
    default: {
      const answer = await rl.question(`  ${label}: `);
      if (answer === '' && field.default !== undefined) return field.default;
      return answer;
    }
  }
}

// ─── Interactive Tool Args ─────────────────────────────────────────

async function promptToolArgs(
  tool: ToolDef,
  rl: readline.Interface,
): Promise<Record<string, unknown>> {
  const props = tool.input_schema.properties;
  if (!props || Object.keys(props).length === 0) return {};

  const required = new Set(tool.input_schema.required ?? []);
  const args: Record<string, unknown> = {};

  console.log(`${c.dim}Enter arguments for ${tool.name}:${c.reset}`);

  for (const [name, prop] of Object.entries(props)) {
    const reqHint = required.has(name) ? ` ${c.red}*${c.reset}` : '';
    const descHint = prop.description ? ` ${c.dim}(${prop.description})${c.reset}` : '';
    const typeHint = prop.type ? ` ${c.dim}[${prop.type}]${c.reset}` : '';

    if (prop.enum && prop.enum.length > 0) {
      console.log(`  ${c.cyan}${name}${c.reset}${reqHint}${descHint}`);
      for (let i = 0; i < prop.enum.length; i++) {
        const isDefault = prop.default === prop.enum[i];
        console.log(`    ${c.cyan}${i + 1}${c.reset}) ${prop.enum[i]}${isDefault ? ` ${c.dim}(default)${c.reset}` : ''}`);
      }
      const answer = await rl.question(`  ${c.cyan}>${c.reset} `);
      if (answer === '' && prop.default !== undefined) {
        args[name] = prop.default;
      } else {
        const idx = parseInt(answer, 10);
        if (idx >= 1 && idx <= prop.enum.length) {
          args[name] = prop.enum[idx - 1];
        } else if (answer !== '') {
          args[name] = answer;
        }
      }
    } else {
      const answer = await rl.question(`  ${c.cyan}${name}${c.reset}${typeHint}${reqHint}${descHint}: `);
      if (answer === '' && !required.has(name)) continue;
      if (answer === '' && prop.default !== undefined) {
        args[name] = prop.default;
        continue;
      }
      // Coerce types
      if (prop.type === 'number' || prop.type === 'integer') {
        args[name] = parseFloat(answer);
      } else if (prop.type === 'boolean') {
        args[name] = answer.toLowerCase().startsWith('y') || answer === 'true' || answer === '1';
      } else {
        // Try JSON parse for objects/arrays, fall back to string
        if (answer.startsWith('{') || answer.startsWith('[')) {
          try { args[name] = JSON.parse(answer); } catch { args[name] = answer; }
        } else {
          args[name] = answer;
        }
      }
    }
  }

  return args;
}

// ─── Command Handlers ──────────────────────────────────────────────

function getTools(G: G): ToolDef[] {
  const tools = G.tools as ToolDef[] | undefined;
  return (tools ?? []).filter(t => t && t.name);
}

function cmdHelp(): void {
  console.log(`
${c.bold}Commands:${c.reset}
  ${c.cyan}help${c.reset}                        Show this help
  ${c.cyan}tools${c.reset}                       List available tools
  ${c.cyan}call <tool> [json]${c.reset}          Call a tool (prompts for args if no JSON given)
  ${c.cyan}init${c.reset}                        Call init()
  ${c.cyan}start${c.reset}                       Call start()
  ${c.cyan}stop${c.reset}                        Call stop()
  ${c.cyan}cron <id>${c.reset}                   Trigger onCronTrigger(id)
  ${c.cyan}session start [id]${c.reset}          Trigger onSessionStart
  ${c.cyan}session end [id]${c.reset}            Trigger onSessionEnd
  ${c.cyan}setup${c.reset}                       Run setup wizard
  ${c.cyan}options${c.reset}                     List runtime options
  ${c.cyan}option <name> <value>${c.reset}       Set a runtime option
  ${c.cyan}state${c.reset}                       Show published state
  ${c.cyan}store${c.reset}                       Show store contents
  ${c.cyan}db <sql>${c.reset}                    Run SQL query
  ${c.cyan}mock fetch <url> <status> <body>${c.reset}  Mock an HTTP response
  ${c.cyan}env <key> <value>${c.reset}           Set environment variable
  ${c.cyan}disconnect${c.reset}                  Call onDisconnect()
  ${c.cyan}reload${c.reset}                      Reload skill (stop + re-read + init + start)
  ${c.cyan}exit${c.reset} / ${c.cyan}quit${c.reset}                  Clean exit
`);
}

function cmdTools(G: G): void {
  const tools = getTools(G);
  if (tools.length === 0) {
    console.log(`${c.dim}No tools registered${c.reset}`);
    return;
  }
  console.log(`\n${c.bold}Tools (${tools.length}):${c.reset}`);
  for (const tool of tools) {
    const params = tool.input_schema.properties
      ? Object.keys(tool.input_schema.properties).join(', ')
      : '';
    console.log(`  ${c.cyan}${tool.name}${c.reset}${params ? ` (${c.dim}${params}${c.reset})` : ''}`);
    if (tool.description) {
      console.log(`    ${c.dim}${tool.description}${c.reset}`);
    }
  }
  console.log();
}

async function cmdCall(G: G, rest: string, rl: readline.Interface): Promise<void> {
  const tools = getTools(G);
  const spaceIdx = rest.indexOf(' ');
  const toolName = spaceIdx === -1 ? rest : rest.substring(0, spaceIdx);
  const jsonStr = spaceIdx === -1 ? '' : rest.substring(spaceIdx + 1).trim();

  if (!toolName) {
    console.log(`${c.red}Usage: call <tool-name> [json-args]${c.reset}`);
    return;
  }

  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    console.log(`${c.red}Tool "${toolName}" not found.${c.reset} Available: ${tools.map(t => t.name).join(', ')}`);
    return;
  }

  let args: Record<string, unknown>;
  if (jsonStr) {
    try {
      args = JSON.parse(jsonStr);
    } catch (e) {
      console.log(`${c.red}Invalid JSON: ${e}${c.reset}`);
      return;
    }
  } else {
    args = await promptToolArgs(tool, rl);
  }

  try {
    const rawResult = tool.execute(args);
    let parsed: unknown;
    try { parsed = JSON.parse(rawResult); } catch { parsed = rawResult; }
    console.log(`\n${c.green}Result:${c.reset}`);
    console.log(prettyJson(parsed));
  } catch (e) {
    console.log(`${c.red}Tool error: ${e}${c.reset}`);
  }
}

function cmdLifecycle(G: G, hookName: string): void {
  const fn = G[hookName] as (() => void) | undefined;
  if (typeof fn !== 'function') {
    console.log(`${c.yellow}${hookName}() not defined${c.reset}`);
    return;
  }
  try {
    fn();
    console.log(`${c.green}${hookName}() completed${c.reset}`);
  } catch (e) {
    console.log(`${c.red}${hookName}() error: ${e}${c.reset}`);
  }
}

function cmdCron(G: G, scheduleId: string): void {
  if (!scheduleId) {
    const schedules = getMockState().cronSchedules;
    const ids = Object.keys(schedules);
    if (ids.length === 0) {
      console.log(`${c.dim}No cron schedules registered${c.reset}`);
    } else {
      console.log(`${c.bold}Cron schedules:${c.reset}`);
      for (const [id, expr] of Object.entries(schedules)) {
        console.log(`  ${c.cyan}${id}${c.reset}: ${expr}`);
      }
      console.log(`\n${c.dim}Usage: cron <schedule-id>${c.reset}`);
    }
    return;
  }
  const fn = G.onCronTrigger as ((id: string) => void) | undefined;
  if (typeof fn !== 'function') {
    console.log(`${c.yellow}onCronTrigger not defined${c.reset}`);
    return;
  }
  try {
    fn(scheduleId);
    console.log(`${c.green}onCronTrigger("${scheduleId}") completed${c.reset}`);
  } catch (e) {
    console.log(`${c.red}onCronTrigger error: ${e}${c.reset}`);
  }
}

function cmdSession(G: G, rest: string): void {
  const parts = rest.split(/\s+/);
  const action = parts[0];
  const sessionId = parts[1] || `session-${Date.now()}`;

  if (action === 'start') {
    const fn = G.onSessionStart as ((args: { sessionId: string }) => void) | undefined;
    if (typeof fn !== 'function') {
      console.log(`${c.yellow}onSessionStart not defined${c.reset}`);
      return;
    }
    try {
      fn({ sessionId });
      console.log(`${c.green}onSessionStart("${sessionId}") completed${c.reset}`);
    } catch (e) {
      console.log(`${c.red}onSessionStart error: ${e}${c.reset}`);
    }
  } else if (action === 'end') {
    const fn = G.onSessionEnd as ((args: { sessionId: string }) => void) | undefined;
    if (typeof fn !== 'function') {
      console.log(`${c.yellow}onSessionEnd not defined${c.reset}`);
      return;
    }
    try {
      fn({ sessionId });
      console.log(`${c.green}onSessionEnd("${sessionId}") completed${c.reset}`);
    } catch (e) {
      console.log(`${c.red}onSessionEnd error: ${e}${c.reset}`);
    }
  } else {
    console.log(`${c.red}Usage: session start [id] | session end [id]${c.reset}`);
  }
}

function cmdOptions(G: G): void {
  const fn = G.onListOptions as (() => { options: Array<{
    name: string; type: string; label: string; value: unknown;
    options?: Array<{ label: string; value: string }>;
  }> }) | undefined;
  if (typeof fn !== 'function') {
    console.log(`${c.yellow}onListOptions not defined${c.reset}`);
    return;
  }
  try {
    const result = fn();
    if (!result.options || result.options.length === 0) {
      console.log(`${c.dim}No options available${c.reset}`);
      return;
    }
    console.log(`\n${c.bold}Options:${c.reset}`);
    for (const opt of result.options) {
      const choices = opt.options ? ` [${opt.options.map(o => o.value).join('|')}]` : '';
      console.log(`  ${c.cyan}${opt.name}${c.reset} = ${c.green}${opt.value}${c.reset} ${c.dim}(${opt.type}${choices})${c.reset}`);
      if (opt.label) console.log(`    ${c.dim}${opt.label}${c.reset}`);
    }
    console.log();
  } catch (e) {
    console.log(`${c.red}onListOptions error: ${e}${c.reset}`);
  }
}

function cmdSetOption(G: G, rest: string): void {
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx === -1) {
    console.log(`${c.red}Usage: option <name> <value>${c.reset}`);
    return;
  }
  const name = rest.substring(0, spaceIdx);
  const rawValue = rest.substring(spaceIdx + 1).trim();

  const fn = G.onSetOption as ((args: { name: string; value: unknown }) => void) | undefined;
  if (typeof fn !== 'function') {
    console.log(`${c.yellow}onSetOption not defined${c.reset}`);
    return;
  }

  // Try to parse as JSON, then number, then boolean, else string
  let value: unknown = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (!isNaN(Number(rawValue)) && rawValue !== '') value = Number(rawValue);
  else {
    try { value = JSON.parse(rawValue); } catch { /* keep as string */ }
  }

  try {
    fn({ name, value });
    console.log(`${c.green}Set ${name} = ${JSON.stringify(value)}${c.reset}`);
  } catch (e) {
    console.log(`${c.red}onSetOption error: ${e}${c.reset}`);
  }
}

function cmdState(G: G): void {
  // Try to get state via the bridge
  const stateApi = G.state as { get?: (key: string) => unknown } | undefined;
  // We read from the persistent state by checking known keys — or dump mock state
  const mockState = getMockState();
  // If using persistent state, we can't enumerate easily, so show mock state
  // The persistent state is synced via stateApi calls, but for display we use
  // a more direct approach
  if (Object.keys(mockState.state).length > 0) {
    console.log(prettyJson(mockState.state));
  } else {
    // Try calling stateApi.get with some common keys, or just note it's empty
    console.log(`${c.dim}(state is empty or using persistent storage — use state.get(key) in the skill)${c.reset}`);
  }
}

function cmdStore(G: G): void {
  const storeApi = G.store as {
    keys?: () => string[];
    get?: (key: string) => unknown;
  } | undefined;

  if (!storeApi?.keys || !storeApi?.get) {
    console.log(`${c.yellow}Store API not available${c.reset}`);
    return;
  }

  const keys = storeApi.keys();
  if (keys.length === 0) {
    console.log(`${c.dim}Store is empty${c.reset}`);
    return;
  }

  const data: Record<string, unknown> = {};
  for (const key of keys) {
    data[key] = storeApi.get(key);
  }
  console.log(prettyJson(data));
}

function cmdDb(G: G, sql: string): void {
  if (!sql) {
    console.log(`${c.red}Usage: db <sql-query>${c.reset}`);
    return;
  }

  const dbApi = G.db as {
    exec?: (sql: string, params: unknown[]) => void;
    all?: (sql: string, params: unknown[]) => Array<Record<string, unknown>>;
  } | undefined;

  if (!dbApi) {
    console.log(`${c.yellow}Database API not available${c.reset}`);
    return;
  }

  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  try {
    if (isSelect && dbApi.all) {
      const rows = dbApi.all(sql, []);
      if (rows.length === 0) {
        console.log(`${c.dim}(no rows returned)${c.reset}`);
      } else {
        console.log(prettyJson(rows));
      }
    } else if (dbApi.exec) {
      dbApi.exec(sql, []);
      console.log(`${c.green}SQL executed${c.reset}`);
    }
  } catch (e) {
    console.log(`${c.red}SQL error: ${e}${c.reset}`);
  }
}

function cmdMockFetch(rest: string): void {
  // Parse: <url> <status> <body>
  const parts = rest.split(/\s+/);
  if (parts.length < 3) {
    console.log(`${c.red}Usage: mock fetch <url> <status> <body>${c.reset}`);
    return;
  }
  const url = parts[0];
  const status = parseInt(parts[1], 10);
  const body = parts.slice(2).join(' ');

  if (isNaN(status)) {
    console.log(`${c.red}Status must be a number${c.reset}`);
    return;
  }

  mockFetchResponse(url, status, body);
  console.log(`${c.green}Mocked: ${url} -> ${status}${c.reset}`);
}

function cmdEnv(rest: string): void {
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx === -1) {
    console.log(`${c.red}Usage: env <key> <value>${c.reset}`);
    return;
  }
  const key = rest.substring(0, spaceIdx);
  const value = rest.substring(spaceIdx + 1).trim();
  setEnv(key, value);
  console.log(`${c.green}Set env ${key}${c.reset}`);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}                 Skill REPL (Interactive)                       ${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Parse CLI args
  const args = process.argv.slice(2);
  let skillId: string | undefined;
  let cleanFlag = false;

  for (const arg of args) {
    if (arg === '--clean') {
      cleanFlag = true;
    } else if (!arg.startsWith('-')) {
      skillId = arg;
    }
  }

  // If no skill specified, let user pick
  if (!skillId) {
    const skills = discoverSkills();
    if (skills.length === 0) {
      console.log(`${c.red}No compiled skills found. Run 'yarn build' first.${c.reset}`);
      rl.close();
      process.exit(1);
    }

    console.log(`\n${c.bold}Available skills:${c.reset}`);
    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      console.log(`  ${c.cyan}${i + 1}${c.reset}) ${c.bold}${s.manifest.name}${c.reset} ${c.dim}(${s.id})${c.reset}`);
      if (s.manifest.description) {
        console.log(`     ${c.dim}${s.manifest.description}${c.reset}`);
      }
    }

    while (!skillId) {
      const answer = await rl.question(`\n${c.cyan}Select skill (1-${skills.length}):${c.reset} `);
      const idx = parseInt(answer, 10);
      if (idx >= 1 && idx <= skills.length) {
        skillId = skills[idx - 1].id;
      } else {
        // Try by name
        const match = skills.find(s => s.id === answer.trim());
        if (match) {
          skillId = match.id;
        } else {
          console.log(`${c.red}Enter a number 1-${skills.length} or a skill id${c.reset}`);
        }
      }
    }
  }

  // Load the skill
  console.log(`\n${c.dim}Loading ${skillId}...${c.reset}`);
  let ctx: { G: G; manifest: Manifest; cleanup: () => void };
  try {
    ctx = await loadSkill(skillId, cleanFlag);
  } catch (e) {
    console.log(`${c.red}${e}${c.reset}`);
    rl.close();
    process.exit(1);
  }

  const toolCount = getTools(ctx.G).length;
  console.log(`${c.green}Loaded${c.reset} ${c.bold}${ctx.manifest.name}${c.reset} v${ctx.manifest.version}`);
  if (toolCount > 0) console.log(`${c.dim}  ${toolCount} tools available${c.reset}`);

  // Call init + start
  if (typeof ctx.G.init === 'function') {
    try {
      (ctx.G.init as () => void)();
      console.log(`${c.green}init()${c.reset} ok`);
    } catch (e) {
      console.log(`${c.red}init() error: ${e}${c.reset}`);
    }
  }
  if (typeof ctx.G.start === 'function') {
    try {
      (ctx.G.start as () => void)();
      console.log(`${c.green}start()${c.reset} ok`);
    } catch (e) {
      console.log(`${c.red}start() error: ${e}${c.reset}`);
    }
  }

  // Auto-detect setup needed
  if (
    ctx.manifest.setup?.required &&
    typeof ctx.G.onSetupStart === 'function'
  ) {
    const storeApi = ctx.G.store as { get?: (key: string) => unknown } | undefined;
    const config = storeApi?.get?.('config');
    if (!config) {
      console.log(`\n${c.yellow}Setup required but no config found.${c.reset}`);
      const answer = await rl.question(`${c.cyan}Run setup wizard? [Y/n]:${c.reset} `);
      if (answer === '' || answer.toLowerCase().startsWith('y')) {
        await runSetupWizard(ctx.G, rl);
      }
    }
  }

  // REPL loop
  console.log(`\n${c.dim}Type 'help' for commands.${c.reset}`);

  const prompt = `${c.cyan}${skillId}${c.reset}${c.dim}>${c.reset} `;
  let running = true;

  while (running) {
    let line: string;
    try {
      line = await rl.question(prompt);
    } catch {
      // EOF or error
      break;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    const [cmd, ...restParts] = trimmed.split(/\s+/);
    const rest = restParts.join(' ');

    try {
      switch (cmd.toLowerCase()) {
        case 'help':
        case '?':
          cmdHelp();
          break;

        case 'tools':
          cmdTools(ctx.G);
          break;

        case 'call':
          await cmdCall(ctx.G, rest, rl);
          break;

        case 'init':
          cmdLifecycle(ctx.G, 'init');
          break;

        case 'start':
          cmdLifecycle(ctx.G, 'start');
          break;

        case 'stop':
          cmdLifecycle(ctx.G, 'stop');
          break;

        case 'cron':
          cmdCron(ctx.G, rest);
          break;

        case 'session':
          cmdSession(ctx.G, rest);
          break;

        case 'setup':
          await runSetupWizard(ctx.G, rl);
          break;

        case 'options':
          cmdOptions(ctx.G);
          break;

        case 'option':
          cmdSetOption(ctx.G, rest);
          break;

        case 'state':
          cmdState(ctx.G);
          break;

        case 'store':
          cmdStore(ctx.G);
          break;

        case 'db':
          cmdDb(ctx.G, rest);
          break;

        case 'mock':
          if (rest.startsWith('fetch ')) {
            cmdMockFetch(rest.substring(6).trim());
          } else {
            console.log(`${c.red}Usage: mock fetch <url> <status> <body>${c.reset}`);
          }
          break;

        case 'env':
          cmdEnv(rest);
          break;

        case 'disconnect':
          cmdLifecycle(ctx.G, 'onDisconnect');
          break;

        case 'reload': {
          console.log(`${c.dim}Reloading...${c.reset}`);
          // Stop current skill
          if (typeof ctx.G.stop === 'function') {
            try { (ctx.G.stop as () => void)(); } catch { /* ignore */ }
          }
          ctx.cleanup();

          // Re-load
          try {
            ctx = await loadSkill(skillId!, false);
            const newToolCount = getTools(ctx.G).length;
            console.log(`${c.green}Reloaded${c.reset} ${c.bold}${ctx.manifest.name}${c.reset} v${ctx.manifest.version}`);
            if (newToolCount > 0) console.log(`${c.dim}  ${newToolCount} tools available${c.reset}`);

            if (typeof ctx.G.init === 'function') {
              (ctx.G.init as () => void)();
              console.log(`${c.green}init()${c.reset} ok`);
            }
            if (typeof ctx.G.start === 'function') {
              (ctx.G.start as () => void)();
              console.log(`${c.green}start()${c.reset} ok`);
            }
          } catch (e) {
            console.log(`${c.red}Reload failed: ${e}${c.reset}`);
          }
          break;
        }

        case 'exit':
        case 'quit':
        case '.exit':
          running = false;
          break;

        default:
          console.log(`${c.red}Unknown command: ${cmd}${c.reset}. Type 'help' for available commands.`);
      }
    } catch (e) {
      console.log(`${c.red}Error: ${e}${c.reset}`);
    }
  }

  // Clean exit
  console.log(`\n${c.dim}Shutting down...${c.reset}`);
  if (typeof ctx.G.stop === 'function') {
    try {
      (ctx.G.stop as () => void)();
      console.log(`${c.green}stop()${c.reset} ok`);
    } catch (e) {
      console.log(`${c.red}stop() error: ${e}${c.reset}`);
    }
  }
  ctx.cleanup();
  rl.close();
  console.log(`${c.dim}Bye!${c.reset}`);
}

main().catch(e => {
  console.error(`${c.red}Fatal: ${e}${c.reset}`);
  process.exit(1);
});
