# Simplified AI Trade Pro intraday options screen

## Frontend
Only the automatic two-input CE/PE finder (instrument type + underlying symbol) and the 3-index paper-demo journal are mounted. The manual "Show advanced research controls" button and its original contract-search UI and polling event handlers are removed from the frontend altogether. The status, chart, strike/option-premium plan, MCX diagnostics, WAIT reasons and demo CSV/JSON export remain.

A **Connect Upstox** link is visible alongside **Analyze chart & find CE / PE**, so the user can authenticate without the retired UI.

## Internal services
The validated derivative search and quote/margin calculators remain in the read-only Upstox backend. The original research modules, safety gates and qualification tests remain in the repository and do not become real order capabilities. This change does not modify broker APIs, login behavior, signal thresholds, index/SENSEX/MCX support or demo-journal storage.

Safety remains paper-only with ₹50,000 capital and ₹500 planned risk/idea; approved real lots and order-submission authorization always zero/false.
