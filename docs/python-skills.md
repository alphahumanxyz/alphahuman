# Python Skills

How the Python skill runtime works.

## Overview

Skills are Python modules that communicate with the AlphaHuman host over stdin/stdout using JSON-RPC 2.0. The `SkillServer` class in `dev/runtime/server.py` handles all protocol details automatically.

## Skill Structure

```
my-skill/
├── skill.py          # Required: SkillDefinition export
├── setup.py          # Optional: interactive setup flow
├── manifest.json     # Optional: runtime metadata
├── requirements.txt  # Optional: Python dependencies
├── handlers/         # Optional: tool handler functions
├── client/           # Optional: API client wrappers
├── state/            # Optional: in-process state management
├── db/               # Optional: SQLite persistence
└── data/             # Auto-created persistent storage
```

## JSON-RPC Protocol

All messages are single-line JSON objects following JSON-RPC 2.0 over stdin/stdout.

### Request (Host -> Skill)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {}
}
```

### Response (Skill -> Host)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Methods

### `tools/list`

Return all tool definitions.

**Response**:
```json
{
  "tools": [
    {
      "name": "my_tool",
      "description": "Tool description",
      "inputSchema": {
        "type": "object",
        "properties": {
          "input": {"type": "string"}
        },
        "required": ["input"]
      }
    }
  ]
}
```

### `tools/call`

Execute a tool.

**Request**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "my_tool",
    "arguments": {"input": "hello"}
  }
}
```

**Response**:
```json
{
  "result": {
    "content": [{"type": "text", "text": "Tool result text"}],
    "isError": false
  }
}
```

### Lifecycle Methods

| Method                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `skill/load`           | Initialize skill (receives manifest, dataDir) |
| `skill/unload`         | Clean shutdown                           |
| `skill/sessionStart`   | Session started (params: `{sessionId}`)  |
| `skill/sessionEnd`     | Session ended (params: `{sessionId}`)    |
| `skill/beforeMessage`  | Transform user message                   |
| `skill/afterResponse`  | Transform AI response                    |
| `skill/tick`           | Periodic tick                            |
| `skill/shutdown`       | Process exit                             |

### Setup Methods

| Method           | Description                            |
| ---------------- | -------------------------------------- |
| `setup/start`    | Begin setup, returns first SetupStep   |
| `setup/submit`   | Submit step values, returns SetupResult |
| `setup/cancel`   | Cancel setup, clean up                 |

### Reverse RPC (Skill -> Host)

Skills can call back to the host for state and data:

| Method                   | Purpose                       |
| ------------------------ | ----------------------------- |
| `state/get`              | Read skill state              |
| `state/set`              | Update skill state            |
| `data/read`              | Read from data directory      |
| `data/write`             | Write to data directory       |
| `intelligence/emitEvent` | Emit event for rules          |
| `entities/upsert`        | Create/update an entity       |
| `entities/search`        | Search entity graph           |

## Using SkillServer

The recommended way to build a skill is using the `SkillServer` class, which handles all JSON-RPC protocol details:

```python
from dev.runtime.server import SkillServer
from dev.types.skill_types import SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult

async def on_load(ctx):
    ctx.log("Loaded")

async def my_tool(args):
    return ToolResult(content=f"Result: {args.get('input', '')}")

skill = SkillDefinition(
    name="my-skill",
    description="Example skill",
    version="1.0.0",
    hooks=SkillHooks(on_load=on_load),
    tools=[
        SkillTool(
            definition=ToolDefinition(
                name="my_tool",
                description="Example tool",
                parameters={
                    "type": "object",
                    "properties": {"input": {"type": "string"}},
                    "required": ["input"],
                },
            ),
            execute=my_tool,
        ),
    ],
)

if __name__ == "__main__":
    server = SkillServer(skill)
    server.start()
```

## Logging

Use `ctx.log()` or write directly to stderr. Stdout is reserved for JSON-RPC.

```python
import sys

# Via context
ctx.log("Debug message")

# Direct stderr (outside hooks)
sys.stderr.write("[skill] message\n")
sys.stderr.flush()
```

## Testing

### Manual JSON-RPC testing

```bash
python3 skill.py
# Paste JSON-RPC requests:
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"my_tool","arguments":{"input":"test"}}}
{"jsonrpc":"2.0","id":3,"method":"skill/shutdown","params":{}}
```

### Using the test harness

```bash
python -m dev.harness.runner skills/my-skill --verbose
```

### Interactive setup flow

```bash
python test-setup.py skills/my-skill
```

### Interactive server REPL

```bash
python test-server.py
```

## Manifest Format

Optional `manifest.json` for runtime metadata:

```json
{
  "id": "my-skill",
  "name": "My Skill",
  "description": "What this skill does",
  "version": "1.0.0",
  "runtime": {
    "type": "subprocess",
    "command": "python3",
    "args": ["skill.py"]
  },
  "dependencies": [],
  "env": ["MY_API_KEY"],
  "setup": {
    "required": true,
    "label": "Connect My Service"
  }
}
```
