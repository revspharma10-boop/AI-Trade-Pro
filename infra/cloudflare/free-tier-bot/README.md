# AI Trade Pro 2.0 — Phase 1B, no-cost deployment candidate

**State: GitHub code and synthetic qualification only. NOT DEPLOYED.**
No Cloudflare account, Worker, D1 database, Upstox secret, cron, notification
or new web route is provisioned merely by merging this folder. The existing
GitHub Pages website and Render Free Upstox service remain unchanged.

## Free-tier architecture

```
GitHub Pages web UI (unchanged)
       | read-only, public research JSON (future UI integration)
Cloudflare Workers Free  <-- Cron every UTC minute, strict 5-minute IST gates
       | fetch with server-side Analytics Token only (never browser)
Upstox quote + completed 5m intraday candle APIs
       | validated exact instrument, freshness, official calendar
Existing opening-range research engine (pure JS, deterministic)
       | idempotent database inserts (forecast, later outcome)
Cloudflare D1 Free
```

The first eligible directional observation is **09:31 IST**, from completed
09:15/09:20/09:25 five-minute candles (a one-minute confirmation latency
caused by free UTC minute cron). Subsequent eligible observations are
09:36, 09:41, and so on, through the verified exchange window. If the cron
invocation arrives over 90 seconds late, it is skipped, not backdated. This
is an **early direction** — bullish/bearish/abstain — not a CE/PE purchase.

- Market list in this prototype: NSE NIFTY and BSE SENSEX only.
- The cron schedule is `* 3-10 * * 1-5` (UTC) and may invoke outside NSE
  session; the worker rejects those invocations. Exchange holidays and special
  schedules **MUST** be verified separately in D1; empty calendar = no signal.
- The worker uses the existing pure-JavaScript opening-range algorithm.
- Broker source, instrument key and last-price quote must be verified.
  Exact API rights and actual response timestamps have NOT been tested.
- The D1 `forecasts` table fixes model version, candle timestamp,
  source time, evidence hash and direction. DB uniqueness prevents replay
  duplicate forecasts.
- The `outcomes` table is separate from predictions. A later verified
  candle close relative to the captured price determines CORRECT, INCORRECT
  or INCONCLUSIVE (±2 bps); if not verifiable, UNEVALUABLE.
- The public read endpoint `/v1/public/latest?market=nifty` exposes only
  non-personal research and explicitly denies trading. It is *public* and
  therefore NOT appropriate for personal holdings, account balances, order
  history or broker credentials. Those will need authentication later.
- There is **no** option BUY output from this prototype. The existing
  independently broker-qualified paper option model remains unchanged.
- The worker does NOT request or attempt any broker order.
- There are no paid model calls or LLM inference. Higher-level news,
  fundamentals and global market features are separate research phases
  whose data permissions and cost must be independently verified.

## Published free-plan constraints (verified 2026-10)

Cloudflare Workers Free: $0 subscription, currently up to 100,000 requests/day,
**10 milliseconds CPU per invocation (including Cron)**, 50 subrequests, five
Cron Triggers per account. Network wait time does not count as CPU time.
Cloudflare D1 Free: 5 million rows read/day; 100,000 rows written/day;
**500 MB maximum per individual database**, 5 GB across the account.
When free limits are hit, invocations/queries can fail until quotas reset.
A 5-minute/approximately 2-index system should use far less than these
allowances, but quote parsing, network timing, Cron availability and real
load must be benchmarked before enabling user-facing automatic forecasts.

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://render.com/docs/free
- https://upstox.com/developer/api-documentation/rate-limiting/

**Not a guaranteed 24/7 platform**: free plans have limits, invocations can
be late or interrupted, credentials may expire, vendor API access may be
restricted, and no 99.9% uptime is promised. The worker must record skips
and refuse to generate unsupported forecasts. The existing Render Free server
may spin down and cannot be used as dependable persistent storage.

## User-owned setup needed before deployment

1. Create or connect a **free Cloudflare account**. Do not add a payment
   method, activate Workers Paid or accept a paid service without approving
   it separately.
2. Verify the currently authorized Upstox analytics credential can access
   intraday historical candles and the exact index full quote. Some Upstox
   endpoints/subscriptions may reject the credential: if so, the worker must
   abstain. Never assume long-lived OAuth authorization.
3. In Cloudflare, create a D1 Free database with name
   `ai-trade-pro-shadow-free`, then apply the reviewed
   `schema.sql` using Wrangler/D1 commands.
4. Set `database_id` in `wrangler.toml` to the *actual* ID from D1. The
   checked-in placeholder intentionally prevents immediate deployment.
5. Configure `UPSTOX_ANALYTICS_TOKEN`, `NIFTY_INDEX_KEY` and
   `SENSEX_INDEX_KEY` as private Cloudflare Worker secrets. The index
   instrument keys must originate from a broker-verified search; **do not
   generate or guess instrument identifiers**. The token MUST NOT be added to
   Git, Wrangler variables, browser environment variables or public logs.
6. Independently verify the official NSE/BSE holiday/special-session calendar
   and write a separate D1 `verified_sessions` record per market/date,
   including source ID and verification timestamp. This template does NOT
   seed any verified dates or imply a weekday is an exchange trading day.
7. Deploy and test the Cron/D1 integration in a separate Cloudflare account.
   Verify scheduled invocation arrival, actual Upstox candle/quote shapes,
   Worker CPU usage, missing-data/holiday abstention, replay idempotency,
   D1 writes, outcome verification and permitted Origin behavior.
8. Only after qualification, decide whether to connect the read-only public
   research result to the existing GitHub Pages web UI. Do not replace its
   current fully qualified option paper BUY/WAIT display.

No automatic GitHub workflow performs the account setup or deployment. This
repository's qualification runner uses **synthetic data only**.

## Suggested setup commands (manual; after account connection)

Run from `infra/cloudflare/free-tier-bot/`:

```sh
npx wrangler login
npx wrangler d1 create ai-trade-pro-shadow-free
# Paste the actual database_id into wrangler.toml.
npx wrangler d1 execute ai-trade-pro-shadow-free --remote --file=./schema.sql

# Sensitive values entered privately; Wrangler does not commit them to Git.
npx wrangler secret put UPSTOX_ANALYTICS_TOKEN
npx wrangler secret put NIFTY_INDEX_KEY
npx wrangler secret put SENSEX_INDEX_KEY

# Deploy only after verified session records are inserted and reviewed.
npx wrangler deploy
```

**Do not paste any actual API token into this chat.**

A verified calendar insert should be based on a genuine exchange trading-day
notice and independently verified, including date, market, open and close
times, status, source identifier and the time the source was checked. In the
prototype, absence or contradiction means no forecast; there is deliberately
no hard-coded calendar of made-up trading days.

## Data protection and compliance requirements

The Worker must only store instrument-level research. Cloudflare D1 is not a
per-user brokerage database. The current public site cannot expose account
holdings, balances, private news entitlements or tokens. Before any private
user account data is added: enforce authenticated access, encrypted secret
management, retention/privacy rules and broker data redistribution terms.

Data redistribution and market data access are subject to Upstox/exchange
permissions. Cron Workers Free also has no promise of execution at an exact
minute; every hypothesis must retain its real captured timestamp. Expired
tokens, unavailable official calendars and unverified quotes all produce
a skip/abstention rather than fabricated prices.

## Phase 1B qualification gate

The workflow `phase1b-free-tier-qualification.yml` checks this candidate
and previous paper-trading engine invariants:

```sh
node infra/cloudflare/free-tier-bot/qualificationRunner.js
node server/phase1LocalPipelineQualificationRunner.js
node src/phase0ArchitectureAuditQualificationRunner.js
node server/paperRecommendationFeedQualificationRunner.js
npm run build
```

The test is **not proof of a live deployment or predictive accuracy**.
Before calling Phase 1B operational, broker API verification, real Cron/D1
testing, official calendar and cloud account setup are outstanding.

## Phase 2+ free AI strategy

Keep the high-level features while staying under free limits:
- **Technical**: EMA/RSI/MACD/VWAP/ATR, five-minute opening range, market
  structure, multi-timeframe research and abstention.
- **Options**: accurate expiry, Greeks, OI, spread and broker paper
  margin when endpoint permissions permit; no forced BUY if risk fails.
- **News/fundamentals**: sourced/timestamped, rights-checked free official
  releases and authorized Upstox endpoints; unavailable information must
  be labelled unknown, not invented.
- **External impact**: GIFT NIFTY, USD/INR, crude and sector indicators only
  where provider permission, age and timeliness are verified.
- **Performance**: immutable predictions, win/loss/abstain counts, forward
  validation, drift checks and simulated costs. No uncalibrated "95%" claims.
- **AI inference**: lightweight statistical models or inference run on the
  user's device when viable; paid proprietary LLMs are excluded.

No subscription or service upgrade is permitted without further approval.
