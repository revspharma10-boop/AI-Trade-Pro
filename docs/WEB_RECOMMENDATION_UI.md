# AI Trade Pro — browser-first recommendation UI

The supported everyday interface is the web app:

**https://revspharma10-boop.github.io/AI-Trade-Pro/**

It uses the same clean, touch-friendly UI formerly packaged in the private
Android APK. The browser is enough — no install, APK, app store, or Android
build is required. On mobile the five tabs stay at the bottom; on desktop
the layout and tabs stay centered in a phone-width column.

## What each tab displays

- **Nifty:** Last broker-qualified NIFTY option *paper* recommendation.
- **Sensex:** Last broker-qualified SENSEX option *paper* recommendation.
- **Options Trade:** Currently INFY option research (not an open-ended symbol search).
- **Commodity:** MCX GOLD; research remains WAIT unless independent MCX safety
  checks have been fulfilled.
- **BTC:** A prominent source-timestamped **BTC/INR** price. A fresh CoinDCX public BTCINR trade is preferred; if stale/unavailable, separately identified CoinGecko or CoinPaprika BTC/INR **indicative market prices** are eligible. Refreshed about every 30 seconds while the browser is visible. No graph, no live order. Independent BTC/USD technical analysis is not an INR-specific order recommendation.

The card shows the verified contract, entry premium, target, stop loss, date,
paper status, and stage-specific **WHY WAIT?** blockers. When a setup is not
qualified, it displays WAIT and does not fabricate prices, trade executions,
lots, or a broker contract. If a contract is independently verified but premium,
liquidity, risk, or margin checks fail, the web app may show the genuine
contract name while keeping entry/target/stop blank.

The frontend calls **Render backend**:
`https://ai-trade-pro-oauth.onrender.com/api/paper-recommendations/latest?tab=nifty`
(and the other tabs) every approximately 30 seconds **while visible**.
The footer now distinguishes the browser's most recent successful fetch
("Browser received") from the backend's own `lastCheckedAt` research time,
shown in IST. A browser refresh does **not** imply a new candle or fresh
backend analysis. Current **PAPER BUY** cards fail closed to WAIT if the
backend timestamp is missing, malformed, future-dated, over six minutes old,
or inconsistent with the recorded idea's capture time; past cards remain
clearly labeled previous paper ideas. This does not upgrade market-data access.

All market data, option-contract qualification, technical indicators, and
risk calculations remain on Render. Upstox credentials must stay server-side.

The GitHub Pages origin is already an exact-match permitted origin in the
read-only CORS policy. There are no trade-order endpoints in the UI. Trading
capital is ₹50,000 and the research risk budget is ₹500 per trade; production
real orders are disabled.

## 2026 equity-session preflight (Phase 2 safety qualification)

The read-only backend now checks published NSE/BSE 2026 regular-session
closures for NIFTY, SENSEX and the NSE stock-options research tab **before**
calling Upstox. Sundays, Saturdays, exchange holidays, the unverified
special Muhurat session, and dates beyond the versioned calendar fail closed
to WAIT with human-readable reasons. MCX keeps its separate commodity guard.

Calendar sources: [NSE published 2026 equity holidays](https://www.nseindia.com/resources/exchange-communication-holidays)
and [BSE's equity/equity-derivatives holiday notice 20251212-8](https://ebs.publicnow.com/view/D4BE5C5CC7A53646FD58A2FB3A2C7ABA58C8CFC9).

**Important:** This is an offline published regular-day calendar, not a
live exchange-status API. A published weekday may still have an emergency
closure, changed exchange notice, market-data outage, or Upstox permission
failure. The planner reports `liveSessionVerified:false`; it never claims
a live session, validates live broker credentials, or turns an opening-range
bias into an option order. Beyond 2026, update and independently qualify the
calendar before attempting regular paper research.

## Operational limitations

- GitHub Pages is a **publicly accessible** website; the paper feed is also
  served by a publicly reachable read-only backend endpoint. Do not treat
  this as a private account-specific trading dashboard. If privacy or
  per-user access is required, add authenticated access controls and secure
  storage before exposing private data.
- Browser polling stops when the tab is suspended or closed. The backend's
  in-memory latest-paper snapshot is not a durable trade journal, and there
  is no continuous market-monitoring worker or push notification service.
- An Upstox authorization expiry, missing candles, market holiday, or
  unverified options/risk/margin will correctly produce WAIT. A functioning
  webpage cannot guarantee a CALL/PUT research setup.
- Opening the site from Android Chrome and using **Add to Home screen**
  gives convenient phone access without building an APK. This does not
  add background execution.
- The legacy Android packaging GitHub Actions workflow is now manual-only,
  and normal changes no longer trigger APK creation.

## Release checks

The GitHub Pages workflow checks the four navigation tabs, 30-second
foreground polling, server-authoritative option values, paper-only safety,
broker-rejection explanations and exact-origin CORS before each deployment.


## Phase 2: provisional opening-range direction (index tabs only)

The Nifty and Sensex screens have a **separate read-only opening-range
direction card** when the backend validates three completed 09:15, 09:20,
and 09:25 IST 5-minute candles, the post-09:30 session clock, fresh
instrument-matched Upstox quotes, a clear predeclared opening-range
hypothesis and the regular-session schedule. The separate label reads
**BULLISH** or **BEARISH**, never a CALL or PUT option buy.

- A provisional directional hypothesis does **not** authorize an option
  trade, indicate a strike/expiry/premium, or satisfy the stricter 35-candle
  full paper-option setup and ₹500 risk/margin/liquidity checks.
- The first independently validated early direction is frozen for the
  current five-minute decision slot (12-second feed grace). A broker quote
  that is stale, has the wrong instrument key, or has invalid provider
  status results in no early direction.
- The browser independently validates read-only flags, backend timestamp
  consistency, market identity and the forecast slot, before displaying
  the card. Options Trade (INFY) and Commodity never inherit an index
  direction from another tab.
- This is a **transient process-memory observation only**, not a
  continuously scheduled or durably recorded forecast. Render Free restarts
  can erase the preview. No success-rate, trade outcome, guaranteed signal
  frequency, real-time background monitoring or paper P&L can be claimed
  from this card.
- No price, target, order execution, account position, secret or personal
  trading record is exposed by the new directional payload.
- Sunday/weekends, published equity holidays, stale broker research and
  absent authorization still correctly show WAIT/no preview.

Automated CI fixtures use **synthetic** broker-like prices. Qualification
does not prove Upstox live entitlements, exchange availability, or market
prediction accuracy. True forward outcome tracking still requires separate
immutable event storage and next-session evidence.


## Fifth bottom tab: Crypto / BTC/USD (public Kraken spot, paper-only)

The existing four-tab mobile-style web interface gains a **Crypto** tab.
This initial market is **BTC/USD (US dollars)**, not BTC/INR, MCX,
a crypto derivative, a real Upstox instrument or an exchange account.

- Backend-only public GET:
  `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=5`
  via `GET /api/crypto-research/latest`. No Kraken API key, paid
  subscription, or order authorization is configured.
- Operates on a 24/7 clock, including weekends. A rolling 15-minute
  reference range consists of **three consecutive completed** five-minute
  bars. A **fourth completed bar** with sufficient observed activity must
  close beyond the range (with a predeclared buffer) to yield provisional
  **BULLISH** or **BEARISH** research.
- Kraken's last OHLC entry is **uncommitted**. It is deliberately excluded,
  and all candle times, continuity, OHLC bounds, volume, provider errors,
  exchange pair identity, and 12-second close grace are checked.
- The displayed dollar value is the **last completed five-minute close**,
  explicitly *not* a live/executable bid, ask or guaranteed entry.
- Status remains **WAIT** for crypto trade setup regardless of the directional
  research result. The crypto screen hides option price/stop/target blocks
  and the irrelevant Upstox connection button.
- A hypothesis freezes for its current five-minute decision slot. The browser
  polls the backend every 30 seconds only **while visible**; Render Free
  sleeps/restarts are possible. This is **not** unattended 24/7 monitoring.
- Unknown, stale, malformed, missing, provider-blocked or mismatched candles
  give WAIT and no directional preview. No fabricated confidence score,
  crypto order, recorded forecast outcome, option-chain selection or P&L.
- NIFTY, SENSEX, Options Trade and Commodity research retain their prior
  broker-backed checks. Real trading remains disabled everywhere.

Public reference: Kraken spot OHLC documentation states that the last
entry is current and uncommitted:
https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/
Kraken's public market-data API is available without a Kraken account, with
rate limits. Crypto prices are volatile and individual exchange prices may
differ. Crypto taxation, eligibility, currency conversions and jurisdictional
requirements are outside this read-only research experiment.

The qualification uses synthetic BTC/USD market examples. **No historical
or live forward crypto prediction accuracy has been established.**


## BTC high-confluence research (experimental, Phase 3)

The initial 4-candle BTC direction is replaced with a more selective
research screen, based on **at least 360 consecutive completed 5-minute
Kraken BTC/USD spot candles** (30 hours, and at least 21 complete hourly
candles assembled *only* from completed five-minute candles).

Every gate is required; otherwise the Crypto tab shows WAIT:
1. Completed 5-minute closing breakout beyond the preceding 12 bars
   (one-hour range), including an ATR-scaled buffer.
2. Current completed 5-minute candle volume at least 1.2× the preceding
   20-bar average and non-zero trade count.
3. 5-minute EMA21 above/below EMA50 aligned with the breakout direction.
4. Reconstructed *completed* one-hour EMA9 above/below EMA21.
5. Wilder RSI14 bullish 54–75 / bearish 25–46; avoid the most extended
   overbought/oversold candles.
6. MACD12/26 with EMA9 signal-line histogram aligned to direction.
7. BTC 24-hour **OHLC typical-price, volume-weighted approximation**
   aligned to direction, **not genuine trade-by-trade VWAP**.
8. ATR14 between 0.03% and 2.0% of price and no overextension of more
   than 4 ATR from EMA21.

A qualifying outcome is **HIGH CONFLUENCE · UNVALIDATED**, not a proven
higher-accuracy market model. All thresholds are predeclared but still
await walk-forward research and independent real-market outcomes.
Volatility, RSI and volume thresholds are uncalibrated research assumptions
and may be too strict or insufficient across market regimes.

The interface may display the USD **last completed candle close**,
illustrative ATR-derived invalidation and T1/T2/T3 levels in a dedicated
directional research card. They are *not* executable quotes, a spread-verified
entry, stop or exit, position size, or observed paper fill. No USD/INR
conversion, brokerage cost, taxes, fee, slippage or verified Kraken order-book
liquidity is incorporated, so ₹50,000/₹500 lot sizing is not performed for
BTC. Spot bearish direction does not assume short-selling availability.
Paper-only restrictions and real-order disablement remain unchanged.

Kraken confirms that the most recent OHLC record is uncommitted, and the
endpoint supplies at most 720 recent entries:
https://docs.kraken.com/api-reference/market-data/get-ohlc-data

Provider outage, incomplete intervals, price anomalies, weak breakout,
inconsistent higher timeframe or indicator disagreement all result in WAIT.
No model confidence percentage or prediction accuracy is fabricated.
The system remains on-demand/visible-browser research on free Render,
not a separately scheduled 24/7 trading bot.


## Live BTC/INR numeric display — no graph

The fifth navigation tab is named **BTC**. Its primary readout is the
**BTC/INR market price** with Indian rupee grouping
(e.g., `₹93,12,345.67` is a **synthetic formatting illustration**, not
a real BTC quote). It is **not** a converted USD price.

Primary: [CoinDCX public ticker](https://docs.coindcx.com/),
`GET https://api.coindcx.com/exchange/ticker`, exact `BTCINR` market,
only if the **actual last-trade timestamp is fresh (at most 90 seconds)**.
Fallback: CoinGecko public simple-price `bitcoin/inr` endpoint, with
`last_updated_at` freshness at most 120 seconds. The fallback is an
**indicative composite market price**, not a CoinDCX spot last trade.
Both sources are unauthenticated and return INR directly. No user-side
USD/INR conversion is performed.

The fixed read-only backend route is `GET /api/crypto-price/inr/latest`;
both feeds are briefly cached to limit traffic. On missing, stale or
rate-limited sources the displayed BTC/INR price is unavailable.

The browser independently fetches this endpoint around every 30 seconds
**while the tab is visible**. A fresh exchange timestamp is mandatory;
if absent, over 90 seconds old, future dated, mismatched, duplicated or
malformed, the screen displays **₹ — / price unavailable** instead of
claiming a stale quote is live. Every verified numeric price includes
the source's last-trade timestamp in IST. This is **periodic near-real-time
refresh**, not a streaming tick feed or guaranteed 24/7 service.

A last-traded or indicative market price differs from an executable bid or ask and may differ
between exchanges due to spread, liquidity, fees and market conditions.
No chart is rendered. Existing Render sleeps/starts can delay access; the
UI visibly fails closed until fresh market data return.

**Research distinction:** the separately qualified BTC directional confluence
and GitHub 5m shadow-history pipelines are built on **Kraken BTC/USD candles**.
They are retained as *global BTC technical context* and are **not
validated BTC/INR trading entry, stop or INR targets**. No currency
conversion of the USD reference/ATR targets is shown or implied. A later
BTC/INR-specific prediction requires independently qualified, complete
historical INR candles; a last-traded-price ticker is not sufficient.
No external brokerage or real crypto trades are enabled.

Cash capital and real-order safety remain unchanged.


## October 11 BTC price availability qualification

The initial BTC/INR screenshot showed `₹ —`. Public backend diagnostics
verified CoinGecko live INR availability, with CoinDCX trade timestamp
initially rejected. Root cause in the CoinDCX parser: its exchange ticker
reports Unix **seconds**, but the old parser mistakenly compared those values
directly against JavaScript milliseconds. The updated parser normalizes only
unambiguous Unix seconds (10-digit) or milliseconds (13-digit) and rejects
invalid, future, stale and ambiguous timestamps.

A third free fallback is now `GET
https://api.coinpaprika.com/v1/tickers/btc-bitcoin?quotes=INR`.
Its `id`, `symbol`, `quotes.INR.price` and `last_updated`
must pass strict type, identity and <=120-second freshness checks before any
display. CoinPaprika is tagged **indicative**, never an executable CoinDCX
trade. There are now three explicitly attributed sources in priority order:
fresh CoinDCX BTCINR last trade; fresh CoinGecko INR indicative; fresh
CoinPaprika INR indicative.

All three feeds are fetched independently with bounded timeouts so a
single provider outage cannot indefinitely block a numeric price.
The browser has a 15-second request timeout and a 30-second visible-only
refresh. If no source is fresh, the correct UI is `₹ —` plus an
unavailable explanation; never show a stale quote as live. This is
near-real-time polling, **not exchange streaming**, and can still fail during
provider restrictions, connectivity outages or Render Free cold starts.
No paid services, FX conversion, trade orders or graphs.


## 12 October 2026 — BTC/INR numeric-refresh hardening

A direct production diagnostic confirmed that the deployed
`GET /api/crypto-price/inr/latest` returned HTTP 200, `LIVE_PRICE`,
a **CoinDCX direct BTC/INR spot last trade only two seconds old**. The
request took about **13 seconds**, consistent with a Render Free
warm-up delay. CoinGecko's last INR update was 21 seconds old; the
CoinPaprika observation was 205 seconds old and was therefore correctly
ineligible as a fresh backup. This is a single dated observation,
not a claim about continuous market-feed availability.

The browser now maintains an **independent BTC/INR poll** approximately
every 30 seconds while visible, as well as an immediate quote fetch on
entering the BTC tab, returning from a hidden page, and manually
refreshing. A slow/read-only Kraken technical research call cannot
starve the primary displayed rupee value.

The read-only INR request allows a 27-second timeout (instead of
15 seconds) for occasional Render Free cold starts. It rejects
outdated-tab results and duplicate in-flight polls. The existing
backend **exchange timestamp freshness** and frontend source-identity
and timestamp gates remain mandatory. If a source cannot be verified,
show `₹ —`, not an old trade mislabeled as current.

This is *near-real-time polling*, never a guaranteed exchange
stream. No chart, options trade, BTC position, paid service, INR
exchange execution price or USD-converted target is introduced.
