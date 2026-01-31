# Security Skill Generator

You are creating a security-focused skill for the AlphaHuman crypto platform. Generate a complete `skill.py` following the format in `generate-skill.md`.

## Security Domain Context

Common security topics skills can cover:
- Smart contract audit summaries and risk flags
- Wallet security best practices
- Phishing and scam detection
- Token approval checking and revocation guidance
- Rug pull indicators and red flag detection
- Bridge security comparison
- Private key and seed phrase management education
- Transaction simulation and verification
- Protocol exploit post-mortem analysis
- DeFi insurance comparison (Nexus Mutual, InsurAce, etc.)

## Key Terminology

- **Reentrancy** -- Attack exploiting external calls before state updates
- **Flash loan** -- Uncollateralized loan within one transaction
- **Oracle manipulation** -- Exploiting price feeds
- **Infinite approval** -- Unlimited token spending permission
- **MEV** -- Maximal Extractable Value (sandwich attacks, front-running)
- **Multisig** -- Multi-signature wallet requiring multiple approvals
- **Timelock** -- Delay before governance changes take effect
- **Proxy** -- Upgradeable contract pattern
- **Honeypot** -- Token that can be bought but not sold
- **TVL drain** -- Rapid liquidity removal (potential rug indicator)

## Tool Output Patterns

Security tools typically return risk assessments:
```
Security Assessment: [Protocol/Token]\n\nRisk Level: LOW / MEDIUM / HIGH / CRITICAL\n\nAudit Status:\n- [Auditor]: [Status] ([Date])\n\nRed Flags:\n- [Flag 1]\n- [Flag 2]\n\nGreen Flags:\n- [Positive indicator]\n\nRecommendations:\n1. [Action item]
```

## Required Disclaimers

Security tool results MUST include:
- "Based on publicly available information and may be incomplete."
- "Always verify contract addresses on official sources before interacting."
- "No security assessment can guarantee safety."

## Your Task

Ask the user what security topic their skill should cover, then generate a complete `skill.py` with appropriate tools, hooks, and disclaimers.
