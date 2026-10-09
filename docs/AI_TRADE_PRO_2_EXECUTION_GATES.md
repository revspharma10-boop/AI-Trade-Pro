# AI Trade Pro 2.0 — approved phased engineering execution

**Approval:** Phased roadmap, starting with Phase 0.  
**Explicit reserved approvals:** Any paid infrastructure, new data subscription,
permission for any live-order or real-money feature must be separately approved.
The current software must remain PAPER_ONLY with approved real-order count zero.

## Delivery and change-control rules

1. Keep releases on separate `phaseN/*` branches with a pull request, source
   diff, test evidence and rollback strategy. Merge only after applicable CI
   and security/signal-safety gates pass.
2. Keep existing deployed web experience working while experimental models
   and migrations are built behind disabled-by-default feature flags.
3. The directional-forecast API, option-contract selection, qualified paper
   setup, observed paper P&L and real execution must use **distinct states and
   records**. Never rebrand a forecast as a trade.
4. No broker token, account data, confidential feed payload, or service key
   in GitHub, frontend assets, public logs or exported prediction snapshots.
5. Use market-time data cutoffs on every feature, model, news article and
   external source. No historical look-ahead; no generated price, expiry,
   market outcome or backtest result.
6. No AI/LLM explanation can loosen risk gates or authorize real orders.
   The model may propose research; server-side deterministic safety controls
   are authoritative.
7. Quantified performance is **unverified until measured**. Each baseline,
   candidate and promoted model needs versioned, out-of-sample evidence.

## Phases with executable gates and launch criteria

| Phase | Non-disruptive scope | Required acceptance evidence | Approval dependency |
|---|---|---|---|
| **0. Source audit and baseline** | Reproduce 09:30 bias hidden as WAIT, inventory data/auth/security, document known limitations and proposed forecast/outcome schema | `node src/phase0ArchitectureAuditQualificationRunner.js`, existing qualification regression, source/architecture audit reviewed | Approved |
| **1. Reliable event pipeline** | Provider interface, market calendar, synthetic replay harness, versioned forecast-event schema, idempotent 5m scheduling design. Add persistent worker and DB when approved | Exactly one event per market+strategy+completed candle+version; durable restart, calendar/clock, missing-data, rate-limit and security replay tests | **Paid worker and DB provisioning separate approval**; optional no-cost local harness can be built first |
| **2. Early forecast engine** | Publish separate `BULLISH|BEARISH|NEUTRAL|ABSTAIN` after the completed 09:15–09:30 range; fixed 5/15/30m horizons; paper-only replay/outcome logic | Recorded 09:30+ test hypotheses are never interpreted as option trades, can abstain, freeze for 5m, outcome attribution does not revise history | No live orders; requires Phase 1 durable storage for unattended launch |
| **3. Option intelligence** | Exact option-chain validation, bid/ask, liquidity, OI, IV/Greeks, premium/SL/3 targets, tick and expiry normalization, costs and conservatively risk-based lots | ₹50,000 paper capital, max planned ₹500/trade, zero margin fabrication, 0 executed orders, realistic slippage/fees and rejected quote tests | Feed entitlements if missing require separate approval |
| **4. News, fundamentals and global context** | Timestamped source collection, corporate/sector/macro impact, stale news rules, event risk policy, genuine source provenance | No source after prediction feature cutoff; linked evidence and timestamp validation; event impact not an automatic BUY | Paid/licensed sources require separate approval |
| **5. AI model and performance validation** | Regime classifier, deterministic baseline, walk-forward ML, honest calibration, attribution and model registry | Predeclared out-of-sample evaluation, confidence intervals, transaction costs, abstention and drift monitoring; no silent model promotion | Never auto-enable live orders |
| **6. Responsive web experience** | Retain 4 tabs and last-card simplicity, new market direction vs verified option trade, evidence panels, immutable history, paper P&L, daily review | API contracts, mobile accessibility, no data/secret leak, user-verified UI and stable refresh | Public-site authentication before sensitive data |
| **7. Forward-paper observation** | At least 20 trading sessions initially, multi-regime analysis, shadow-mode candidate comparisons | Full numerator/denominator, missed signal counts, reliability, max drawdown and rollback decision report | Separate review before any new phase or strategy promotion |

## Proposed Phase 1 architecture (design gate)

**Before paid resources:** Build a local, provider-agnostic market clock,
synthetic-replay scheduler and append-only event interface in the existing
repository. This step can be qualified without running paid cloud infrastructure
or inserting fictitious results into the public app.

**Approval checkpoint A — Background infrastructure:** Present comparative
monthly pricing, expected feed volume, deployment/restore plan and data
retention period for a persistent worker plus managed PostgreSQL. Obtain
explicit approval before creating or upgrading any paid service/database.

**Approval checkpoint B — Broker/market data:** Present availability,
permission/entitlement, latency, limits and source costs for Upstox V3
WebSocket, NSE/BSE/MCX holidays, exact option contracts, current bid/ask,
volume/OI and margin. Obtain approval before buying a feed.

**Approval checkpoint C — Security:** Threat-model the present publicly
accessible `/api/paper-recommendations/latest` route; propose request
quotas, authenticated access for private analytics, input sanitation,
source-secret management and audit retention. Avoid storing account-specific
information in publicly accessible GitHub Pages.

**Approval checkpoint D — Production model:** Only a shadow/paper versioned
strategy can publish; real-order paths remain disabled. Any later
real-money request is out of scope and requires separate explicit approval
and extensive broker/regulatory/operational review.

## Forecast state model (proposed)

- `AWAITING_DATA`: market not open, candle still forming, provider unavailable.
- `ABSTAIN`: enough valid evidence to evaluate but no defensible direction.
- `PROVISIONAL_DIRECTION`: post-09:30 completed-candle bullish/bearish
  research hypothesis with frozen timestamp, strategy, horizon and evidence.
- `PAPER_SETUP_WAIT`: hypothesis exists but option contract/premium/liquidity
  or ₹500 risk/margin fails.
- `PAPER_SETUP_QUALIFIED`: verified long CE/PE entry research, **NOT EXECUTED**.
- `OUTCOME_PENDING`, `OUTCOME_CORRECT`, `OUTCOME_INCORRECT`,
  `OUTCOME_INCONCLUSIVE`, `OUTCOME_UNEVALUABLE`: independent, immutable
  ex-post evaluation; never mutate the original forecast.

An early `PROVISIONAL_DIRECTION` does not inherit brokerage permissions,
strike price, option premium, expiry, buy price, position size or confidence
probability from the later option setup.

## Operational metric specification

| Metric | Definition | Initial gate / caution |
|---|---|---|
| Forecast coverage | Post-09:30 eligible 5m periods with a recorded direction/abstain | Target 100% *accounted-for periods*; not 100% BUY signals |
| Market ingestion timeliness | Available 5m candle time → authenticated and validated ingestion time | Instrument and feed-dependent SLA; measure before setting target |
| Reliability | Process uptime during verified market sessions; error/retry recovery | No backend-sleep dependency for unattended launch |
| Hit rate | Correct directional outcomes / evaluable non-neutral forecasts | Report count and confidence interval; zero samples = N/A |
| Abstention rate | Explicit neutral/WAIT periods / all eligible decision periods | Required to prevent cherry-picking |
| Paper expected value | Simulated profits/losses net of fees, spreads and realistic slippage | No broker fill claim; account for unknown gap risk |
| Risk adherence | Max planned loss, lot/margin guards, live-order attempts | Zero unauthorized orders, zero unverified BUY prices |
| Calibration | Observed event frequency against forecast probability bins | Never display percentages until properly calibrated |
| Model drift | Degradation in out-of-sample and shadow test performance | Trigger review, not automatic promotion |

## Rollback and release control

- Frontend remains deployed using GitHub Pages; Render read-only backend stays
  unchanged by Phase 0.
- Feature flags must default to off until a versioned module passes its gate.
- Before Phase 1 cloud deployment, document rollback and database schema
  backward compatibility, provider fallback and replay capability.
- All audit files and synthetic test cases contain **no** live market
  recommendations, real trades or claims of realized performance.

## Phase 0 → Phase 1 handoff checklist

- [x] User authorized roadmap and Phase 0 start.
- [x] Architecture root causes and candidate data contracts documented.
- [x] Reproducible synthetic 09:40 CE bias / WAIT mismatch test authored.
- [ ] GitHub CI confirms audit tests on Phase 0 commit.
- [ ] Any user-specific broker entitlements and costs verified (not yet).
- [ ] Separate approval for paid worker, database and/or market/news feeds
      before provisioning.
- [ ] Phase 1 design decisions and risk assumptions reviewed after Phase 0
      qualification; no commitment to guaranteed profitable forecasts.
