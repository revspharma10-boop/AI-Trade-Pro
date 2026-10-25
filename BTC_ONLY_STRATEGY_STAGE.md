# Algo Trader — BTC-only strategy lab (candidate)

**Product direction:** Bitcoin spot BTC/USD, 24/7 market, research and paper-only. No brokerage or live execution.

## Included in this candidate ZIP
- New signed-in tab **BTC strategy lab** with strategy/timeframe selection and historical backtest results.
- Six long-only strategies: EMA(12/26), SMA(10/30), RSI(14) reversion, Bollinger(20,2), Donchian(20) breakout, 12-bar momentum.
- Kraken's public **BTC/USD** spot OHLC, timeframes 5m/15m/1h/4h/1d. Fetch is manual and rate-limited to at most once per 60 seconds.
- Up to 719 completed recent candles; last uncommitted bar is excluded. Signals use completed candle close; next candle's open is the hypothetical fill.
- Illustrative fees of 0.10% and slippage 0.05% each side, long-only, no leverage, 95% of cash allocated when entering. Displays historical return, buy-and-hold comparison, maximum drawdown, round trips and win rate. No orders or paper-ledger mutations.
- 51 local Python tests passed, including existing PIN login and cloud transfer tests. JavaScript syntax checked.

## Limitations — still pending
- This is BTC **research**, not a BTC-native trading ledger. The existing stock-style scenario ledger and its legacy data are left untouched to protect existing records until fractional BTC quantities, trading fees, risk controls, and cloud migration can be tested.
- Only up to 720 recent Kraken bars per request, and the data provider can rate-limit or be unavailable. Past backtest returns don't predict future profits. There is no real-time streaming, scheduling or background bot.
- Render Free **spins down after 15 minutes idle**: https://render.com/docs/free. Continuous 24/7 automated paper orders require a different reliable execution architecture.
- No real exchange orders, wallet/API keys or funds.

Source references: https://docs.kraken.com/api-reference/market-data/get-ohlc-data and https://render.com/docs/free

Next: verify on separate Neon preview, add BTC fractional paper-ledger migration, run walk-forward validation, then promote main website only when tested.
