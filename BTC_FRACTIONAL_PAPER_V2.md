# Algo Trader — BTC-only fractional paper ledger (candidate)

This build is **paper simulation only**. It **never** places orders, connects a broker, or uses real funds. BTC trades 24/7, but Render Free does not stay awake 24/7.

## Included

- BTC/USD manually recorded long-only buys, eight-decimal fractional BTC quantities, planned stop and target and manual exit/mark prices.
- Separate simulated **$5,000 BTC cash account**, separate from the existing stock-style paper ledger. Existing PIN/login and stock records are not overwritten.
- Simulated fee of 0.10% per side, deducted from paper cash and included in realized/unrealized P&L.
- Server-enforced entry checks: 1 open position, 3 entries per UTC day, $2,500 / 50% of equity notional caps, 10% cash buffer, $50 / 1% equity stop-distance-plus-fees risk cap, $150/day realized-loss-plus-planned-risk ceiling, minimum 1.5R reward/risk, $10 min order.
- Historical BTC strategy comparison: 6 strategies compared against the same completed Kraken BTC/USD candles and buy-and-hold benchmark, with common 0.10% fee + 0.05% slippage assumptions.
- Cloud-first UI landing on BTC paper ledger. Old stock tabs remain accessible for data preservation.

## Verification

Local Python unit and API suite: **60/60 pass**. JavaScript syntax check passes. Historical strategy simulations never update any paper portfolio.

**Limitations:** Stop and target prices are only plans; there is no automated stop execution, no 24/7 scheduler, no live BTC price stream, and no real trading. Manual marks are not exchange prices. BTC paper tables are intentionally **not** included in the legacy stock JSON backup/restore, so no automatic cloud backups are claimed.

Next rollout gate: deploy on existing isolated Neon preview, verify startup and PostgreSQL tables while leaving original live URL unchanged. Confirm manual BTC open/close and restart persistence as a separate acceptance step. Do not promote to main until online migration and backup strategy are verified.
