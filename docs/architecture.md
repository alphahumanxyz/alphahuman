# Architecture

How the AlphaHuman skill system works.

## Overview

Skills extend the AlphaHuman AI agent with domain-specific capabilities. Each skill is a Python directory with a `skill.py` module that exports a `SkillDefinition`.

```
skills/
├── my-skill/
│   ├── skill.py          # Required: SkillDefinition with hooks + tools
│   ├── setup.py          # Optional: interactive setup flow
│   ├── manifest.json     # Optional: runtime metadata
│   └── data/             # Auto-created persistent storage
```

## Skill Structure

Every skill must have a `skill.py` that exports a `skill` variable of type `SkillDefinition`. Skills can optionally include:

- **setup.py** for interactive configuration wizards (API keys, auth flows)
- **manifest.json** for runtime metadata (dependencies, env vars, setup config)
- **Additional Python modules** for handlers, clients, state, etc.

## Loading Pipeline

```
1. Runtime scans skills/ directories
2. For each directory with skill.py:
   a. Import skill.py
   b. Read the `skill` export (SkillDefinition)
   c. Register hooks, tools, tick interval
   d. If has_setup=True, register setup handlers
3. Route tool calls to skill's execute functions
4. Dispatch lifecycle events to hooks
```

## Skill Isolation

Each skill operates in isolation:

- **Data directory**: Each skill gets its own `data/` directory. Skills cannot access other skills' data.
- **Tools**: Each skill's tools are namespaced. No collisions.
- **State**: Each skill has its own state store via `get_state()`/`set_state()`.
- **No cross-imports**: Skills should not import from other skills.

## Runtime Context

Every hook receives a `SkillContext` object, the skill's interface to the platform:

```
SkillContext
├── memory       -> Read/write/search shared memory
├── session      -> Current session ID and session-scoped data
├── tools        -> Register/unregister tools at runtime
├── entities     -> Query the entity graph (contacts, wallets, chats)
├── data_dir     -> Path to skill's data directory
├── read_data()  -> Read file from data directory
├── write_data() -> Write file to data directory
├── log()        -> Debug logging
├── get_state()  -> Read skill state store
├── set_state()  -> Write skill state store
└── emit_event() -> Emit events for intelligence rules
```

## Message Flow

```
User Message
    |
    v
on_before_message --- (skill can transform message) --> Transformed Message
    |                                                        |
    v                                                        v
AI Processes Message <------------------------------ AI Context
    |                                                (tool definitions
    |                                                 from skill.tools)
    v
AI Response
    |
    v
on_after_response --- (skill can transform response) --> Final Response
    |
    v
Shown to User
```

## JSON-RPC 2.0 Protocol

Skills communicate with the AlphaHuman host over stdin/stdout using JSON-RPC 2.0. The `SkillServer` class in `dev/runtime/server.py` handles this automatically.

### Methods (Host -> Skill)

| Method               | Purpose                            |
| -------------------- | ---------------------------------- |
| `tools/list`         | List available tools               |
| `tools/call`         | Execute a tool                     |
| `skill/load`         | Initialize skill                   |
| `skill/unload`       | Clean shutdown                     |
| `skill/sessionStart` | New session began                  |
| `skill/sessionEnd`   | Session ended                      |
| `skill/beforeMessage` | Transform user message            |
| `skill/afterResponse` | Transform AI response             |
| `skill/tick`         | Periodic tick                      |
| `setup/start`        | Begin setup flow                   |
| `setup/submit`       | Submit setup step values           |
| `setup/cancel`       | Cancel setup                       |

### Reverse RPC (Skill -> Host)

Skills can call back to the host for state management:

| Method                  | Purpose                       |
| ----------------------- | ----------------------------- |
| `state/get`             | Read skill state              |
| `state/set`             | Update skill state            |
| `data/read`             | Read from data directory      |
| `data/write`            | Write to data directory       |
| `intelligence/emitEvent` | Emit event for rules         |
| `entities/upsert`       | Create/update an entity       |
| `entities/search`       | Search entity graph           |

## Periodic Tasks

Skills with `tick_interval` set get `on_tick` called periodically:

```
on_tick -> (runs every tick_interval ms)
           minimum: 1000ms
           typical: 60_000ms (1 minute)
```

Ticks run independently of user interactions. Use them for background monitoring (price alerts, chat monitoring, etc.).

## Data Persistence

Skills persist data using `ctx.read_data()` and `ctx.write_data()`:

```python
# Save
await ctx.write_data("alerts.json", json.dumps(alerts))

# Load
data = await ctx.read_data("alerts.json")
alerts = json.loads(data)
```

Files are stored in the skill's `data/` directory. The runtime creates this directory automatically. Common pattern: load state in `on_load`, save state in `on_unload` or after modifications.

## Setup Flow

Skills with `has_setup=True` define an interactive configuration wizard. The host renders multi-step forms and the skill validates each step server-side.

```
Host                          Skill
 |                              |
 |-- setup/start -------------->|
 |<-- SetupStep (fields) -------|
 |                              |
 |-- setup/submit (values) ---->|
 |<-- SetupResult --------------|
 |   (next | error | complete)  |
```

Setup state is transient (module-level). If the process restarts mid-setup, the user must restart the flow.

## Type System

Types are imported from `dev.types.skill_types`:

```python
from dev.types.skill_types import SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupStep, SetupField, SetupResult, SetupFieldError
```

All types are Pydantic v2 models with validation and serialization built in.
