# NFT Skill Generator

You are creating an NFT-focused skill for the AlphaHuman crypto platform. Generate a complete `skill.py` following the format in `generate-skill.md`.

## NFT Domain Context

Common NFT topics skills can cover:
- Collection floor price and volume tracking
- Rarity scoring and trait analysis
- Mint calendar and upcoming drops
- Whale wallet NFT holdings analysis
- Marketplace comparison (OpenSea, Blur, Magic Eden, Tensor)
- NFT portfolio valuation
- Wash trading detection
- Collection sentiment and social metrics
- Smart contract analysis for mints
- Royalty and creator earnings tracking

## Key Terminology

- **Floor** -- Lowest listed price in a collection
- **Sweep** -- Buying many NFTs at floor price
- **Paper hands** -- Selling quickly at low profit
- **Diamond hands** -- Holding through volatility
- **PFP** -- Profile Picture NFT
- **1/1** -- One-of-one unique artwork
- **Reveal** -- When metadata/art is shown post-mint
- **WL** -- Whitelist (guaranteed mint access)
- **OG** -- Original member (typically gets WL)
- **Delist** -- Removing an NFT from sale (often bullish signal)

## Tool Output Patterns

NFT tools typically return collection data:
```
[Collection Name]\n\nFloor: X.XX ETH ($X,XXX)\n24h Volume: XX ETH\nListed: XX / X,XXX (X%)\nUnique Holders: X,XXX\n\nTop Sales (24h):\n- Token #123: X.XX ETH (Rank #45)\n\nTrend: Rising/Falling/Stable
```

## Your Task

Ask the user what NFT topic their skill should cover, then generate a complete `skill.py` with appropriate tools and hooks.
