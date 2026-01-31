# API Reference

Complete reference for the AlphaHuman skill type system. All types are defined in `dev/types/skill_types.py` and `dev/types/setup_types.py` using Pydantic v2.

## SkillDefinition

The `skill` variable exported by `skill.py`.

```python
from dev.types.skill_types import SkillDefinition

class SkillDefinition(BaseModel):
    name: str           # Must match directory name (lowercase-hyphens)
    description: str    # Brief description
    version: str        # Semver (e.g., "1.0.0")
    hooks: SkillHooks | None    # Lifecycle hooks
    tools: list[SkillTool]      # Custom AI tools (default: [])
    tick_interval: int | None   # Periodic tick interval in ms (min: 1000)
    has_setup: bool             # Whether skill has an interactive setup flow (default: False)
```

## SkillContext

Passed to every hook function. The skill's interface to the platform.

### Properties

| Property   | Type             | Description                      |
| ---------- | ---------------- | -------------------------------- |
| `memory`   | `MemoryManager`  | Shared memory system             |
| `session`  | `SessionManager` | Current session                  |
| `tools`    | `ToolRegistry`   | Runtime tool registration        |
| `entities` | `EntityManager`  | Platform entity graph            |
| `data_dir` | `str`            | Path to skill's data directory   |

### Methods

#### `read_data(filename: str) -> str`

Read a file from the skill's `data/` directory.

```python
data = await ctx.read_data("config.json")
config = json.loads(data)
```

Raises if file doesn't exist. Wrap in try/except for optional files.

#### `write_data(filename: str, content: str) -> None`

Write a file to the skill's `data/` directory.

```python
await ctx.write_data("config.json", json.dumps(config, indent=2))
```

Creates the file if it doesn't exist, overwrites if it does.

#### `log(message: str) -> None`

Log a debug message.

```python
ctx.log("Processing 5 alerts")
```

#### `get_state() -> Any`

Read the skill's in-memory state store.

```python
state = ctx.get_state()
counter = state.get("counter", 0)
```

#### `set_state(partial: dict) -> None`

Merge values into the skill's state store.

```python
ctx.set_state({"counter": counter + 1})
```

#### `emit_event(event_name: str, data: Any) -> None`

Emit an event for intelligence rules to react to.

```python
ctx.emit_event("price-alert-triggered", {"token": "ETH", "price": 4000})
```

## MemoryManager

Read/write the shared memory system (persists across sessions).

```python
class MemoryManager(Protocol):
    async def read(self, name: str) -> str | None: ...
    async def write(self, name: str, content: str) -> None: ...
    async def search(self, query: str) -> list[dict[str, str]]: ...
    async def list(self) -> list[str]: ...
    async def delete(self, name: str) -> None: ...
```

### Example

```python
# Store a user preference
await ctx.memory.write("user-prefs", json.dumps({"currency": "EUR"}))

# Search memory
results = await ctx.memory.search("ethereum")
# [{"name": "notes.md", "excerpt": "...ethereum price was..."}]
```

## SessionManager

Session-scoped data (lost when session ends).

```python
class SessionManager(Protocol):
    @property
    def id(self) -> str: ...
    def get(self, key: str) -> Any: ...
    def set(self, key: str, value: Any) -> None: ...
```

### Example

```python
# Track per-session state
ctx.session.set("queries_this_session", 0)
count = ctx.session.get("queries_this_session") or 0
ctx.session.set("queries_this_session", count + 1)
```

## ToolRegistry

Register/unregister tools at runtime (beyond the static `tools` list).

```python
class ToolRegistry(Protocol):
    def register(self, tool: SkillTool) -> None: ...
    def unregister(self, name: str) -> None: ...
    def list(self) -> list[str]: ...
```

### Example

```python
# Dynamically add a tool based on session state
ctx.tools.register(SkillTool(
    definition=ToolDefinition(
        name="dynamic_tool",
        description="A tool added at runtime",
        parameters={"type": "object", "properties": {}, "required": []},
    ),
    execute=my_handler,
))
```

## EntityManager

Query the platform's entity graph (contacts, wallets, chats).

```python
class EntityManager(Protocol):
    async def get_by_tag(self, tag: str, type: str | None = None) -> list[Entity]: ...
    async def get_by_id(self, id: str) -> Entity | None: ...
    async def search(self, query: str) -> list[Entity]: ...

class Entity(BaseModel):
    id: str
    type: str
    name: str
    tags: list[str]
    metadata: dict[str, Any]
```

### Example

```python
# Find watched wallets
wallets = await ctx.entities.get_by_tag("watched-wallet", "wallet")
for w in wallets:
    ctx.log(f"Watching: {w.name} ({w.metadata.get('chain')})")
```

## SkillTool

Custom tools that the AI can call.

```python
class ToolDefinition(BaseModel):
    name: str                      # snake_case tool name
    description: str               # What the tool does
    parameters: dict[str, Any]     # JSON Schema for parameters

class ToolResult(BaseModel):
    content: str       # Result text
    is_error: bool     # True if execution failed (default: False)

class SkillTool(BaseModel):
    definition: ToolDefinition
    execute: Callable[..., Awaitable[ToolResult]]
```

### Parameter Schema

Tool parameters use JSON Schema. Common property types:

```python
# String
{"type": "string", "description": "Token symbol"}

# String with choices
{"type": "string", "enum": ["above", "below"], "description": "Direction"}

# Number
{"type": "number", "description": "Price in USD"}

# Boolean
{"type": "boolean", "description": "Include historical data"}

# Array
{"type": "array", "items": {"type": "string"}, "description": "Token list"}
```

## SkillHooks

Lifecycle hooks, all optional, all async.

```python
class SkillHooks(BaseModel):
    on_load: LoadHook | None              # async (ctx) -> None
    on_unload: UnloadHook | None          # async (ctx) -> None
    on_session_start: SessionHook | None  # async (ctx, session_id) -> None
    on_session_end: SessionHook | None    # async (ctx, session_id) -> None
    on_before_message: MessageHook | None # async (ctx, message) -> str | None
    on_after_response: MessageHook | None # async (ctx, response) -> str | None
    on_memory_flush: LoadHook | None      # async (ctx) -> None
    on_tick: TickHook | None              # async (ctx) -> None
    on_setup_start: SetupStartHandler | None    # async (ctx) -> SetupStep
    on_setup_submit: SetupSubmitHandler | None  # async (ctx, step_id, values) -> SetupResult
    on_setup_cancel: SetupCancelHandler | None  # async (ctx) -> None
```

See [Lifecycle](./lifecycle.md) for detailed hook timing and behavior.

## Setup Types

Types for the interactive setup flow. Defined in `dev/types/setup_types.py`.

```python
class SetupField(BaseModel):
    name: str
    type: Literal["text", "number", "password", "select", "multiselect", "boolean"]
    label: str
    description: str | None
    required: bool          # default: True
    default: str | float | bool | list[str] | None
    placeholder: str | None
    options: list[SetupFieldOption] | None  # for select/multiselect

class SetupStep(BaseModel):
    id: str
    title: str
    description: str | None
    fields: list[SetupField]

class SetupResult(BaseModel):
    status: Literal["next", "error", "complete"]
    next_step: SetupStep | None
    errors: list[SetupFieldError] | None
    message: str | None

class SetupFieldError(BaseModel):
    field: str
    message: str
```

See [Setup Flow section in README](../README.md#setup-flow-optional) for usage examples.
