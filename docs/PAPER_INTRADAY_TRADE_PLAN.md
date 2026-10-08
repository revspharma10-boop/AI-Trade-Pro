# ₹50,000 Paper Intraday Trade Plan: Entry, SL, Targets, Lots

## Scope
The AI Trade Pro frontend now shows a research-only entry / stop-loss / target / lot
calculator on qualifying provisional BUY and SELL research signals. It is **not** a
trade instruction or order preview. All production real order routes remain absent,
and the approved/executable lot count is hard-locked to **0**.

Current configured capital: **₹50,000**. Conservative risk *budget*:
**₹500 = 1% of ₹50,000**. This is a planning limit, **not a guaranteed maximum loss**:
market gaps, spreads, brokerage, tax, adverse fills and slippage can cause actual
losses to exceed the calculated amount.

### Signal prerequisites
- Fresh completed intraday candles and qualifying BUY/SELL paper-research direction.
- Valid exact symbol, expiry, live quote, bid/ask, last actual trade time and ATR.
- Equity and futures supported for this calculator. Options must remain unqualified
  because risk, multiplier, premium and Greeks require a separate sizing engine.
- No entry/SL/targets are produced for WAIT signals or stale/unverifiable evidence.

### Hypothetical price levels
- BUY: entry from current ask rounded **up** to valid price tick; SL at least
  **1.5 × ATR(14)** below entry, rounded farther away; targets at **1.5R/2R** above entry.
- SELL: entry from current bid rounded **down** to tick; SL at least **1.5 × ATR(14)**
  above entry, rounded farther away; targets at **1.5R/2R** below entry.
- Tick displayed for MCX futures is derived from Upstox BOD `tick_size / 100`.
  This transformation is provisional; the broker/exchange price unit and actual
  tick must be independently confirmed before live decisions.
- These prices are **hypothetical**; an actual fill, executable entry and SL order
  are not implied.

### Position size calculations
- Units-per-lot = `lot_size * qty_multiplier` for MCX futures; one NSE stock
  equity share is one unit, and NSE futures use their underlying lot size.
- Raw gross SL risk/lot = `abs(entry - stopLoss) * unitsPerLot`.
- Illustrative 2-tick slippage reserve per lot = `2 * tick * unitsPerLot`.
- Risk-budget theoretical lots = floor(`₹500 / (grossRiskPerLot + slippageReserve)`).
- Broker required-margin-per-lot comes from the **Upstox /v2/charges/margin**
  calculation API using exactly one exchange lot, `product=I`, and BUY/SELL.
  Despite that provider endpoint using HTTP POST, it is only a margin calculator,
  **never** an order endpoint.
- Capital ceiling / required margin = indicative **budget** lots, *not actual
  buying power*. Broker-funds data are *not* available through the Analytics Token
  without additional authorized, static-IP-restricted User API setup.
- The app displays combined theoretical lot ceiling if broker margin responds.
- **Approved lots = 0 always** until broker-verified available funds, full charges,
  MCX tender/holiday/square-off rules, and strategy backtest/forward verification
  become available. Even when a hypothetical smaller futures contract shows
  `risk-budget lots > 0`, it does not authorize real trades.

### Standard MCX GOLD and ₹500 risk
Standard GOLD's BOD data currently report lot_size = 1 and qty_multiplier = 100,
so a ₹100 quoted-price movement gives roughly ₹10,000 exposure for a one-lot
price difference, before broker charges. If the ATR SL is ₹150–₹200 per quoted
unit, the **gross** per-lot risk is roughly ₹15,000–₹20,000 and the
₹500 risk budget permits **0 lots**. Smaller commodities/mini contracts may
produce a nonzero theoretical envelope, conditional on verified contract metadata.

### Read-only safety
- The frontend only calls `GET /api/upstox/paper-margin`; this backend makes a
  single validated upstream **margin quote** request, with short cache.
- This does not fetch or disclose an account's funds, place orders, or expose tokens.
- The broker's Analytics Token stays in Render's server-side environment.
- Every response still says `orderSubmissionAllowed:false`.
- No P&L expectancy, accuracy or success probability has been established.
- Avoid trading actual capital based solely on these research numbers.

Broker docs:
- https://upstox.com/developer/api-documentation/instruments/
- https://upstox.com/developer/api-documentation/margin/
- https://upstox.com/developer/api-documentation/get-user-fund-margin/
- https://upstox.com/developer/api-documentation/analytics-token/
