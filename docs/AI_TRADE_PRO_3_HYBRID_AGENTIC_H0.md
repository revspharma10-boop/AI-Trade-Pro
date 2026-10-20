# AI Trade Pro 3.0 — Hybrid Agentic AI, Phase H0

**Status:** Isolated engineering PR. **NOT** a running live bot, trading signal,
accuracy claim, installed LLM, or deployed UI feature.

## Purpose

Extend the existing AI Trade Pro 2.0 research stack without replacing the
current web experience or relaxing a single option/risk/order gate. Introduce
strict, replaceable specialist interfaces that can eventually coordinate:

1. **Market data and technical research:** existing Phase 1 shadow pipeline,
   Upstox read-only adapters and exchange-verified completed bars.
2. **Independent ML research:** a point-in-time validated classifier/forecaster,
   versioned with its training cutoff and out-of-sample evaluation.
3. **News/macro risk:** source-attributed, timestamped risk review which may
   veto an idea but never trigger one.
4. **Options and microstructure:** future module for exact listed contracts,
   bid/ask spread, OI, lot size, funds and true paper friction.
5. **Deterministic risk:** ₹50,000 notional research capital; at most ₹500
   modeled loss per individual idea; no real orders.
6. **Evaluation/audit:** existing Phase 1 forecast/outcome journal and Phase 5
   directional accuracy evaluators; independently audited as available.
7. **LLM explanation:** future optional narrative-only specialist; an LLM
   must never invent a quote or promote a forecast to a trade.

## Phase H0 implementation

`server/hybridAgenticPaperResearch.js` exposes
`createHybridPaperResearchCoordinator({sourcePipeline,modelAgent,newsRiskAgent})`.

- `sourcePipeline.tick({market,asOf})` must provide a previously qualified
  Phase 1 `DIRECTIONAL_FORECAST` event.
- It verifies market/segment identity, paper-only flags, evidence hash,
  absolute timestamps, quote age, completed bars, original feature cutoff,
  forecast horizon, and data quality.
- It asks `modelAgent.predict(context)` for a second independent vote.
  The result must be tied to exactly the Phase 1 forecast/evidence hash,
  have a version, declare independent out-of-sample validation, and disclose
  a predecision training cutoff. **That declaration must be independently
  audited before trusting a real adapter.**
- If configured, `newsRiskAgent.review(context)` must return a verified,
  contemporaneous `CLEAR` or `BLOCK` risk review.
- Forecast and ML must agree; news can veto. Mismatch, stale/unavailable data,
  failed agents, or missing validation yield explicit `WAIT` and abstention.
- Even agreement returns only `PROVISIONAL_DIRECTION`. Every output has
  `paperOnly:true`, `orderSubmissionAllowed:false`,
  `productionRealTradingEnabled:false`, `realOrderPlaced:false`,
  `optionPlanQualified:false`, and `approvedLots:0`.
- No CE/PE strike, entry, stop, target, premium, or option quantity is
  emitted. No calibrated probability or accuracy number is claimed.
- Both errors and downstream outputs are allowlisted. Broker error bodies,
  credentials, and arbitrary agent responses are not passed to the UI.

The first two supported markets are `nifty` and `sensex`. Futures,
stock options, MCX and BTC/INR remain separate research domains and do not
inherit an index signal. H0 adds **no HTTP route**, tool credential, worker,
cron job, database, external dependency, order interface, browser import, or
production model. `recordedDurably:false` is intentionally explicit.

## Example intended wiring (NOT activated)

```js
import {createHybridPaperResearchCoordinator}
  from './server/hybridAgenticPaperResearch.js';

const coordinator=createHybridPaperResearchCoordinator({
  sourcePipeline: existingReadOnlyShadowPipeline,
  modelAgent: independentlyValidatedPointInTimeMLAdapter,
  newsRiskAgent: optionalVerifiedNewsRiskAdapter
});
const result=await coordinator.tick({market:'nifty',asOf:Date.now()});
// result.state = WAIT or PROVISIONAL_DIRECTION; never a BUY/SELL order
```

There is deliberately no default fake model. An actual ML adapter must be
trained on historical point-in-time data and independently validated before it
can qualify a forecast. A stub that returns `outOfSampleValidated:true` is
not a substitute for that evidence.

## Acceptance, rollout and technical debt

**H0 (this PR)**: isolated code and synthetic-input tests covering consensus,
disagreement, market mismatches, future/leaking data, stale quotes, spoofed
trade capability, model errors, news veto, and secret-safe error responses.

**H1**: verified feature-store schema with provider timestamps and a
reproducible model training/evaluation pipeline. Benchmark deterministic ORB
alone against XGBoost/LightGBM, test walk-forward time splits, slippage,
fees, regime shift, probability calibration and abstention coverage.
Do not treat self-reported validation flags as sufficient evidence.

**H2**: explicit instrument/segment agent adapters, verified stock-option
contracts and independent risk checks. Paper plans require verified bid/ask,
premium chronology, liquidity, broker margin, capital constraints, lots,
₹500 risk after costs, and separate execution simulation. Do not bypass the
existing 35-candle option-entry qualifier merely to issue an earlier forecast.

**H3**: durable append-only forecast, model-vote, veto and settlement storage;
verified holiday/special-session calendar; test environment, rate limits,
redaction, observability, authentication and replay. Render free disks and
sleep behavior do not provide durable or continuous operation.

**H4**: add optional local/open-weight or metered LLM solely for research
summaries and evidence-linked explanations; no autonomous real execution.
Launch a shadow-only, opt-in UI after all checks pass.

**H5**: measure directional accuracy, coverage, fees-adjusted paper outcomes,
drawdown, model drift and disagreement, across an adequate fresh
out-of-sample period. Reconsider agents only when they improve over a
simpler baseline. No claim of guaranteed profitability.

## Cost, deployment, safety and security

- No paid products, broker order API, market-data subscription or cloud
  provisioning is authorized by this PR.
- Keep server-side secrets outside Git, browser bundles, docs and logs.
  Previously reported credential exposure in Git history should be audited:
  revoke/rotate affected keys and handle history cleanup separately.
- The deployed `server/upstoxOAuthCallbackServer.js` and `src/main.js`
  remain unchanged. Production feature flags are not activated.
- Do not merge until the new GitHub qualification workflow and existing
  deployment safety regressions are reviewed.
- Underlying index forecasts are **not** option purchase recommendations.
  Human review is required before any future expansion beyond paper mode.

## Run regression checks

```sh
node --check server/hybridAgenticPaperResearch.js
node --test server/hybridAgenticPaperResearchQualification.test.js
npm ci
npm run build
```
Synthetic tests establish implementation behavior only, **not** real-world
prediction accuracy, current broker entitlement or successful live-data access.
