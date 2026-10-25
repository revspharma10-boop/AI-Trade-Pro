# Algo Trader BTC AI Brain — v7

**Status:** Explainable BTC/USD paper-research rules engine. This is not an LLM, trained predictive model, or investment adviser. All trades remain manually entered paper simulations. No background scan or real broker connection is enabled.

## Knowledge levels
- **Foundation:** BTC/USD candles, spot trade execution, fees, stop risk, position sizing
- **Intermediate:** EMA/SMA, RSI, Bollinger Bands, Donchian breakouts, momentum, ATR
- **Advanced:** market regime, volatility filters, strategy agreement, backtests and out-of-sample validation
- **Specialist:** Bitcoin issuance/halving, on-chain network transaction fees, macro rates/USD liquidity, ETF flows, institutional factors, market microstructure and derivatives risk

## Live data coverage
- Technical: Kraken completed BTC/USD spot candles. Missing/stale/insufficient rows fail with no verdict or stored report.
- Network fundamental: mempool.space public recommended Bitcoin fee rates, fetched on demand. This *is not* a directional price signal.
- Not connected: macro, ETF flow, funding, order books, verified BTC news. These are always explicitly marked unavailable, not fabricated.

## Research outputs
- WAIT / CONDITIONAL_BUY / REVIEW_EXIT / MANAGE_OPEN_POSITION, with technical agreement and transparent reasons.
- EMA12/26, RSI14, ATR14/close, market regime, fundamental source status, hypothetical entry trigger/stop/two targets and sizing from existing risk rules.
- No probabilities until enough outcomes are scored. A conditional buy requires a fresh complete candle, trend and paper risk checks.
- Durable one-report-per-timeframe-and-candle audit in Neon `btc_brain_reports`. PIN authentication plus CSRF for analysis, 60-second shared request throttle.

## Verification
96 unit/integration tests passed; static JavaScript syntax passed. No model API keys or exchange trading credentials required. The preview must still pass external Render startup and real feed access; the earlier Kraken 503 due to insufficient candles may persist.

## Limitations and roadmap
This is a *structured expert rule system*, not a general financial reasoning model. A future LLM can explain the already-validated structured indicators, but should never override risk constraints or fabricate live data. Connect and validate genuine macro/ETF/derivatives/news data before asserting broad fundamental coverage. Render Free sleeps after 15 minutes idle and cannot guarantee 24/7 automated scans.

Sources: https://docs.kraken.com/api-reference/market-data/get-ohlc-data ; https://mempool.space/docs/api/rest ; https://render.com/docs/free
