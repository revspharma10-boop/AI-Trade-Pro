# AI Trade Pro 2.0 — Phase 0 baseline audit

**Audit date:** 2026-10-09 (IST)  
**Baseline Git commit:** `cec18236c583e2fb0a09093a555e7b463db5079a`  
**Scope:** source review, reproducible synthetic-input qualification, architecture/data-access inventory.  
**Trading mode:** PAPER_ONLY; this audit does not place trades, fetch account secrets, add live orders, provision resources or buy data.

## Executive determination

The app's existing `GET /api/paper-recommendations/latest?tab=...` returns a
paper **BUY** only after a fully qualified index/stock directional indicator
AND exact option contract/quote/candles/margin/risk checks. This endpoint
does **not** independently publish the already-computed 09:30 opening-range
CALL/PUT bias. Therefore a confirmed completed five-minute opening breakout
can correctly produce a provisional **CE/PE directional hypothesis** in the
opening-range module while the production recommendation card shows **WAIT**.
This is an output/strategy separation failure relative to the user's specified
early forecasting workflow, **not proof of no market opportunities**.

`src/phase0ArchitectureAuditQualificationRunner.js` reproduces that specific
behavior with a synthetic Friday 09:40:20 IST bullish opening-range fixture:
opening-range direction **CE**, completed post-opening breakout **true**,
full 35-candle strategy **WAIT**, public recommendation **WAIT** with the
`OPENING_RANGE_BIAS_ONLY` rejection code. Synthetic fixtures are
engineering tests, **not historical market events or live quotes**.

A complete real-market performance audit of 9 October is **not possible**:
the current application has no durable, timestamped record of all decisions,
unselected hypotheses, options, execution assumptions and measured outcomes.

## Evidence and prioritized findings

| ID | Priority | Verified current behavior | Risk / corrective direction | Source |
| --- | --- | --- | --- | --- |
| P0-01 | CRITICAL | Early opening-range `deriveOpeningRangeBias` has a CE/PE/WAIT result, yet the production `createPaperRecommendationFeed` converts a provisional CE/PE into WAIT when fewer than 35 completed underlying candles exist. | Build **separate paper directional forecast** independent of *qualified option entry*. Do not loosen option-trade gates. | `src/services/openingRangeResearch.js`, `server/paperRecommendationFeed.js` |
| P0-02 | CRITICAL | `analyzeIntradayCandles`, `deriveAutoOptionDirection`, and option premium analysis require **35 completed same-day 5-minute candles**, earliest approximately 12:10 IST on uninterrupted 09:15 sessions. | Keep full-model qualifier for late-session trades; design, test and calibrate an explicitly distinct opening-range predictor after 09:30. | `src/services/intradayTechnicalEngine.js`, `src/services/autoOptionResearchEngine.js` |
| P0-03 | CRITICAL | The backend `lastByTab`, `cache` and `pending` are in-memory Maps. No append-only persisted predictions or later outcomes. | Add durable PostgreSQL prediction/events/outcome model **after approval for provisioning/cost**; immutable timestamps and idempotency. | `server/paperRecommendationFeed.js` |
| P0-04 | CRITICAL | Browser invokes the API every ~30 seconds while visible; no independently running market-hours job exists in the paper recommendation code. | Always-on broker-data monitor and exchange-timed scheduler; avoid relying on a free sleeping web service. | `src/androidBottomNavigation.js`, backend route |
| P0-05 | HIGH | A bullish/bearish **index price move is not a broker-verified CE/PE option trade**; option bid/ask, last trade, volumes/OI, 35 option candles, lot, ₹500 risk and broker margin can reject. | Publish three distinct statuses: directional forecast; provisional option research; fully qualified paper entry or WAIT. | `src/services/autoOptionResearchEngine.js`, `server/paperRecommendationFeed.js` |
| P0-06 | HIGH | Option cost/risk result admits `feesAndGapsIncluded:false`, `availableBrokerFundsVerified:false`, `modelBacktested:false`, `approvedLots:0`; a verified **margin estimate** is not proof of available account funds or executable sizing. | Model costs/slippage/gaps, assess 1-lot affordability conservatively, and label all signals *research only*. | `src/services/autoOptionResearchEngine.js`, `server/upstoxOAuthCallbackServer.js` |
| P0-07 | HIGH | The read-only recommendation endpoint and GitHub Pages website are publicly reachable; no per-user data authorization or request quota is implemented for the paper endpoint. | Add access control or public-only limited summaries, rate limiting, request budgets and abuse protection before a multi-user/personalized bot. | `server/upstoxOAuthCallbackServer.js`, `server/readOnlyCorsPolicy.js` |
| P0-08 | HIGH | `marketClockState` knows weekday clock hours but explicitly marks exchange **holidayCalendarVerified:false** and **brokerSquareOffVerified:false**. | Introduce separately verified NSE/BSE/MCX market calendar and special sessions; fail closed for actual paper entries. | `src/services/intradayMarketClock.js` |
| P0-09 | HIGH | Current backend quote freshness can reject on absent depth, stale last trade and OI/volume; analytics/OAuth permissions and rate limits can also fail. Actual failure frequencies are **not measured**. | Add sanitized per-stage diagnostic metrics (counts and timestamps), feed health/freshness dashboard, and provider-permission qualification without exposing secrets. | `server/paperRecommendationFeed.js`, `server/recommendationWaitDiagnostics.js` |
| P0-10 | HIGH | No historical backtest, walk-forward dataset, evaluated accuracy, event-specific performance or genuine calibrated confidence is established for the production strategy. | Establish leak-free historical data, costs, baseline benchmarks and 20+ trading-session initial forward observation before any quality claim. | Strategy code/temporary session lab |
| P0-11 | MEDIUM | Options Trade is currently fixed to **INFY**; Commodity is fixed to **MCX GOLD** and explicitly fails closed because multiplier/delivery/other checks are not independently verified. | Build an allowlisted instrument picker and separate commodity qualification after contract metadata/delivery checks. | `server/paperRecommendationFeed.js` |
| P0-12 | MEDIUM | Fundamental, news and cross-market evidence are not part of the active option recommendation decision. Historical news and macro data permissions/latency unknown. | Build timestamped, licensed-source evidence ingestion; no future-data leakage and no LLM override of risk gates. | Production feed and service dependencies |
| P0-13 | MEDIUM | The Render web service is currently on the **free plan**. Background analysis and storage cannot be promised from this configuration; fee approvals are outstanding. | Propose provider-neutral worker/database architecture first; obtain approval before selecting paid service, adding cron/data feeds or migrating account credentials. | Read-only Render service inventory (2026-10-09) |
| P0-14 | MEDIUM | The paper UI lacks five-minute frozen directional forecasts, defined horizons, after-the-fact result labels and trend metrics. | Separate append-only prediction/outcome API from current `PAPER_SETUP` contract card; add transparency and version labels. | `src/androidBottomNavigation.js` |

**Scope limitation:** Reports of an upward market and visible WAIT screens do not
establish exact historical frequencies, profitable option setups or missed
earnings. We cannot infer successful hypothetical fills, premium costs or
profit/loss without contemporaneous broker/exchange evidence.

## Provider data-contract checkpoints before Phase 1

| Dependency | Existing code | Required validation |
| --- | --- | --- |
| Underlying 5m OHLCV | Upstox intraday REST V3 | Exchange timestamp interpretation, candle completeness, duplicate/out-of-order bars, missing holiday/special session handling and stale-data failure |
| Index quote | Upstox full market quote V3 | Instrument key, timestamp units, quote freshness, index vs tradable instrument semantics |
| Exact listed options | Upstox option contract V2 | Exchange segment, expiry, official tick-size unit, underlying key, lot/multiplier, key mapping; do not synthesize contracts |
| Option quote and OI | Upstox full quote V3 | Bid/ask/last-trade chronology, spread, volume/OI, rate limits and entitlement |
| Required margin | Upstox charges/margin estimate | Distinguish margin estimate from available brokerage funds and actual option-buy cost |
| Market calendar | **Not presently verified** | Upstox market timings plus exchange holidays/special sessions and intraday cutoff |
| News / fundamentals | Not wired to active forecast | Source availability, rights, paid/free entitlement, publication/ingestion timestamps, quality and attribution |
| Global markets | Not wired to active forecast | Timeliness (some feeds are delayed), data mapping, market-specific sessions, exchange-source quality |
| Authentication and limits | Public read-only endpoint | Auth, per-user permissions, quotas, retry/backoff and public credential safety |

Provider references (must be revalidated during implementation):
- Option contracts: https://upstox.com/developer/api-documentation/get-option-contracts/
- Instrument search: https://upstox.com/developer/api-documentation/instrument-search/
- Market timings: https://upstox.com/developer/api-documentation/get-market-timings/
- V3 LTP: https://upstox.com/developer/api-documentation/ltp-v3/

## Required prediction vs paper entry event schema (proposal only)

A prediction event is **not** a trade:
```json
{
  "prediction_id": "generated-server-side-uuid",
  "market": "NIFTY",
  "event_type": "DIRECTIONAL_FORECAST",
  "strategy": "OPENING_RANGE_15M",
  "model_version": "versioned-git-sha",
  "as_of_ist": "timestamp-with-offset",
  "feature_cutoff_utc": "timestamp-of-last-allowed-market-evidence",
  "evaluated_candle_end_utc": "timestamp",
  "direction": "BULLISH|BEARISH|NEUTRAL|ABSTAIN",
  "horizon_minutes": 5,
  "input_source_timestamps": {},
  "evidence_hash": "cryptographic-feature-input-hash",
  "data_quality": "VERIFIED|STALE|MISSING",
  "paper_entry_authorized": false,
  "real_order_allowed": false
}
```
The exact database table and API request/response schema must be proposed and
tested in Phase 1 before provisioning. Do not persist token values, private
broker account IDs or sensitive positions in public GitHub/GitHub Pages.

Outcome events must reference a prior immutable prediction and specify
`outcome=CORRECT|INCORRECT|INCONCLUSIVE|UNEVALUABLE`, the predeclared
horizon, frozen settlement method and later broker/exchange observations.
Trade-simulation records must be separate from directional accuracy.

## Phase 0 acceptance / non-claims

- [x] Inventory current web frontend, Render backend, broker API, safety flags and failure gates.
- [x] Reproduce early completed-candle bullish hypothesis blocked from public output using synthetic, deterministic data (runner created in this audit).
- [x] Record priority-ranked architectural, data-rights, risk, security and reliability blockers.
- [x] Create explicit technical and performance measurement requirements without promising profitable signals.
- [ ] GitHub qualification completed on the audit commit (must be verified before merge).
- [ ] 9 October real-market full trace: **not reconstructible** with current ephemeral data; do not claim otherwise.
- [ ] Broker feed/data entitlements and valid official exchange holiday calendar: **not verified**, do not claim otherwise.
- [ ] Phase 1 persistent worker and database: **not provisioned**; paid approval required before changes.

Passing Phase 0 means the audit and tests are reproducible, **not** that
paper predictions are accurate or that the bot is ready for unattended trading.
