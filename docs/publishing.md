# Publishing a Skill

How to submit your skill to the AlphaHuman Skills repository.

## Prerequisites

1. Your skill passes validation: `python -m dev.validate.validator`
2. Your skill passes the security scan: `python -m dev.security.scan_secrets`
3. The test harness runs without errors: `python -m dev.harness.runner skills/my-skill --verbose`
4. If `has_setup=True`, setup flow works: `python test-setup.py skills/my-skill`

## Step 1: Fork & Branch

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR-USERNAME/alphahuman-skills.git
cd alphahuman-skills
git checkout -b skill/my-skill-name
```

## Step 2: Create Your Skill

Use the scaffolder or create files manually:

```bash
pip install -e dev/
python -m dev.scaffold.new_skill my-skill-name
```

Or manually:
```bash
mkdir skills/my-skill-name
# Create skill.py (and optionally setup.py, manifest.json)
```

## Step 3: Validate

```bash
# Structure and type checks
python -m dev.validate.validator

# Security scan
python -m dev.security.scan_secrets

# Test harness (runs hooks + tools with mock context)
python -m dev.harness.runner skills/my-skill-name --verbose

# Test setup flow interactively (if has_setup=True)
python test-setup.py skills/my-skill-name

# Interactive server REPL (browse and call tools live)
python test-server.py
```

## Step 4: Submit PR

```bash
git add skills/my-skill-name/
git commit -m "Add my-skill-name skill"
git push -u origin skill/my-skill-name
```

Open a pull request on GitHub. The PR template will guide you through the submission checklist.

## What Happens Next

1. **CI runs automatically** -- validates structure, types, security, and runs the test harness
2. **Maintainer review** -- a human reviews the skill for quality and safety
3. **Feedback** -- you may get requests for changes
4. **Merge** -- once approved, the skill is available to all AlphaHuman users

## Naming Conventions

| Rule             | Example            | Counter-example        |
| ---------------- | ------------------ | ---------------------- |
| Lowercase only   | `price-tracker`    | `Price-Tracker`        |
| Hyphens for spaces | `on-chain-lookup` | `on_chain_lookup`      |
| Descriptive      | `whale-watcher`    | `ww`                   |
| No prefixes      | `price-tracker`    | `skill-price-tracker`  |
| Match directory  | `name: price-tracker` in `skills/price-tracker/` | Mismatch |

## Required Files

| File            | Required? | Description                                         |
| --------------- | --------- | --------------------------------------------------- |
| `skill.py`      | Yes       | Python module exporting a `SkillDefinition`         |
| `setup.py`      | No        | Interactive setup flow for configuration wizards    |
| `manifest.json` | No        | Runtime metadata (dependencies, env vars, setup)    |

## skill.py Requirements

- Exports a `skill` variable of type `SkillDefinition`
- `name` matches directory name (lowercase-hyphens)
- `version` follows semver (X.Y.Z)
- Hooks are async functions
- Tools have valid JSON Schema parameters
- Tools return `ToolResult(content=...)`
- `tick_interval` >= 1000ms if set

## setup.py Requirements (if present)

- Exports `on_setup_start`, `on_setup_submit`, and optionally `on_setup_cancel`
- `has_setup=True` must be set in the SkillDefinition
- Each step validates server-side (e.g., test API connection, not just format check)
- On completion, persist config via `ctx.write_data("config.json", ...)`
- Handle cancel gracefully -- clean up connections and transient state

## Common Rejection Reasons

1. **Missing skill.py** -- every skill needs a `skill.py` with a `skill` export
2. **Hardcoded secrets** -- API keys, tokens, private keys in code
3. **Dangerous code** -- `eval()`, `exec()`, dynamic imports from user input
4. **Name mismatch** -- directory name must match skill.py name
5. **Failing validation** -- `python -m dev.validate.validator` must pass
6. **Security issues** -- `python -m dev.security.scan_secrets` must not report errors
7. **Broken setup flow** -- if `has_setup=True`, setup hooks must work correctly
8. **Missing disclaimers** -- financial/trading skills need appropriate warnings

## Updating an Existing Skill

1. Make changes on a new branch
2. Bump the `version` in skill.py
3. Submit a PR with clear description of what changed
4. CI validates the updated skill
