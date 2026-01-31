# Getting Started

Build your first AlphaHuman skill.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) or pip
- Git

## 1. Clone the Repository

```bash
git clone https://github.com/your-org/alphahuman-skills.git
cd alphahuman-skills
```

## 2. Install Dev Tools

```bash
pip install -e dev/

# or with uv:
uv venv .venv && source .venv/bin/activate && uv pip install -e dev/
```

## 3. Create a Skill

### Option A: Interactive Scaffolder

```bash
python -m dev.scaffold.new_skill my-skill
```

Follow the prompts to name your skill and choose features.

### Option B: Manual Copy

```bash
cp -r examples/tool-skill/ skills/my-skill/
```

## 4. Write skill.py

This is the core of your skill. Every skill needs a `skill.py` that exports a `skill` variable:

```python
from dev.types.skill_types import (
    SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult,
)

async def on_load(ctx):
    ctx.log("Skill loaded")

async def my_tool_execute(args):
    input_val = args.get("input", "")
    return ToolResult(content=f"Result: {input_val}")

skill = SkillDefinition(
    name="my-skill",
    description="What this skill does",
    version="1.0.0",
    hooks=SkillHooks(
        on_load=on_load,
    ),
    tools=[
        SkillTool(
            definition=ToolDefinition(
                name="my_tool",
                description="What the tool does",
                parameters={
                    "type": "object",
                    "properties": {
                        "input": {"type": "string", "description": "Input value"},
                    },
                    "required": ["input"],
                },
            ),
            execute=my_tool_execute,
        ),
    ],
)
```

## 5. (Optional) Add setup.py

If your skill needs interactive configuration (API keys, auth flows), add a `setup.py`:

```python
from dev.types.setup_types import SetupStep, SetupField, SetupResult, SetupFieldError

async def on_setup_start(ctx):
    return SetupStep(
        id="credentials",
        title="API Credentials",
        fields=[
            SetupField(name="api_key", type="password", label="API Key", required=True),
        ],
    )

async def on_setup_submit(ctx, step_id, values):
    if not values.get("api_key"):
        return SetupResult(
            status="error",
            errors=[SetupFieldError(field="api_key", message="Required")],
        )
    await ctx.write_data("config.json", json.dumps({"api_key": values["api_key"]}))
    return SetupResult(status="complete", message="Connected!")

async def on_setup_cancel(ctx):
    pass
```

Set `has_setup=True` in your `SkillDefinition`.

## 6. Test Your Skill

### Validate structure

```bash
python -m dev.validate.validator
```

### Run the test harness

```bash
python -m dev.harness.runner skills/my-skill --verbose
```

### Test setup flow interactively

```bash
python test-setup.py skills/my-skill
```

### Security scan

```bash
python -m dev.security.scan_secrets
```

### Interactive server REPL (for skills with tools)

```bash
python test-server.py
```

## 7. Submit a Pull Request

```bash
git checkout -b skill/my-skill
git add skills/my-skill/
git commit -m "Add my-skill"
git push -u origin skill/my-skill
```

Open a pull request. CI will automatically validate your skill.

## Next Steps

- [Architecture](./architecture.md) -- How the skill system works
- [API Reference](./api-reference.md) -- SkillContext, hooks, tools
- [Lifecycle](./lifecycle.md) -- Hook timing and execution order
- [Testing](./testing.md) -- Test harness deep dive
- [Publishing](./publishing.md) -- PR workflow and requirements
