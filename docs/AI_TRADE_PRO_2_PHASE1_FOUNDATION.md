# AI Trade Pro 2.0 — Phase 1A local shadow pipeline

**Status:** Local / synthetic-replay engineering foundation.  
**Not live:** No Render worker/cron task, no deployed API endpoint, no production
feature flag, no paid database, no live Upstox adapter, no change to GitHub
Pages and no real order permissions.

Phase 0 reproduced the problem: after the opening range, the existing
technical research can produce a provisional CE/PE direction but the web
recommendation remains WAIT because full option-trade qualification requires
35 five-minute bars, exact contracts, premium and risk checks.

Phase 1A addresses the **record/replay plumbing** needed before exposing a
separate directional hypothesis. It intentionally does **not** change the
existing 35-candle option recommendation strategy, invent backtests, or
publish a new trading recommendation.

## Source files

- `server/phase1ShadowForecastPipeline.js`: dependency-injected offline
  decision scheduler, strict market session gate, scheduled 5m window,
  provisional opening-range direction, sanitized evidence hash, deterministic
  forecast ID and separate five-minute outcome evaluation.
- `server/phase1LocalJsonlLedger.js`: an append-only, single-process **local
  testing** event ledger with SHA-256 record checksums, fsync, duplicate IDs,
  corruption detection and restart replay. Every event is allowlisted to
  prevent accidental broker tokens or positions from being persisted.
- `server/phase1LocalPipelineQualificationRunner.js`: synthetic tests of
  late/missing candles, abstention, bullish hypothesis, quote chronology,
  duplicate process-local writes, file-restart replay, settlement and
  no-lookahead constraints.
- `.github/workflows/phase1-local-replay-qualification.yml`: qualifies the
  new offline modules and all relevant prior paper safety and web tests.

## Scheduler specification

- Supported prototype markets: `nifty` (NSE) and `sensex` (BSE).
  Options Trade / MCX are **not** connected to this experimental scheduler.
- A caller invokes `pipeline.tick({market,asOf})`; there is **no automatic
  cloud timer** in this phase.
- The first eligible decision occurs at or after **09:30:12 IST**, from the
  completed 09:15, 09:20 and 09:25 opening candles; subsequent decisions
  operate at five-minute boundaries plus a twelve-second feed grace.
- Delays greater than **90 seconds** beyond the target five-minute candle
  close are skipped. **Do not backdate** a 09:40 decision using a 09:44 quote.
- The calendar dependency must explicitly assert verified market, date,
  exchange, source identity and open/close time. If no verified calendar is
  supplied, the pipeline **does nothing**; an ordinary weekday alone does not
  verify exchange holidays or special trading sessions.
- The market-data adapter must supply exact exchange/index keys, source
  verification, five-minute OHLCV and a current broker quote. Provider
  failure, stale/future quote, missing/duplicate candles or an unclear
  opening-range bias lead to an explicit **ABSTAIN**, not a fabricated BUY.
- This is a **shadow directional hypothesis**, never an option trade.
  The stored event contains no strike, premium, lot sizing, confidence
  probability, trade status, transaction details or order ID.
- Evidence is hashed from normalized broker input values at the observation
  cutoff. Future candles are filtered out before the strategy is evaluated.

## Event and outcome semantics

`DIRECTIONAL_FORECAST` events carry immutable model version, market,
exchange, evaluation clock, feature cutoff, five-minute outcome horizon,
direction `BULLISH|BEARISH|ABSTAIN`, data quality and a cryptographic hash.
These values are **synthetic in qualification tests**.

`DIRECTIONAL_OUTCOME` events are **separate append-only rows**. The
five-minute outcome uses the **single predetermined** exchange candle whose
end matches the horizon; it does not retrospectively select the most
favorable price point. Its labels are:
- `CORRECT`: later candle close differs by more than 2 basis points and
  moves in the predicted direction.
- `INCORRECT`: later candle close differs by more than 2 basis points
  against the prediction.
- `INCONCLUSIVE`: within ±2 basis points.
- `UNEVALUABLE`: no verified settlement close within the initial defined
  window; record after three minutes of failed retrieval.

The 2-basis-point neutrality buffer is a **provisional engineering
definition**, not a validated edge. It must be predeclared, tested against
instrument precision and reapproved during strategy research, not tuned
on the same evaluation sample.

Abstentions are never counted as correct forecasts or option losses.
No paper P&L is computed by the early directional evaluator.

## Durable file-replay scope / limitations

The JSONL store replays committed events after reopening **the same local
file**; checksum validation detects torn/corrupted writes. It does not have
cross-process locking, database constraints, backups, HA, automatic replication,
encryption-at-rest, or cloud-retention guarantees.

**CRITICAL:** Render Free's local filesystem is ephemeral and an instance
may sleep/restart. This file is for regression testing and development
only. It is **not** the planned production persistence solution. Before
running a live/unattended bot we must separately approve the worker and a
managed transactional database, then replace this adapter with PostgreSQL
constraints (`UNIQUE(market,strategy_version,candle_end)` and
`UNIQUE(forecast_id,horizon)`) and durable backups.

The source is not imported by `server/upstoxOAuthCallbackServer.js` or
`src/intradayRecommendationsUI.js`; therefore publishing this phase does
not change any currently displayed prediction or activate a cloud task.

## Planned Phase 1B cloud launch — reserved approval

These items have **NOT** been provisioned:

1. An always-on market-hours worker or scheduler, plus verified NSE/BSE
   holidays/special sessions, exact stop-on-holiday behavior and throttling.
2. Managed PostgreSQL for immutable event/outcome records, idempotent
   transactions, backups, audit retention and restart tests.
3. Upstox broker adapter that reconciles instrument keys, quote timestamp
   formats, websocket/reconnect semantics, candle completeness and provider
   access rights. Never ingest live feed data with fabricated timestamps.
4. Private authentication/abuse prevention for any account-specific journal;
   public GitHub Pages must not expose private positions or credentials.
5. Observability: data latency, snapshots, provider quota, unresolved
   outcomes, calendar failures and worker uptime.

Before any paid change: document exact price/region, service tier, backup
and monthly cost; obtain explicit user approval.

## Phase 1A verification gate

Run locally with Node 22:

```sh
node --check server/phase1ShadowForecastPipeline.js
node --check server/phase1LocalJsonlLedger.js
node server/phase1LocalPipelineQualificationRunner.js
node src/phase0ArchitectureAuditQualificationRunner.js
node server/paperRecommendationFeedQualificationRunner.js
npm run build
```

The actual success count belongs to the GitHub Actions result, not this
documentation. A passing local fixture proves **correct software handling
of synthetic examples** — it cannot establish forecast accuracy, current
NIFTY/SENSEX direction, verified Upstox entitlements, or profitability.

## Next release recommendation

Once Phase 1A qualifies, proceed with **Phase 1B architecture/cost
approval** and broker calendar/feed entitlement verification. In parallel,
we can implement a disabled-by-default Postgres adapter and a shadow REST
read model in code without deploying it. Continuous market monitoring and
durable production storage are **not yet active**.
