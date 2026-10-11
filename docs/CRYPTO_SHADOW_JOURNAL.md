# AI Trade Pro — BTC no-cost persistent shadow history

## Scope and deployment status

This is an **independent research journal**, not an order bot or strategy
success claim. The regular Crypto UI remains read-only. The scheduled runner
uses only the public Kraken BTC/USD 5-minute spot OHLC endpoint, Node 22,
GitHub-hosted Linux Actions and a dedicated Git branch.

Repository must remain **PUBLIC** for GitHub-hosted Actions usage that does
not consume private-repository billing minutes. The workflow explicitly
skips nonpublic repositories. No Render database/disk, crypto account,
broker token, order capability, new service, paid subscription or API key.

## Architecture

- `server/cryptoShadowLedger.js`: event validator, append-only JSONL store
  with SHA256 checksums and fsync, duplicate and forged outcome rejection,
  live-clock cutoff, fixed five-minute settlement, and zero-cost counters.
- `server/cryptoShadowScheduledJob.js`: obtains live Kraken data, evaluates
  pending records, and stages one new decision or explicit skip.
- `.github/workflows/crypto-shadow-free-schedule.yml`: every 5 minutes
  **best-effort**, at minute 1 / 6 / ... / 56 UTC, after a typical candle
  close. GitHub Actions creates/updates the *separate*
  `crypto-shadow-history` branch and pushes committed journal changes. A
  `STAGED_PENDING_GIT_COMMIT` log message is **not** proof of durability;
  only an accepted Git push is. Runner concurrency prevents parallel writers.
- `.github/workflows/crypto-shadow-qualification.yml`: synthetic replay
  plus a separate actual live Kraken public-feed probe at PR qualification.
- Journal path on the archive branch:
  `data/crypto/btc-usd/YYYY-MM-DD.jsonl` (UTC by forecast slot).
  Plain public market research only; **any person can read this public
  history**. No trading account secrets, personally identifiable data,
  positions or broker data should be written.

Forecasts are independent of the app being open. The free Render backend can
sleep without losing already *pushed* archive records.

## Chronology and interpretation

1. The GitHub Action fetches fresh BTC/USD OHLC. The last Kraken OHLC element
   is always **uncommitted** and is never used as a completed bar.
2. A new five-minute slot can be forecast **only 12 to 90 seconds after the
   completed boundary**. Late/dropped Actions are not backdated. Captured
   timestamp is measured **after** the provider returns data.
3. The existing eight-gate BTC 5m/1h strategy produces either a versioned
   BULLISH/BEARISH forecast or ABSTAIN. Public-source outages, incomplete
   candles and missed windows are tracked as SKIP, not guessed results.
4. Each directional forecast locks its source, immutable model version,
   exact clock, reference **last completed five-minute candle close**, and
   SHA256 snapshot fingerprint. No future-market data enter the forecast.
5. A later scheduled run evaluates the **single candle that opens at the
   original forecast slot and closes five minutes later**, with a 12-second
   close grace. More than +2 basis points in forecast direction is CORRECT,
   more than 2 bps opposite is INCORRECT, within ±2 bps is INCONCLUSIVE.
   This is **directional evaluation**, not a simulated filled order.
6. If the predetermined settlement candle cannot be independently confirmed,
   the outcome remains PENDING. After a 60-hour missing-data timeout,
   it becomes UNEVALUABLE; missing is neither a win nor a loss.
7. Reports retain correct/incorrect/inconclusive, abstain/skip/pending,
   sample size and verified settled-direction accuracy separately.
   All unknown or incomplete outcome periods remain visible.

An "accuracy" ratio calculated over a handful of selectively triggered
signals is NOT a reliable success probability and is not option/spot P&L.
The journal does not automatically validate its own external provenance or
offer a calibrated confidence value. The older synthetic tests are separate
from genuine future timestamped observations.

## Operational limitations and required acceptance evidence

- The GitHub schedule is **not an SLA** and may be delayed, silently dropped,
  or disabled after long repository inactivity. This will create missed
  decision slots. A published forecast *never* gets generated after the
  fixed cutoff merely because a later successful candle was observed.
- Scheduled executions are subject to GitHub public repository policies,
  rate limiting, maximum job durations, concurrency and any limits imposed
  by the platform. A job runs roughly every five minutes only while the
  Actions configuration stays enabled and public usage is free.
- The journal is one-writer. A push conflict or failed push fails the
  GitHub job, rather than claiming an event was durably recorded.
- The 60-hour timeout is aligned to the Kraken endpoint's roughly 720
  retained five-minute entries, not to a guaranteed recovery window.
- Only BTC/USD from Kraken is monitored, not ETH, derivatives, executable
  quotes, live bids/asks or INR.
- Historical periods before activation **are not reconstructed as if their
  forecasts existed**; no backtested history is mislabeled forward.
- Accuracy claims, strategy promotion, short-selling availability, bid/ask,
  fees, FX, slippage, margin, position sizing, stop-order fills and crypto
  tax are **not qualified by this pipeline**.
- Local tests and the one-time live Kraken feed probe do not certify 24/7
  availability. Monitor scheduled run history and actual archive-branch
  commits before asserting the journal is continuously operating.
- If a repository is changed from public to private, the scheduler skips
  instead of risking free-tier billing.

Safety remains: `paperOnly=true`,
`orderSubmissionAllowed=false`, `realOrderPlaced=false`,
`productionRealTradingEnabled=false`.

References:
- Kraken [Get OHLC Data](https://docs.kraken.com/api-reference/market-data/get-ohlc-data)
- GitHub [Scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

The user may inspect completed runs on GitHub Actions and the separate
`crypto-shadow-history` branch. If account/repository Action policies
prevent the first scheduled run, it is **not yet activated** until a
successful public Git push and at least one real provider observation.
