# BTC-only signal monitor v3 (paper-only)

- Six strategy signals on Kraken BTC/USD **fully completed** spot candles, for 5m / 15m / 1h / 4h / 1d.
- `BTC signal monitor` tab to fetch signals manually and review cloud-saved observations. Signal labels: BUY / EXIT / HOLD_LONG / HOLD_FLAT. They are **observations, not fill prices or instructions**.
- Rejects stale or unfinished candles. Writes at most one saved observation per strategy + timeframe + completed candle to `btc_signal_checks` on Neon (Postgres) or SQLite. Limited to one Kraken fetch per timeframe per 60 seconds.
- Authentication and CSRF required for manual check; authenticated-only audit history.
- Scheduled-job API `POST /api/btc/signals/job` exists but is **DISABLED BY DEFAULT**, fails closed without a unique high-entropy secret, opt-in `ALGO_BTC_SCAN_JOB_ENABLED=1`, and PostgreSQL. This branch **does not enable a scheduler** and does not promise 24/7 monitoring.
- **No automatic paper buys, no real exchange orders, no exchange API keys**. Fractional BTC paper ledger and risk limits from v2 remain manual and separate.
- 68 passing local unit/API tests, static JS syntax verified. Existing credentials and BTC paper ledger are not touched by schema migration. Product promotion requires a separate live preview check.

Render Free sleeps after 15 minutes idle; even periodic external requests cannot guarantee 24/7 scans: https://render.com/docs/free. Kraken bars: https://docs.kraken.com/api-reference/market-data/get-ohlc-data.
