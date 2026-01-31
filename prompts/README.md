# Prompt Templates for Skill Creation

These prompts help **non-coders** create AlphaHuman skills using AI assistants (ChatGPT, Claude, etc.). No deep programming knowledge required — the prompts guide you through generating a complete `skill.py`.

## How to Use

1. **Pick a starting prompt**:
   - `generate-skill.md` -- General-purpose skill generator
   - `categories/<topic>.md` -- Domain-specific generators (DeFi, trading, research, etc.)

2. **Copy the prompt** into your favorite AI assistant (ChatGPT, Claude, etc.)

3. **Describe your skill idea** when the AI asks for it

4. **Get a complete `skill.py`** generated and ready to use

5. **Refine if needed** -- Use `refine-skill.md` to improve an existing skill

## Available Prompts

| File                      | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `generate-skill.md`       | Master prompt -- generates any skill from a description |
| `refine-skill.md`         | Improve an existing skill.py               |
| `categories/defi.md`      | DeFi-focused skill generator               |
| `categories/trading.md`   | Trading & technical analysis skills        |
| `categories/research.md`  | Crypto research & analysis skills          |
| `categories/community.md` | Community management skills                |
| `categories/nft.md`       | NFT-focused skills                         |
| `categories/security.md`  | Security & risk assessment skills          |

## What You Get

Each prompt generates a complete `skill.py` file containing:
- A `SkillDefinition` with name, description, and version
- Lifecycle hooks (`on_load`, `on_tick`, etc.)
- Custom AI tools with JSON Schema parameters and async handlers
- Optional setup flow for API keys or credentials

## Tips

- Be specific about what you want the skill to do
- Include example scenarios in your description
- Mention any specific tokens, chains, or protocols
- The more detail you provide, the better the generated skill
