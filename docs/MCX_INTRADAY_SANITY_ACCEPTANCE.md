# AI TRADE PRO — MCX INTRADAY END-TO-END SANITY ACCEPTANCE

**Test case:** SANITY-MCX-001  
**Area:** Recommendation-only NSE/MCX intraday frontend + Render backend + authenticated Upstox live-read data  
**Priority:** P0 release gate for commodity market-data research  
**Procedure owner:** Manual QA / user; developer owns defects  
**Status:** Not executed against authenticated production Upstox. CI/mock qualification is **not** a substitute for this live acceptance.

## Scope and release policy

**Single primary happy path:** open GitHub Pages, authenticate Upstox, select **MCX Commodity Future** and underlying **GOLD**, choose an exact live, unexpired contract, view 5-minute research, start 30-second refresh, and verify **WAIT** with transparent risk reasons and no broker orders.

**Recommended conditions:** a non-holiday MCX business day, during GOLD futures' regular exchange session, preferably after **12:00 IST** so at least 35 completed 5-minute bars exist. Verify the official exchange holiday/special-session notice; app clock alone is not a holiday calendar. Use a liquid contract that is **not** in its expiry/tender/delivery-risk period. For 1m/15m, the 35-completed-bars criterion is applied to that interval; early-session and NSE 15m runs may legitimately have insufficient history.

**Use these URLs; do not paste credentials or access tokens into chat/reports:**
- Frontend: https://revspharma10-boop.github.io/AI-Trade-Pro/
- Backend health: https://ai-trade-pro-oauth.onrender.com/health
- Backend session status: https://ai-trade-pro-oauth.onrender.com/api/upstox/status
- Upstox login launch: https://ai-trade-pro-oauth.onrender.com/auth/upstox/start
- CI: https://github.com/revspharma10-boop/AI-Trade-Pro/actions

**No-trading invariant:** `PAPER_ONLY=true`, `REAL_ORDER_PLACED=false`, `PRODUCTION_REAL_TRADING_ENABLED=false`, `orderSubmissionAllowed=false`. **Do not place a real order in this test.** BUY/SELL and a claimed 90% winning probability are **not** success criteria: strategy qualification and actual performance validation are not completed, so **WAIT** is expected.

## Sanity test SANITY-MCX-001 — step by step

Mark each step **PASS / FAIL / BLOCKED / NOT RUN**. A safety defect is **FAIL**; a missing login, closed exchange, or upstream outage is **BLOCKED**, not evidence that the feature passed.

| Step | Tester action | Acceptance criteria — PASS | FAIL or BLOCKED reason | Fix / corrective action |
|---|---|---|---|---|
| S01 | Open frontend on desktop Chrome and refresh once (Ctrl+F5). | Page loads without blank UI. Shows **AI TRADE PRO**, **Intraday AI Recommendations**, MCX FUT/CE/PE selector, timeframe, **Analyze Intraday**, **Start 30s refresh**, **WAIT**, and **REAL ORDERS BLOCKED**. | **FAIL** blank/error/old paper dashboard; stale cached Pages deployment or JS exception. | Re-run GitHub Pages deployment; check Actions **Deploy Frontend to GitHub Pages** and browser Console, then hard-refresh. |
| S02 | Open `/health` in another tab. | HTTP **200** and text includes `AI_TRADE_PRO_OAUTH_CALLBACK_HEALTHY`, `PAPER_ONLY=true`, and `PRODUCTION_REAL_TRADING_ENABLED=false`. | **BLOCKED** timeout/5xx or Render asleep/deploy issue; **FAIL** missing safety flags. | Check Render service **running**, latest deployment commit, start logs, environment config, health route. Do not enable orders. |
| S03 | Open `/api/upstox/status`. | HTTP **200**; `provider:"UPSTOX"`; `authenticated:true`; `marketDataMode:"READ_ONLY"`, `orderSubmissionAllowed:false`, `realOrderPlaced:false`, `productionRealTradingEnabled:false`. | **BLOCKED** `authenticated:false` (missing/expired/restarted in-memory token); **FAIL** any order flag true or leaking token. | Open OAuth **start** URL and complete login; recheck status. On Render restart a fresh login is needed. Never paste tokens. Safety flag issues require backend rollback/fix. |
| S04 | Choose **MCX Commodity Future** and replace default **RELIANCE** with **GOLD**. | MCX category is selected; **Find contracts** and **Exact exchange contract** dropdown are visible; prior technical values disappear after changes. | **FAIL** control missing, wrong exchange displayed, old recommendation/evidence persists. | Check `src/intradayRecommendationsUI.js`, Pages build and cache; clear stale evidence on selection changes. |
| S05 | Click **Find contracts** and inspect results. | Request `/api/upstox/derivative-search?query=GOLD&type=FUT&exchange=MCX` returns **200** with at least one **MCX_FO FUT** contract containing instrument key, future expiry, lot size, tick size and underlying `GOLD`. Options must have strike too. | **BLOCKED** no eligible contracts/expired entitlement; **FAIL** HTTP 404 if new backend not deployed; 502 upstream search failure; schema missing/filtered fields. | For 404 **deploy Render backend**, not just GitHub Pages. For 401 reauthenticate. For 502 inspect Render logs/API permissions and official Upstox instrument-search response. Never fabricate an instrument key or expiry. |
| S06 | Select the **exact unexpired GOLD future** from the dropdown, choose **5 minutes**, click **Analyze Intraday**. | Correct instrument type **COMMODITY_FUTURE**, correct symbol/expiry/lot shown; no UI crash. Data request targets the selected `MCX_FO|...` key, not NSE. | **FAIL** wrong key/segment/contract or JS error; **BLOCKED** missing selected contract/login. | Re-select and retest; verify contract identifier is taken from response and unchanged. Examine browser Network and backend search mapping. |
| S07 | Inspect **Quote LTP**, **Verified spread**, **Quote response (IST)**, **Last actual trade (IST)**, and their ages. | Live quote endpoint 200; instrument key matches; positive LTP; bid > 0, ask >= bid; response age <= **120 seconds**; **last actual trade age <= 120 seconds**; valid spread meets the commodity futures research floor (currently <= **0.5%**). | **BLOCKED** `UPSTOX_LIVE_QUOTE_FAILED` / `UPSTOX_RATE_LIMITED`; **expected WAIT/block** `LAST_TRADE_STALE_OR_UNDATED`, stale response, no depth, high spread or illiquid contract. **FAIL** stale trade treated as valid, wrong instrument. | Check quote route, upstream entitlement and selected key; choose actively traded contract. **Use Upstox `last_trade_time`**, not quote response `timestamp`, for last-trade freshness. Do not weaken freshness gate. |
| S08 | Inspect **Intraday candles** and **Latest completed candle**. | `/api/upstox/intraday?...&interval=5m` returns 200 with valid 5m OHLCV, >= **35 completed bars in today's IST session**, strictly ordered/unique times, valid high/low, no future/incomplete candle in calculation, last completed bar no more than approx. **7 min** behind request. | **BLOCKED** `UPSTOX_INTRADAY_DATA_EMPTY`, insufficient recent history before 12:00 IST, market closure; **FAIL** invalid candles accepted as good. | Wait until sufficient completed candles or test 1m; inspect V3 candle API and correct instrument, timezone and sort; reject invalid/stale feeds rather than inventing prices. |
| S09 | Inspect technical evidence and risk reasons. | If S08 passes: finite close, VWAP, EMA9, EMA21, RSI14, MACD histogram, ATR14, turnover/volume ratio, research bias (BULLISH/BEARISH/MIXED). Decision **WAIT**, confidence and success probability **not established**, no invented entry/SL/targets. | **FAIL** NaN, fabricated indicators, displayed BUY/SELL or `90% success` without independently verified results; **BLOCKED** insufficient candles/research. | Investigate candle alignment/indicator calculation; keep unqualified signal at WAIT until backtest and forward qualification satisfy documented criteria. |
| S10 | Check MCX safety gates in **Qualification reasons**. | MCX session group/cutoff is shown. Missing holiday calendar, broker square-off, margin, tender/delivery verification, OI, tick size, multiplier or option Greeks must **block recommendation**. Expired/expiry-day contracts block. | **FAIL** app marks missing metadata as trade-qualified, or allows a trade outside verified session. | Correct `intradayMarketClock.js`, `intradayInstrumentContract.js`, `intradayRiskEngine.js`; don't assume market holiday/square-off or delivery risk validated from wall clock alone. |
| S11 | Click **Start 30s refresh**; keep page visible for **65–75 seconds**. | Button changes to **Stop 30s refresh**. At least **two** additional read-only refresh requests are visible in Chrome DevTools > Network, with new response/refresh times. New trading price is **not required** (may remain unchanged). No overlapping request storm or broker order requests. Click Stop; requests stop. | **FAIL** no repeated requests, wrong selected key, control stuck, stale data displayed as fresh, duplicate runaway polling; **BLOCKED** throttling/network loss. | Verify page remains visible, session true, DevTools requests and timer; fix interval lifecycle and stale response handling; rate-limit errors must remain visible and not trigger BUY/SELL. |
| S12 | Negative: choose invalid/expired contract (if available), test outside session, or disconnect authentication then Analyze. | **WAIT**, clear reason such as `UPSTOX_REAUTHENTICATION_REQUIRED`, `MCX_CLOCK_CLOSED`, `CONTRACT_EXPIRED`, or `LAST_TRADE_STALE_OR_UNDATED`. No fake 90% success. | **FAIL** recommendation still BUY/SELL, old evidence remains after selection, stale/no-auth data treated as live. | Invalidate previous state on symbol/contract/timeframe change, require qualified evidence every refresh, keep fail-closed recommendation engine. |
| S13 | Security check: inspect API JSON/Network for token and order routes. | Browser receives only read-only data and status, **no access_token/client_secret**; **no order submission**; `/api/upstox/place-order` and `/api/upstox/order` return **404**, and order counters/flags remain false. | **FAIL / STOP RELEASE** if token exposed, order route active, real order created, production trading enabled. | Roll back deploy; remove unsafe route, revoke/exchange affected credentials server-side if exposed, restore safeguards and retest. Do not call a POST trading route. |
| S14 | Open GitHub Actions, check latest **Intraday Recommendation Safety Qualification** for the tested commit. | Test suite and `npm run build` green; MCX mock-backed API, risk, quote-freshness and unit regressions pass; record commit SHA in evidence. | **FAIL** workflow red or tested SHA older than deployed source; **BLOCKED** queued/in-progress. | Read failing step logs, fix code/fixtures, push, rerun. Build green alone is not evidence that live Upstox API works. |

### Outcome classification

- **PASS (functional sanity):** All S01–S11 and S13–S14 pass under genuine authenticated, open, live-market conditions. S12 negative checks pass. Technical bias is allowed, but only **WAIT** is a qualified final decision in the current release.
- **BLOCKED (not accepted):** Render unavailable, Upstox authenticated false, exchange closed/holiday, missing instrument entitlement, upstream outage, no actively traded contract, or too few completed 5-minute bars. Record the step and rerun later; never mark blocked checks passed.
- **FAIL (defect):** Wrong security flags, leaked token, real order route, fabricated entry/SL/targets, reported 90% probability without data, stale last-trade accepted, invalid OHLCV accepted, wrong instrument/expiry, crashing frontend, incorrect refresh.
- **RELEASE STATUS:** Read-only **research sanity** is separable from recommendation strategy qualification. No live actionable BUY/SELL or advertised 90% success until statistically validated out-of-sample and forward results with fees, slippage, derivatives risk and verified session calendar.
- **Known technical limitation:** Current 15-minute NSE analysis may lack enough same-session completed bars (35 required). An insufficient-data **WAIT** is correct. Existing MCX exchange-clock rules are **not** a full holiday/special-session calendar or broker-specific compulsory square-off schedule. Credential-free mocked CI cannot prove production Upstox entitlements. GitHub Actions previously reported high-severity dependency advisories; triage before a production security signoff.

### Troubleshooting shortcuts (do not skip negative/safety checks)

| UI/network error | Root cause to verify first | Correct action |
|---|---|---|
| `UPSTOX_BACKEND_UNREACHABLE` / `Failed to fetch` | Render outage, DNS, CORS, browser networking | Open health; inspect Console/Network; restart redeploy service; verify CORS origin `https://revspharma10-boop.github.io`. |
| `BACKEND_ROUTE_NOT_DEPLOYED` / HTTP 404 | Frontend ahead of Render backend version | Redeploy Render service from latest `main`, then verify route with authenticated session. |
| `UPSTOX_REAUTHENTICATION_REQUIRED` / HTTP 401 | Expired or lost in-memory Upstox token | Use OAuth start; never paste a token into chat. |
| `UPSTOX_RATE_LIMITED` / HTTP 429 | Polling/API entitlement threshold | Stop auto refresh temporarily; respect provider limit and retry later. |
| `UPSTOX_DERIVATIVE_SEARCH_FAILED` | Search filter/contract entitlement/provider API changed | Check response schema, exchange `MCX`, segment `FO`, exact underlying and expiry; don't manufacture contracts. |
| `UPSTOX_LIVE_QUOTE_FAILED` / depth unavailable | Provider quote endpoint unavailable or contract illiquid | Inspect selected instrument key/provider permissions; do not call the quote 'fresh' without last trade. |
| `LAST_TRADE_STALE_OR_UNDATED` | No recent actual trade or quote missing `last_trade_time` | Select liquid contract or wait. Correct server mapping if field omitted; **never** substitute quote generation timestamp. |
| `UPSTOX_INTRADAY_DATA_EMPTY` / insufficient completed bars | No intraday bars or early session | Check instrument interval; switch to 1m or wait; keep WAIT. |
| `OPTION_GREEKS_NOT_VERIFIED` | Greeks unavailable for chosen option | Verify options entitlement/response, block options recommendations. |
| `MCX_HOLIDAY_CALENDAR_NOT_VERIFIED` / `MCX_BROKER_SQUARE_OFF_NOT_VERIFIED` | Missing authoritative exchange and broker calendars | Integrate approved schedule sources and unit tests; only clear gates on actual verified data. |
| `STRATEGY_NOT_BACKTESTED_AND_FORWARD_VALIDATED` | Strategy research is not yet qualified | Keep WAIT; complete out-of-sample backtesting, forward paper research, robust per-instrument risk and costs. |

### Execution record — fill in during your live manual test

| Field | Value |
|---|---|
| Tester | |
| Test date/time (IST) | |
| GitHub Pages deployed SHA / Render backend SHA | |
| Browser/version | |
| Exact MCX trading symbol, `instrumentKey` (public instrument key only) | |
| Contract expiry, lot, tick, multiplier | |
| Upstox session `authenticated:true` verified? | |
| Latest quote response time / actual last trade time | |
| Number of completed 5m candles and last timestamp | |
| Observed LTP / bid / ask / spread | |
| Indicators / preliminary liquidity / risk blockers | |
| Auto refresh request times (at least 3 total samples) | |
| Final WAIT / order flags verified? | |
| S01–S14 PASS/FAIL/BLOCKED summary | |
| Defect ID, screenshot with credentials/auth codes redacted, reason / owner / fix / retest | |
| **Final verdict** | **NOT RUN — waiting for authenticated production manual acceptance** |

**Developer CI:** `node src/intradayRecommendationQualificationRunner.js`; `node src/intradayInstrumentQualificationRunner.js`; `node src/intradayTechnicalQualificationRunner.js`; `node src/intradayPerformanceQualificationRunner.js`; `node src/commodityIntradayQualificationRunner.js`; `node src/commodityReadOnlyBackendQualificationRunner.js`; `node src/intradaySanityDiagnosticQualificationRunner.js`; `npm run build`. These run without live credentials and cannot be marked as the production market sanity verdict.
