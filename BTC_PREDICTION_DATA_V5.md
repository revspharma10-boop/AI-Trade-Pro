# BTC prediction and online market-data pipeline (v5)

**Status:** BTC-only paper research candidate. **No exchange order placement or auto-paper execution.**

### Official channel

- Primary data source: Kraken's public BTC/USD spot OHLC REST API, reached from the Render app. Public market data requires no API key: https://docs.kraken.com/api-reference/market-data/get-ohlc-data.
- Kraken provides up to 720 bars per call including the still-forming last bar. The application **discards the last bar**, checks bar timestamps and freshness, and validates positive OHLC prices.
- Supports 5m / 15m / 1h / 4h / daily intervals. Only upon authenticated **Pull Kraken data & save prediction** actions; shared 60-second throttle per interval. No background data collection is claimed.
- Saves the most recent 120 validated fully completed candles into `btc_market_candles` on Neon with a source + timeframe + candle timestamp uniqueness constraint. The dataset grows as user-triggered pulls occur; source retention is not unlimited.
- Saves one prediction per timeframe and completed candle into `btc_predictions`, storing original reference close, bullish strategy count, direction bias (UP_BIAS, DOWN_BIAS, NO_EDGE), 14-bar ATR volatility, illustrative three-candle volatility range and optional breakout entry, stop and targets. No calibrated probability or directional win rate is claimed without scored observations.
- **After** a further three *completed* candles become available, a new pull can fill in the original prediction's realized close and price change and score the directional bias. Missing exact future bar means keep PENDING, never substitute the current quote. Idempotent re-pulls preserve the first saved prediction.
- Prediction journal displays observed reference candle times, outcome due time (future third candle completed), reference level, outcome and experimental directional accuracy for recent scored records. No look-ahead or backdated imaginary orders.
- All changes are isolated to read-only BTC market research and new data tables. Existing Neon user/PIN, BTC paper portfolio and legacy stock records are unchanged. Existing planner and BTC signal monitor remain available.
- Seven additional tests; **84 tests total passed**, JS syntax checked.

### Deployment gate

Do not change the production `deploy/algo-trader-paper-free-v1` site. Deploy only on the isolated Neon preview `algo-trader-neon-preview`. Verify 2 new Neon tables; verify existing admin/BTC paper cash; require authenticated click and first saved candle before stating ingestion is active. Render Free is idle-suspended and cannot sustain a 24/7 polling service. No auto-scheduler is enabled and no exchange secrets required.

### Research caveats

Bias and volatility range are deterministic **hypotheses**, not financially reliable predictions. Scored sample sizes must be sufficiently large, non-overlapping, and out-of-sample before inferring whether a strategy has an advantage. Kraken rate limits and intermittent outages can leave gaps. Any later third-party source (e.g., Coinbase) must be displayed distinctly, reconciled by venue and timestamp, and validated for discrepant spot prices before use.
