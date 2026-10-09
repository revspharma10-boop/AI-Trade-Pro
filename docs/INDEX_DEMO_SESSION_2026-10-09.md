# Index Options Paper Demo — Friday 9 October 2026

## Supported indices
NIFTY 50 (NSE_INDEX / NSE_FO), BANKNIFTY (NSE_INDEX / NSE_FO), SENSEX (BSE_INDEX / BSE_FO). Exact Upstox instrument search and option-contract API must return current listings. The SENSEX BSE path is deliberately exchange-specific; NSE instrument keys are never substituted for BSE.

## Preflight
- Check authentic Upstox read-only status, endpoint availability and exchange clock. Production Render backend must have the latest GET-only index and option contract routes deployed.
- Market session expected 09:15–15:30 IST Friday Oct 9, conditional on official exchange holidays, broker data permissions and market availability. Monitor every 5 minutes between **09:20–15:20 IST**.
- The current 5-minute indicator strategy uses **35 completed same-day candles**, hence the earliest strong qualification is about noon, not the opening 5-minute candle.
- To arm the browser-bound scheduler, press **Arm tomorrow’s paper demo**, keep the tab open, browser awake, online. Local browser storage must be allowed. Closed computer/tab or expired broker authentication cannot be worked around by this UI. No server-side scheduler has been provisioned.

## Observation and review
- Each check scans the three indices **sequentially** from current read-only candles and quotes; no synthetic index or option prices.
- Append immutable, de-duplicated snapshots keyed by date, symbol, actual 5-minute candle timestamp; includes instrument, EMA9/EMA21, RSI14, MACD, ATR, input price, directional CE/PE hypothesis or WAIT with blockers, matching listed option and premium/target/SL where valid, and zero executable lots.
- At least 30 minutes later, compare the originally frozen index-direction hypothesis against actual subsequently completed same-day index bars. Labels: CORRECT_DIRECTION, WRONG_DIRECTION, INCONCLUSIVE_NOISE, or still PENDING. The directional move must exceed max(0.25 ATR, 0.05% index price) to avoid treating noise as a win/loss. Do not evaluate WAIT as a wrong prediction.
- Record why a candidate failed as review hypotheses, not causal truth or automatic model updates. The demo journal is **not ML model self-training**. Any proposed rule changes require separate backtests, out-of-sample validation, and explicit approval.
- **Index-direction accuracy is not option P&L**. No real fills, fees, execution slippage, or market order submissions are inferred. Export CSV / JSON after market close. All journal data lives in this browser's localStorage, not a cloud database.

## Safety
PAPER_ONLY=true; REAL_ORDER_PLACED=false; PRODUCTION_REAL_TRADING_ENABLED=false; approvedRealLots=0. Capital ₹50,000, nominal risk ₹500 per hypothetical option trade, broker available funds unverified. No trades are authorized, no real orders placed.

## Broker quote polling (30 seconds)

The visible Automatic CE/PE research panel polls read-only Upstox quote endpoints for the selected underlying (and verified option contract, if resolved) approximately every 30 seconds. It begins after Analyze resolves an instrument, works only while the browser tab is visible, the exchange clock is open, and the backend is available. Quotes older than 120 seconds, mismatched instrument keys and unverified option bid/ask or last-trade timestamps display NOT CURRENT, never a fabricated live price. It is HTTP polling, not WebSocket ticks. Completed 5-minute technical candles and provisional CALL/PUT research are **not** recalculated by quote polling. The user must press Analyze again to recalculate. Old displayed provisional paper levels are invalidated after two minutes to prevent using them as current entries. The separate armed Oct 9 three-index demo journal retains its 5-minute research snapshot schedule.

## Frozen five-minute CALL/PUT/WAIT research

Once an instrument is selected and Analyze is pressed, the paper-only CALL/PUT/WAIT result, exact option contract and premium entry/stop/targets stay frozen within the current settled five-minute candle interval. Upstox quote and bid/ask polling remains on its separate ~30-second schedule and **must not alter the frozen prediction**. Automatic re-analysis starts after the next completed five-minute candle is eligible (~12 seconds after a candle-clock boundary), checked by a 30-second browser timer. The real refresh may be delayed by browser throttling, connectivity and the Upstox API. Previous results are marked **WAIT — EXPIRED** after the interval if the update is missed; they are not represented as live orders. The browser must remain visible and awake, the selected exchange session open, and Upstox authenticated. A deliberate new symbol or instrument type resets the snapshot and requires the first Analyze click. This replaces an incompatible two-minute automatic price-expiration rule. Capital ₹50,000, planned risk ₹500, real orders disabled. Oct 9 three-index demo journal retains its own separate five-minute snapshot schedule.

## Prediction → outcome → technical and fundamental self-review
1. Freeze an original NIFTY, BANKNIFTY or SENSEX CE/PE direction before seeing the future. Preserve original timestamp, quote, EMA9/21, RSI14, MACD, ATR, optional VWAP, exact listed option/paper levels, blockers, and read-only evidence.
2. At least 30 minutes **after recordedAt**, and only after an actual later five-minute candle completes, determine correct-direction / wrong-direction / inconclusive-noise. This fixes the earlier review-clock error that used candle-start time instead of prediction capture time. WAIT is not a forecast and must never be counted as a failed prediction.
3. Where same-day completed OHLCV data is sufficient, reconstruct outcome-time EMA9/21, RSI14, MACD, and VWAP strictly using bars at or before the measured outcome candle. Identify demonstrated trend crossover, MACD sign change, RSI reversal or VWAP position change without claiming any of them *caused* price action.
4. Fundamental/earnings/macro analysis for a whole index requires separately timestamped, independently sourced **point-in-time** evidence captured before the original prediction. The current Upstox index quote/candle feed does NOT verify index fundamentals; missing data must display **NOT_VERIFIED**, not fabricate news, earnings, FII/DII flow, inflation or reason for a move. Evidence entered afterward must not be backdated into prediction rationale.
5. Generate a structured review for both correct and wrong directions, note uncertain factors, and propose candidate improvements for separate backtesting and forward validation. Never rewrite the original prediction or automatically change model weights/rules.
6. This is a *30-minute directional review*, not a real or hypothetical proof that option target/SL was filled; execution, option P&L, fees, gaps and slippage are NOT VERIFIED. PAPER_ONLY and approved real orders zero. Journal still requires an armed, awake, authenticated browser session.
