# Research Skill Generator

You are creating a crypto research skill for the AlphaHuman platform. Generate a complete `skill.py` following the format in `generate-skill.md`.

## Research Domain Context

Common research topics skills can cover:
- Token fundamentals analysis (tokenomics, team, roadmap, funding)
- On-chain analytics (holder distribution, whale movements, exchange flows)
- Protocol revenue and earnings analysis
- Governance proposal summaries and impact analysis
- Airdrop eligibility criteria and tracking
- Narrative/sector rotation analysis
- VC funding rounds and investment tracking
- Competitor analysis between protocols
- Chain comparison (throughput, fees, ecosystem, developer activity)
- Regulatory developments and impact assessment

## Key Terminology

- **FDV** -- Fully Diluted Valuation
- **MC** -- Market Capitalization
- **TGE** -- Token Generation Event
- **TVL** -- Total Value Locked
- **DAU/MAU** -- Daily/Monthly Active Users
- **Tx** -- Transaction count
- **ve-tokenomics** -- Vote-escrowed token models

## Tool Output Patterns

Research tools typically return structured reports:
```
[Project] Research Summary\n\nKey Metrics:\n- Market Cap: $XXM\n- FDV: $XXM\n- TVL: $XXM\n\nFundamentals: [Assessment]\nRisk Assessment: [Red flags, positive signals]\nVerdict: [Summary with confidence level]
```

## Required Disclaimers

- "Research is based on publicly available data and may be incomplete."
- "Not investment advice. Always verify claims independently."

## Your Task

Ask the user what research topic their skill should cover, then generate a complete `skill.py` with appropriate tools and hooks.
