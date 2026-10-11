# AI Trade Pro 2.0 — accuracy evidence, high-selectivity candidate and promotion gate

## 11 October 2026 assessment

**Verified live directional accuracy: N/A (not measured).** A set of synthetic
test fixtures passing code qualification establishes software behavior, not
market forecasting skill, paper P&L, or an ability to make profitable trades.

The existing 09:30+ read-only NIFTY/SENSEX direction preview is an **on-demand,
process-local hypothesis**, not an append-only log. The live Render Free service
does not run the Phase 1A offline journal or the inactive Cloudflare Free/D1
candidate. Historical forecast-to-outcome matched records have not been provided
or authenticated for a live performance claim. Sunday's exchange closure does
not offer an independent live-market calibration session.

## What is actually implemented

- `server/phase5DirectionalAccuracyAudit.js`: offline append-only Phase 1
  event integrity audit, recomputation of correctly labeled five-minute outcomes,
  exact market/strategy/instrument/horizon/date matching, duplicate rejection,
  and chronological train/validation/test cutoffs with late-outcome embargoes.
- `server/phase5SelectiveResearchCandidate.js`: disabled **research candidate**
  requiring a completed post-09:30 5m range breakout AND current directionally
  consistent index quote. Original opening-range direction can remain visible;
  the candidate is **not** applied to live signals.
- `server/phase5DirectionalAccuracyAuditQualificationRunner.js`: adversarial
  synthetic tests of outcome labels, missing outcomes, duplicates, future records,
  mismatched keys, unverified timestamps, and stricter candidate behavior.
- `server/phase5AccuracyReportCli.js`: optional local-only report from a
  user-supplied append-only JSONL file; requires actual file contents. It never
  connects to a broker, launches a worker, writes orders, or self-certifies
  the provenance of the input as a verified live test.
- `.github/workflows/phase5-accuracy-qualification.yml`: zero-cost CI
  qualification. New modules are intentionally absent from the live server and
  browser import graph.

Run (Node 22):

```sh
node server/phase5DirectionalAccuracyAuditQualificationRunner.js
node server/phase1LocalPipelineQualificationRunner.js
node server/phase5AccuracyReportCli.js /path/to/an-existing-phase1-ledger.jsonl
```

The CLI command needs a *real* existing local ledger file. It cannot reconstruct
historical predictions from after-the-fact market prices or a current browser
screenshot. Never label synthetic fixtures as verified forward observations.

## Metrics (all must be shown together)

- **Eligible decision periods:** full denominator, including recorded abstentions.
  Missing/unrecorded 5m periods must be tracked by a verified scheduler before
  completeness/coverage can be claimed.
- **Directional coverage:** directional forecasts divided by recorded decisions.
- **Evaluable forecasts:** correct + incorrect + inconclusive five-minute outcomes.
- **Primary observed accuracy:** CORRECT / (CORRECT + INCORRECT + INCONCLUSIVE).
  Report the numerator, denominator and 95% Wilson interval. The interval is
  descriptive only: intraday forecasts can be serially dependent.
- **Decisive-only accuracy:** CORRECT / (CORRECT + INCORRECT) separately labeled;
  it is **not** the main metric because excluding inconclusive calls inflates
  the reported rate.
- **Pending and unevaluable:** published separately, never quietly marked as
  wins or excluded from coverage. Signal frequency cannot be gamed by
  reporting only the few attractive winning decisions.
- **Per-market and per-model counts:** NIFTY and SENSEX are not mixed into one
  unqualified per-instrument hit-rate claim.

**Critically:** index directional accuracy does not equal option trading
success, net profitability, capital efficiency or risk-adjusted return.
Options need verified premiums, expiry, bid/ask, IV/OI/liquidity, true
contract multipliers, transaction costs, realistic fills and margin.
₹50,000 paper capital / ₹500 maximum planned risk remains authoritative.

## Maximum *defensible* improvement path

1. During genuine exchange sessions, independently verify Upstox read-only
   access, actual exchange calendar and completed candles before freezing a
   model-versioned 5-minute prediction. If unavailable, abstain explicitly.
2. Persist the *original* timestamped forecast before any outcome exists and
   append the fixed-horizon settlement separately. Do not overwrite the
   forecast after seeing the market move.
3. Compare the existing opening-range baseline with the stricter completed-
   breakout candidate on the **same eligible opportunities**, recording
   abstentions and opportunity cost. Fewer calls do not prove higher accuracy.
4. Use chronological training, untouched validation and later untouched test
   sessions, with an embargo for overlapping or late-settled horizons.
   Predeclare model parameters and cost assumptions. Never tune thresholds
   against test results or choose only profitable dates.
5. Include volatility/trend regimes and event-day splits only when that
   evidence was available **at the prediction cutoff**. Fresh news, option
   chain, MACD/EMA/RSI, OI, IV and sector/global context may be evaluated
   as additional hypotheses; no factor is presumed to improve accuracy.
6. The initial engineering review gate requires at least 100 independently
   evaluable forward directional outcomes spanning 20 distinct sessions,
   no unexplained missing periods, model-specific paired comparison and
   reliable source/audit metadata. Those are *minimum review thresholds*
   rather than a prediction success guarantee; meaningful decisions may need
   substantially larger samples and multiple regimes.
7. No automated promotion is implemented. A trained candidate cannot loosen
   option risk gates or enable a real order. All paid data, account setup,
   persistent worker/DB activation and real-order features remain separately
   gated by explicit user approval.

## Accuracy status and release boundary

| Item | Status |
|---|---|
| Software evaluation engine | Offline and tested with synthetic fixtures |
| Higher-selectivity confirmed-breakout candidate | Offline and disabled |
| Authenticated forward market forecast/outcome journal | Not yet activated |
| Out-of-sample NIFTY/SENSEX hit-rate | N/A, insufficient verified outcomes |
| Validated improvement over deployed model | Not proven |
| Real order activation | Disabled |
| New monthly infrastructure/data charge | ₹0 |

Synthetic test reports must retain a clear `SYNTHETIC_FIXTURE` or
`UNVERIFIED` provenance marker. This module intentionally refuses
automatic model promotion, irrespective of apparent accuracy.
