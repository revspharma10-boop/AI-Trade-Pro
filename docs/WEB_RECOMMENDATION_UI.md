# AI Trade Pro — browser-first recommendation UI

The supported everyday interface is the web app:

**https://revspharma10-boop.github.io/AI-Trade-Pro/**

It uses the same clean, touch-friendly UI formerly packaged in the private
Android APK. The browser is enough — no install, APK, app store, or Android
build is required. On mobile the four tabs stay at the bottom; on desktop
the layout and tabs stay centered in a phone-width column.

## What each tab displays

- **Nifty:** Last broker-qualified NIFTY option *paper* recommendation.
- **Sensex:** Last broker-qualified SENSEX option *paper* recommendation.
- **Options Trade:** Currently INFY option research (not an open-ended symbol search).
- **Commodity:** MCX GOLD; research remains WAIT unless independent MCX safety
  checks have been fulfilled.

The card shows the verified contract, entry premium, target, stop loss, date,
paper status, and stage-specific **WHY WAIT?** blockers. When a setup is not
qualified, it displays WAIT and does not fabricate prices, trade executions,
lots, or a broker contract. If a contract is independently verified but premium,
liquidity, risk, or margin checks fail, the web app may show the genuine
contract name while keeping entry/target/stop blank.

The frontend calls **Render backend**:
`https://ai-trade-pro-oauth.onrender.com/api/paper-recommendations/latest?tab=nifty`
(and the other tabs) every approximately 30 seconds **while visible**.
All market data, option-contract qualification, technical indicators, and
risk calculations remain on Render. Upstox credentials must stay server-side.

The GitHub Pages origin is already an exact-match permitted origin in the
read-only CORS policy. There are no trade-order endpoints in the UI. Trading
capital is ₹50,000 and the research risk budget is ₹500 per trade; production
real orders are disabled.

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
