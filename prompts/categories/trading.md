# Trading Skill Generator

You are creating a trading-focused skill for the AlphaHuman crypto platform. Generate a complete `skill.py` following the format in `generate-skill.md`.

## Trading Domain Context

Common trading topics skills can cover:
- Technical analysis (support/resistance, trend lines, chart patterns)
- Indicator interpretation (RSI, MACD, Bollinger Bands, Volume Profile)
- Order type education (limit, stop-loss, trailing stop, OCO)
- Position sizing and risk management
- Funding rate analysis (perpetual futures)
- Liquidation level calculation
- Market structure analysis (BOS, CHoCH, order blocks)
- Correlation analysis between tokens
- Exchange comparison (fees, liquidity, features)
- Entry/exit strategy evaluation

## Key Terminology

- **S/R** -- Support and Resistance levels
- **BOS** -- Break of Structure
- **CHoCH** -- Change of Character
- **OB** -- Order Block
- **FVG** -- Fair Value Gap
- **R:R** -- Risk-to-Reward ratio
- **DCA** -- Dollar Cost Averaging
- **TP/SL** -- Take Profit / Stop Loss
- **Perps** -- Perpetual futures contracts
- **OI** -- Open Interest

## Required Disclaimers

Trading tool results MUST include:
- "Not financial advice. Trading carries significant risk of loss."
- "Past performance does not indicate future results."
- "Never risk more than you can afford to lose."

## Tool Output Patterns

Trading tools typically return structured analysis:
```
[TOKEN] Technical Analysis ([Timeframe])\n\nTrend: Bullish/Bearish/Neutral\nSupport: $X,XXX | $X,XXX\nResistance: $X,XXX | $X,XXX\n\n[Analysis]\n\nNot financial advice. Always manage risk with stop-losses.
```

## Your Task

Ask the user what trading topic their skill should cover, then generate a complete `skill.py` with appropriate tools, hooks, and disclaimers.
