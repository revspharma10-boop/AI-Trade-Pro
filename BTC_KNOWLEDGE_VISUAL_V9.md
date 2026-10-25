# BTC-only Knowledge & Live Visual v9

The Bitcoin AI Brain now has a curated education catalog and a real market-data visualization page.

**What is implemented**
- Bitcoin-only learning: 16 original, source-linked lessons explaining proof-of-work mining, newly minted coinbase subsidy, 210,000-block halving, nearly 21-million BTC supply, how spot orders trade, why BTC prices rise/fall, miner economics, liquidity, volatility, ETF/macro data gaps, risk and honest backtesting.
- 44 categorized trading-strategy concepts; 6 implemented and backtestable, 38 explicitly knowledge-only. No claim to ingest or run every strategy on the web.
- Existing BTC AI Brain explanation endpoint now includes 26 knowledge rules, without changing the 6-strategy BUY / WAIT / EXIT decision algorithm. Not a trained LLM.
- BTC Live Visual (top navigation): latest public Kraken BTC/USD ticker trade, SVG chart of up to 100 **completed** BTC candles, a chart of BTC traded volume, and a ring showing BTC volume share of aggressive taker buys vs sells from Kraken's **recent-trades sample**. The chart shows timestamp, sample count, duration and feed health.
- Public Kraken REST feed from fixed HTTPS host only; authenticated API, 60-second shared durable throttling, optional browser-on 65-second refresh. Supports independent partial feed failure. No fake prices or manufactured sentiment when data unavailable.
- Visual sampled taker volume does not describe all BTC buyers/sellers, global holder sentiment or future BTC direction. Every executed trade includes both a buyer and seller.
- Entire platform stays paper-only. No trading API credentials, autonomous execution, or broker orders.

**Verification**: 110/110 Python regressions passed, Node JavaScript syntax passed; desktop/tablet/mobile Playwright layout checked at 1440/768/390px. Screenshot data for UI QA was mock test input, not real prices. Live market-data availability on Render requires observing a successful authenticated pull.

**Primary references**
- Bitcoin issuance and halving: https://bitcoin.org/en/halving
- Bitcoin supply: https://help.blockstream.com/education/economics/bitcoin-economics/why-is-the-bitcoin-supply-limited
- Kraken trade types: https://blog.kraken.com/crypto-education/the-markets-series-part-2-explaining-crypto-trading
- Kraken public REST market endpoints: https://support.kraken.com/in/articles/360000919986-public-endpoint-examples-you-can-try-them-directly-in-a-web-browser-
- Kraken aggressor ratio: https://support.kraken.com/au/articles/analytics-widgets-on-kraken-pro
- Technical indicator catalog: https://www.fidelity.com/learning-center/trading-investing/technical-analysis

**Pending**: live Kraken pull acceptance check; macro/ETF/funding/news data integrations; calibrated BTC prediction accuracy; reliable 24/7 scheduling; separately configured cloud backups. Render Free can sleep.
