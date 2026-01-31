# Lifecycle Hooks

Detailed reference for skill lifecycle hooks, execution order, and timeout behavior.

## Execution Order

```
App Startup
    |
    v
  on_load          <- Skill is loaded (once per app launch)
    |
    v
+-----------------------------------------------------+
| Session Loop (repeats per chat session)              |
|                                                      |
|   on_session_start     <- New session begins         |
|       |                                              |
|   +---+---------------------------------------------+
|   | Message Loop (repeats per message)               |
|   |                                                  |
|   |   on_before_message   <- User sends message      |
|   |       |                                          |
|   |   [AI processes message with skill tools]        |
|   |       |                                          |
|   |   on_after_response   <- AI generates response   |
|   |                                                  |
|   +--------------------------------------------------+
|                                                      |
|   on_memory_flush        <- Memory compaction event  |
|                                                      |
|   on_session_end         <- Session ends             |
|                                                      |
+------------------------------------------------------+
    |
    v                    +--------------+
  on_unload    <- App    |   on_tick    | <- Runs independently
                shutdown | (periodic)   |   every tick_interval ms
                         +--------------+
```

## Hook Reference

### on_load

```python
async def on_load(ctx: SkillContext) -> None
```

Called once when the skill is loaded at app startup.

**Common uses**:
- Load cached data from `ctx.read_data()`
- Initialize state via `ctx.set_state()`
- Log startup diagnostics

**Example**:
```python
async def on_load(ctx):
    try:
        data = await ctx.read_data("cache.json")
        ctx.set_state(json.loads(data))
        ctx.log("Cache loaded")
    except Exception:
        ctx.log("No cache, starting fresh")
```

### on_unload

```python
async def on_unload(ctx: SkillContext) -> None
```

Called when the app shuts down or the skill is manually unloaded.

**Common uses**:
- Persist state to data directory
- Clean up resources (close connections, etc.)

**Example**:
```python
async def on_unload(ctx):
    state = ctx.get_state()
    await ctx.write_data("cache.json", json.dumps(state))
```

### on_session_start

```python
async def on_session_start(ctx: SkillContext, session_id: str) -> None
```

Called when a new chat session begins.

**Common uses**:
- Report cached data to the user
- Load session-specific preferences
- Reset session counters

### on_session_end

```python
async def on_session_end(ctx: SkillContext, session_id: str) -> None
```

Called when a chat session ends.

**Common uses**:
- Save session summary
- Clean up session-scoped resources

### on_before_message

```python
async def on_before_message(ctx: SkillContext, message: str) -> str | None
```

Called before the AI processes a user message. **Can transform the message.**

- Return a `str` to replace the message the AI sees
- Return `None` to pass the original message through

**Example**:
```python
async def on_before_message(ctx, message):
    # Detect and annotate wallet addresses
    if "0x" in message:
        return f"[Context: message contains wallet address]\n\n{message}"
    # Return None to pass through unchanged
```

### on_after_response

```python
async def on_after_response(ctx: SkillContext, response: str) -> str | None
```

Called after the AI generates a response. **Can transform the response.**

- Return a `str` to replace the response shown to the user
- Return `None` to pass the original response through

**Example**:
```python
async def on_after_response(ctx, response):
    if "price" in response or "invest" in response:
        return response + "\n\n*Not financial advice. DYOR.*"
```

### on_memory_flush

```python
async def on_memory_flush(ctx: SkillContext) -> None
```

Called before memory compaction. Use this to persist important data before memory is compressed.

### on_tick

```python
async def on_tick(ctx: SkillContext) -> None
```

Called periodically based on `tick_interval`. Runs independently of user interactions.

**Requires**: `tick_interval` set in SkillDefinition (minimum 1000ms).

**Example**:
```python
async def on_tick(ctx):
    data = await ctx.read_data("alerts.json")
    alerts = json.loads(data)
    for alert in alerts:
        ctx.log(f"Checking alert for {alert['token']}")
```

### Setup Hooks

See the [Setup Flow section in the README](../README.md#setup-flow-optional) for details on `on_setup_start`, `on_setup_submit`, and `on_setup_cancel`.

## Timeout Behavior

**All hooks have a 10-second timeout.** If a hook doesn't resolve within 10 seconds, the runtime:

1. Logs a timeout warning
2. Continues execution (does not crash the app)
3. The hook's return value is ignored

This means:
- Don't make long-running API calls in hooks
- Don't do heavy computation
- If you need more time, cache partial results and continue in the next tick

## Transform Hook Ordering

If multiple skills define `on_before_message` or `on_after_response`, they run in skill load order. Each skill's transform feeds into the next:

```
User Message -> Skill A on_before_message -> Skill B on_before_message -> AI

AI Response -> Skill A on_after_response -> Skill B on_after_response -> User
```

## Error Handling

If a hook throws an error:
1. The error is logged
2. The hook is treated as if it returned `None`
3. Other skills' hooks continue to run
4. The app does not crash

Always use try/except for operations that might fail (file reads, JSON parsing).
