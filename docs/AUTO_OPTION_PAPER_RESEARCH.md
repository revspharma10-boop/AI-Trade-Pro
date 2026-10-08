# Automatic CALL/PUT paper-only research

Default interface: choose NSE Index Options or NSE Stock Options, then type the underlying symbol, then press Analyze chart & find CE / PE.

Supported index lookup is exact Upstox-resolved NIFTY, BANKNIFTY, FINNIFTY; stocks require the exact NSE ticker. The previous manual futures/MCX/instrument tools remain available behind Show advanced research controls.

Read-only flow: authenticated Upstox index/equity lookup; current completed 5-minute candles; EMA9/21, RSI14 and MACD; index does not fabricate VWAP; stocks additionally require real VWAP and liquidity. Mixed signals or a closed session display WAIT.

Technical bullish bias maps to long CE paper candidate; bearish maps to long PE. Resolve exact NSE option contracts using GET /v2/option/contract, then choose closest-to-spot strike for nearest non-today expiry. Get live bid, ask, last trade, OI, volume and completed 5-minute option-premium candles. Stale/unavailable/illiquid data display WAIT.

Premium entry is current ask rounded up to tick. Stop loss is 1.5x option-premium ATR, minimum three ticks, rounded down; targets are 1.5R and 2R rounded down. Both entry and risk apply to the option PREMIUM, not underlying price.

Capital ₹50,000 and planned risk ₹500. Preliminary risk-based lot count uses option SL premium loss plus two-tick reserve. Premium cost affordability and broker required-margin quote cap hypothetical combined lots; actual account funds, fees and holiday/square-off policy not verified. Authorized live lots ALWAYS zero; no order endpoints are used.

Actual risk may exceed ₹500 due to gaps, slippage and fees. This is not a backtested or forward-validated strategy and never a live BUY instruction. MCX automatic option chain is not supported.

Backend server needs the two new GET routes /api/upstox/index-search and /api/upstox/option-contracts deployed and authenticated. If they are unavailable, the UI fails closed with WAIT.

Upstox official contracts: https://upstox.com/developer/api-documentation/get-option-contracts/

## MCX commodity auto CE/PE research

The two-input screen also offers **MCX Commodity Options — Auto CE/PE**; enter the exact commodity root such as `GOLD`, `GOLDM`, `SILVER`, `SILVERM`, `CRUDEOIL`, or `NATURALGAS` (only if listed for MCX options). Previous NSE research remains unchanged.

Because Upstox officially does not provide the MCX put/call option-chain API, the app instead fetches **actual MCX FUT, CE and PE instruments** using the exchange's search/BOD instrument master through existing read-only `/api/upstox/derivative-search`. An option must have an exact `underlying_key` equal to a matching MCX futures `instrument_key`; missing links must produce **WAIT** rather than guessing a futures price or strike.

For linked contracts, analyze fresh completed 5m *futures* candles, determine bullish (CE) or bearish (PE) provisional research, then select the nearest non-expiry-day option with closest strike to the matched futures last price. Analyze the option premium candles and fresh bid/ask/last-trade/OI/volume before calculating hypothetical option premium BUY entry, 1.5 ATR stop, 1.5R and 2R targets.

MCX premium exposure uses `lot_size × qty_multiplier` from Upstox BOD metadata with `tick_size ÷ 100` provisional tick normalization. Without either value, or if one lot exceeds ₹500 planned risk or ₹50,000 premium budget, output WAIT. Broker margin is fetched as a calculator quote only and never verifies available funds. This cannot certify multiplier units or contract liquidity; full MCX session holiday/tender and broker square-off checks remain outstanding. Slippage, gaps and fees can cause losses beyond ₹500.

**PAPER_ONLY=true. REAL_ORDER_PLACED=false. PRODUCTION_REAL_TRADING_ENABLED=false. Approved real lots always 0.**

Upstox MCX chain limitation: https://upstox.com/developer/api-documentation/get-pc-option-chain/
