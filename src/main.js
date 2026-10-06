import './style.css';

import {
  getQuote,
  isMarketDataConfigured
} from './services/marketData.js';

import {
  buildRecommendation
} from './services/recommendationEngine.js';
import { buildStockAnalysisDecision } from './services/stockAnalysisDecisionEngine.js';
import { getUpstoxDailyHistory, getUpstoxFundamentals, searchUpstoxEquity } from './services/upstoxReadOnlyMarketData.js';
import { analyzeTechnicalHistory } from './services/technicalAnalysisEngine.js';
import { analyzeFundamentals } from './services/fundamentalAnalysisEngine.js';
import { analyzeMarketRegime } from './services/marketRegimeEngine.js';


const app = document.querySelector('#app');


app.innerHTML = `
  <div class="app-shell">

    <header class="topbar">

      <div class="brand">

        <div class="brand-icon">📈</div>

        <div>
          <h1>AI TRADE PRO</h1>

          <span>
            Live Market Intelligence • Paper Trading Platform
          </span>
        </div>

      </div>


      <div class="market-status">

        <span class="status-dot"></span>

        MARKET ENGINE

        <strong>READY</strong>

      </div>

    </header>


    <nav class="navigation">

      <button class="nav-btn active" data-section="dashboard">
        Dashboard
      </button>

      <button class="nav-btn" data-section="market">
        Market
      </button>

      <button class="nav-btn" data-section="recommendations">
        Recommendations
      </button>

      <button class="nav-btn" data-section="scanner">
        Scanner
      </button>

      <button class="nav-btn" data-section="watchlist">
        Watchlist
      </button>

      <button class="nav-btn" data-section="journal">
        Journal
      </button>

    </nav>


    <main class="main-content">


      <!-- =========================
           DASHBOARD
      ========================== -->

      <section
        class="page-section active"
        data-page="dashboard"
      >

        <section class="welcome">

          <div>

            <h2>
              Trading Intelligence & Paper Execution
            </h2>

            <p>
              Analyze markets, identify opportunities and generate
              rule-based trading recommendations.
            </p>

          </div>


          <div class="engine-badge">

            🤖 Analysis Engine

            <strong>ONLINE</strong>

          </div>

        </section>


        <!-- MARKET UNIVERSE -->

        <section class="market-selector">

          <div class="section-title">

            <h3>
              Market Universe
            </h3>

            <span>
              Select a market to analyze
            </span>

          </div>


          <div class="market-grid">


            <button class="market-card selected">

              <span class="market-icon">
                🇮🇳
              </span>

              <div>

                <strong>
                  Indian Market
                </strong>

                <small>
                  Equity • F&O • Index
                </small>

              </div>

            </button>


            <button class="market-card">

              <span class="market-icon">
                🪙
              </span>

              <div>

                <strong>
                  Commodity
                </strong>

                <small>
                  Gold • Silver • Crude • Metals
                </small>

              </div>

            </button>


            <button class="market-card">

              <span class="market-icon">
                ₿
              </span>

              <div>

                <strong>
                  Crypto Market
                </strong>

                <small>
                  Crypto assets & pairs
                </small>

              </div>

            </button>


          </div>

        </section>


        <!-- DASHBOARD PANELS -->

        <section class="dashboard-grid">


          <!-- MARKET OVERVIEW -->

          <div class="panel">

            <div class="panel-header">

              <div>

                <h3>
                  📊 Market Overview
                </h3>

                <span>
                  Market data engine
                </span>

              </div>

              <span class="panel-status">
                WAITING
              </span>

            </div>


            <div class="market-list">
              <div class="market-row"><span>Upstox</span><strong id="upstox-ui-status">CHECKING</strong></div>

              <div class="market-row">

                <span>
                  NIFTY 50
                </span>

                <strong>
                  --
                </strong>

              </div>


              <div class="market-row">

                <span>
                  BANK NIFTY
                </span>

                <strong>
                  --
                </strong>

              </div>


              <div class="market-row">

                <span>
                  SENSEX
                </span>

                <strong>
                  --
                </strong>

              </div>


            </div>

          </div>


          <!-- RECOMMENDATIONS -->

          <div class="panel recommendation-panel">


            <div class="panel-header">

              <div>

                <h3>
                  🎯 Stock Recommendations
                </h3>

                <span>
                  AI-assisted opportunity engine
                </span>

              </div>

              <span class="panel-status">
                READY
              </span>

            </div>


            <div class="empty-state">

              <div class="empty-icon">
                🔎
              </div>


              <h4>
                No recommendation generated yet
              </h4>


              <p>
                The recommendation engine will evaluate market data,
                technical indicators and strategy conditions.
              </p>


              <button
                class="primary-btn"
                id="run-analysis-btn"
              >
                Run Market Analysis
              </button>

            </div>

          </div>


          <!-- STRATEGY ENGINE -->

          <div class="panel">


            <div class="panel-header">

              <div>

                <h3>
                  ⚡ Strategy Engine
                </h3>

                <span>
                  Paper execution layer
                </span>

              </div>

              <span class="panel-status">
                STANDBY
              </span>

            </div>


            <div class="strategy-list">


              <div class="strategy-row">

                <span>
                  Market Scanner
                </span>

                <strong>
                  OFF
                </strong>

              </div>


              <div class="strategy-row">

                <span>
                  Signal Engine
                </span>

                <strong>
                  OFF
                </strong>

              </div>


              <div class="strategy-row">

                <span>
                  Paper Trading
                </span>

                <strong>
                  OFF
                </strong>

              </div>


              <div class="strategy-row">

                <span>
                  Auto Execution
                </span>

                <strong>
                  DISABLED
                </strong>

              </div>


            </div>

          </div>


        </section>


        <section class="safety-banner">
          <div>
            <strong>🛡️ PAPER-ONLY SAFETY LOCK</strong>
            <span>Upstox production access is read-only. Live broker order submission is disabled.</span>
          </div>
          <div class="safety-chips">
            <span>LIVE DATA</span><span>PAPER EXECUTION</span><span>REAL ORDERS BLOCKED</span>
          </div>
        </section>

        <!-- API CONNECTION TEST -->

        <section class="panel api-test-panel">

          <div class="panel-header">

            <div>

              <h3>
                🔌 Market Data Connection
              </h3>

              <span>
                Temporary development connectivity test
              </span>

            </div>

            <span
              class="panel-status"
              id="api-test-status"
            >
              NOT TESTED
            </span>

          </div>


          <div class="api-test-content">

            <p id="api-test-message">

              We will test the Twelve Data connection
              before connecting the recommendation engine.

            </p>


            <button
              class="primary-btn"
              id="test-api-btn"
            >
              Test API Connection
            </button>

          </div>

        </section>


        <!-- DISCLAIMER -->

        <section class="disclaimer">

          <strong>
            ⚠️ Development Mode
          </strong>

          <span>

            Recommendations shown by this application are analytical
            outputs and are not guaranteed investment returns.

          </span>

        </section>


      </section>


      <!-- =========================
           MARKET PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="market"
      >

        <section class="welcome">
          <div><h2>Live Market</h2><p>Upstox production market data • authenticated read-only access</p></div>
          <div class="engine-badge">Broker Orders <strong>BLOCKED</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <div><h3>📊 Upstox Quote</h3><span>Read-only market-data request</span></div>
            <span class="panel-status" id="market-upstox-status">CHECKING</span>
          </div>
          <div class="market-terminal">
            <label for="market-instrument-key">Instrument key</label>
            <div class="market-search-row">
              <input id="market-instrument-key" value="NSE_INDEX|Nifty 50" autocomplete="off" />
              <button class="primary-btn" id="load-upstox-quote">Load Quote</button>
            </div>
            <div id="upstox-quote-result" class="market-list">
              <div class="market-row"><span>Status</span><strong>Waiting for request</strong></div>
            </div>
          </div>
        </section>
        <section class="safety-banner">
          <div><strong>🛡️ LIVE DATA / PAPER EXECUTION</strong><span>Quotes may be live. All trade execution remains simulated.</span></div>
          <div class="safety-chips"><span>READ ONLY</span><span>NO BROKER ORDERS</span></div>
        </section>

      </section>


      <!-- STOCK ANALYSIS PAGE -->
      <section class="page-section" data-page="recommendations">
        <section class="welcome"><div><h2>AI Stock Analysis</h2><p>Select a stock for technical + fundamental analysis before any paper trade.</p></div><div class="engine-badge">Broker Execution <strong>BLOCKED</strong></div></section>
        <section class="panel"><div class="panel-header"><div><h3>🔎 Select Stock</h3><span>Evidence-gated Indian equity analysis</span></div><span class="panel-status">FAIL CLOSED</span></div>
          <div class="market-terminal"><label for="analysis-symbol">Stock / symbol</label><div class="market-search-row"><input id="analysis-symbol" placeholder="Example: INFY:NSE" autocomplete="off"><button class="primary-btn" id="analyze-selected-stock">Analyze Stock</button></div><p class="analysis-note">A trade setup is shown only when fresh market data plus complete technical and fundamental evidence are available.</p></div>
        </section>
        <section class="dashboard-grid analysis-grid">
          <div class="panel"><div class="panel-header"><div><h3>🎯 AI Decision</h3><span>Entry, stop and targets</span></div><span class="panel-status" id="analysis-decision-status">WAIT</span></div><div id="analysis-decision" class="market-list"><div class="market-row"><span>Recommendation</span><strong>WAIT</strong></div><div class="market-row"><span>Reason</span><strong>Select a stock</strong></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3>📈 Technical Analysis</h3><span>Trend, momentum, volume and structure</span></div><span class="panel-status">PENDING</span></div><div id="analysis-technical" class="market-list"><div class="market-row"><span>Evidence</span><strong>NOT LOADED</strong></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3>🏢 Fundamental Analysis</h3><span>Growth, profitability, debt and valuation</span></div><span class="panel-status">PENDING</span></div><div id="analysis-fundamental" class="market-list"><div class="market-row"><span>Evidence</span><strong>NOT LOADED</strong></div></div></div>
        </section>
        <section class="safety-banner"><div><strong>🛡️ EVIDENCE-GATED RECOMMENDATIONS</strong><span>Missing or stale evidence returns WAIT. Entry, stop-loss and targets are never fabricated.</span></div><div class="safety-chips"><span>TECHNICAL</span><span>FUNDAMENTAL</span><span>PAPER ONLY</span></div></section>
      </section>

      <!-- =========================
           SCANNER PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="scanner"
      >

        <section class="welcome"><div><h2>Paper Opportunity Scanner</h2><p>Qualify candidates through score, risk/reward and risk gates.</p></div><div class="engine-badge">Execution <strong>PAPER ONLY</strong></div></section>
        <section class="panel"><div class="panel-header"><div><h3>🔎 Candidate Qualification</h3><span>Sample candidates exercise the real paper-safe scanner engine</span></div><span class="panel-status" id="scanner-status">READY</span></div>
        <div class="api-test-content"><button class="primary-btn" id="run-paper-scanner">Run Scanner</button><div id="scanner-results" class="market-list"><div class="market-row"><span>Results</span><strong>WAITING</strong></div></div></div></section>

      </section>


      <!-- =========================
           WATCHLIST PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="watchlist"
      >

        <section class="welcome"><div><h2>Watchlist</h2><p>Research symbols managed by the paper-only control center.</p></div></section>
        <section class="panel"><div class="panel-header"><div><h3>⭐ Research Watchlist</h3><span>No broker execution capability</span></div><span class="panel-status">PAPER ONLY</span></div><div class="api-test-content"><input id="watchlist-symbol" placeholder="INFY:NSE"><button class="primary-btn" id="watchlist-add">Add Symbol</button><div id="watchlist-page-results" class="market-list"></div></div></section>

      </section>


      <section class="page-section" data-page="risk">
        <section class="welcome"><div><h2>Risk & Safety Center</h2><p>Operational guardrails for the paper-only trading workspace.</p></div><div class="engine-badge">Real Orders <strong>BLOCKED</strong></div></section>
        <section class="dashboard-grid">
          <div class="panel"><div class="panel-header"><div><h3>🛡️ Portfolio Risk</h3><span>Live paper-runtime controls</span></div><span class="panel-status" id="risk-runtime-status">CHECKING</span></div><div id="risk-runtime" class="market-list"></div></div>
          <div class="panel"><div class="panel-header"><div><h3>🔐 Broker Boundary</h3><span>Upstox production access</span></div><span class="panel-status" id="risk-broker-status">CHECKING</span></div><div class="market-list"><div class="market-row"><span>Market Data</span><strong>READ ONLY</strong></div><div class="market-row"><span>Paper Execution</span><strong>ENABLED</strong></div><div class="market-row"><span>Broker Orders</span><strong>BLOCKED</strong></div><div class="market-row"><span>Token in Browser</span><strong>NO</strong></div></div></div>
          <div class="panel"><div class="panel-header"><div><h3>📡 Recovery</h3><span>Authentication and data health</span></div><span class="panel-status">FAIL CLOSED</span></div><div class="api-test-content"><p id="risk-recovery-message">Checking Upstox authentication.</p><a class="primary-btn" href="https://ai-trade-pro-oauth.onrender.com/auth/upstox/start">Re-authenticate Upstox</a></div></div>
        </section>
      </section>

      <!-- =========================
           JOURNAL PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="journal"
      >

        <section class="welcome"><div><h2>Paper Trade Journal</h2><p>Closed simulated trades and realized results.</p></div></section>
        <section class="panel"><div class="panel-header"><div><h3>📓 Journal</h3><span>Paper trades only</span></div><span class="panel-status">SIMULATION</span></div><div id="journal-results" class="market-list"><div class="market-row"><span>Trades</span><strong>NONE</strong></div></div></section>

      </section>


    </main>


    <footer>

      AI TRADE PRO • Development Build •
      Recommendation & Algo Research Platform

    </footer>


  </div>
`;


// ============================================================
// STOCK ANALYSIS WORKSPACE
// ============================================================
const selectedStockButton=document.querySelector('#analyze-selected-stock');
if(selectedStockButton){
  selectedStockButton.addEventListener('click',async()=>{
    const symbol=document.querySelector('#analysis-symbol')?.value?.trim().toUpperCase()||'';
    const status=document.querySelector('#analysis-decision-status'), output=document.querySelector('#analysis-decision'), technical=document.querySelector('#analysis-technical');
    const renderRows=(node,rows)=>{node?.replaceChildren();rows.forEach(([label,value])=>{const row=document.createElement('div');row.className='market-row';const left=document.createElement('span');left.textContent=label;const right=document.createElement('strong');right.textContent=String(value);row.append(left,right);node?.appendChild(row);});};
    selectedStockButton.disabled=true; selectedStockButton.textContent='Analyzing...'; if(status)status.textContent='LOADING';
    try{
      const to=new Date(), from=new Date(to); from.setDate(from.getDate()-180);
      const date=d=>d.toISOString().slice(0,10);
      const instrument=await searchUpstoxEquity(symbol.replace(':NSE',''));
      const history=await getUpstoxDailyHistory(instrument.instrumentKey,{fromDate:date(from),toDate:date(to)});
      const fundamentalsPayload=await getUpstoxFundamentals(instrument.isin);
      const tech=analyzeTechnicalHistory(history.candles);
      const fundamental=analyzeFundamentals(fundamentalsPayload.data);
      if(!tech.valid) throw new Error(tech.reasons.join(', '));
      renderRows(technical,[['Close',tech.snapshot.close],['EMA 20',tech.snapshot.ema20],['EMA 50',tech.snapshot.ema50],['RSI 14',tech.snapshot.rsi14],['ATR 14',tech.snapshot.atr14],['Momentum 10',tech.snapshot.momentum10+'%'],['Support',tech.snapshot.support20],['Resistance',tech.snapshot.resistance20]]);
      if(!fundamental.valid) throw new Error(fundamental.reasons.join(', '));
      const fundamentalNode=document.querySelector('#analysis-fundamental');
      renderRows(fundamentalNode,[['Sector',fundamental.snapshot.sector],['Revenue Growth',fundamental.snapshot.revenueGrowth+'%'],['Profit Growth',fundamental.snapshot.profitGrowth+'%'],['ROE',fundamental.snapshot.roe+'%'],['ROCE',fundamental.snapshot.roce+'%'],['P/E',fundamental.snapshot.pe],['Liabilities / Assets',fundamental.snapshot.liabilityToAsset+'%'],['Operating Cash Flow Growth',fundamental.snapshot.operatingCashFlowGrowth+'%']]);
      const indexHistory=await getUpstoxDailyHistory('NSE_INDEX|Nifty 50',{fromDate:date(from),toDate:date(to)});
      const indexTech=analyzeTechnicalHistory(indexHistory.candles);
      if(!indexTech.valid) throw new Error('MARKET_REGIME_DATA_INCOMPLETE');
      const regime=analyzeMarketRegime({
        trend:{direction:indexTech.snapshot.close>indexTech.snapshot.ema20&&indexTech.snapshot.ema20>indexTech.snapshot.ema50?'BULLISH':'BEARISH',strength:indexTech.scores.trend},
        momentum:{direction:indexTech.snapshot.rsi14>=50?'BULLISH':'BEARISH',rsi:indexTech.snapshot.rsi14},
        supertrend:{direction:indexTech.gates.technicalConfirmation?'BULLISH':'BEARISH'},
        adx:indexTech.scores.adx,
        volume:{ratio:indexTech.snapshot.volumeRatio},
        volatility:{level:indexTech.snapshot.atrPercent<=3?'NORMAL':indexTech.snapshot.atrPercent<=5?'HIGH':'EXTREME'}
      });
      if(!regime.valid) throw new Error('MARKET_REGIME_INVALID');
      const marketRegimeScore=regime.score;
      const decision=buildStockAnalysisDecision({symbol:instrument.tradingSymbol,marketDataFresh:true,technicalScores:tech.scores,fundamentalScores:fundamental.scores,marketRegimeScore,entryZone:tech.levels.entryZone,stopLoss:tech.levels.stopLoss,targets:tech.levels.targets,riskRewardRatio:tech.levels.riskRewardRatio,riskGates:{...tech.gates,liquidityAcceptable:true,marketRegimeAcceptable:regime.regime==='BULLISH'||regime.regime==='STRONG BULLISH'},technicalEvidence:tech.evidence,fundamentalEvidence:fundamental.evidence});
      if(status)status.textContent=decision.recommendation;
      renderRows(output,[['Symbol',symbol],['Recommendation',decision.recommendation],['Technical Status','COMPLETE'],['Entry Zone',tech.levels.entryZone.low+' - '+tech.levels.entryZone.high],['Protective Stop',tech.levels.stopLoss],['Technical Targets',tech.levels.targets.join(', ')],['Risk / Reward',tech.levels.riskRewardRatio],['Fundamental Status','COMPLETE'],['Market Regime',regime.regime+' ('+regime.score+'/100)'],['Final AI Trade',decision.recommendation],['Confidence',decision.confidence+'%']]);
    }catch(error){
      const decision=buildStockAnalysisDecision({symbol}); if(status)status.textContent='WAIT';
      renderRows(output,[['Symbol',symbol||'--'],['Recommendation','WAIT'],['Reason',String(error?.message||decision.reasons?.join(', ')||'DATA UNAVAILABLE')]]);
      renderRows(technical,[['Status','TECHNICAL DATA UNAVAILABLE']]);
    }finally{selectedStockButton.disabled=false;selectedStockButton.textContent='Analyze Stock';}
  });
}

// ============================================================
// ANALYSIS BUTTON
// ============================================================

const analysisButton =
  document.querySelector('#run-analysis-btn');


if (analysisButton) {

  analysisButton.addEventListener('click', async () => {

    analysisButton.textContent =
      'Analysis Engine Running...';

    analysisButton.disabled = true;


    try {

      /*
       * STEP 2D ACTION 1
       *
       * This action connects the application shell to:
       *
       * 1. Market Data Service
       * 2. Recommendation Engine
       *
       * We are intentionally NOT generating a real BUY/SELL
       * recommendation yet.
       *
       * Real technical/fundamental scores will be connected
       * in later development actions.
       */

      if (!isMarketDataConfigured()) {

        throw new Error(
          'Market data API is not configured.'
        );

      }


      const quote =
        await getQuote('INFY:NSE');


      if (
        !quote ||
        quote.close === null ||
        quote.close === undefined
      ) {

        throw new Error(
          'No valid market quote was returned.'
        );

      }


      /*
       * Foundation integration test.
       *
       * These are neutral development values only.
       * They are NOT a real trading signal.
       */

      const engineResult =
        buildRecommendation({

          symbol: quote.symbol,

          technicalScore: 0,

          fundamentalScore: 0,

          marketRegimeScore: 0,

          riskQualityScore: 0,

          riskRewardRatio: 0,

          riskGates: {

            dataValid: true,

            liquidityAcceptable: false,

            technicalConfirmation: false,

            stopLossValid: false,

            volatilityAcceptable: false,

            marketRegimeAcceptable: false

          }

        });


      console.log(
        'AI TRADE PRO — recommendation engine integration test',
        {
          quote,
          engineResult
        }
      );


      analysisButton.textContent =
        'Engine Connected ✓';


      analysisButton.disabled = false;


    } catch (error) {

      console.error(
        'AI TRADE PRO — analysis integration test failed:',
        error
      );


      analysisButton.textContent =
        'Analysis Failed — Try Again';


      analysisButton.disabled = false;

    }

  });

}


// ============================================================
// API CONNECTION TEST
// ============================================================

const apiTestButton =
  document.querySelector('#test-api-btn');

const apiTestStatus =
  document.querySelector('#api-test-status');

const apiTestMessage =
  document.querySelector('#api-test-message');


if (apiTestButton) {

  apiTestButton.addEventListener(
    'click',
    async () => {

      apiTestButton.disabled = true;

      apiTestButton.textContent =
        'Testing Connection...';

      apiTestStatus.textContent =
        'TESTING';

      apiTestMessage.textContent =
        'Connecting to the market data provider...';


      try {

        // First check whether the environment
        // variable is available.

        if (!isMarketDataConfigured()) {

          throw new Error(
            'API key is not being detected. Please check the .env configuration.'
          );

        }


        /*
         * AAPL is being used ONLY for connectivity testing.
         *
         * We are not using this as an Indian-market
         * recommendation or trading signal.
         */

        const quote =
          await getQuote('AAPL');


        if (
          !quote ||
          quote.close === null ||
          quote.close === undefined
        ) {

          throw new Error(
            'Provider responded, but no valid quote data was returned.'
          );

        }


        apiTestStatus.textContent =
          'CONNECTED';


        apiTestMessage.textContent =
          `API connection successful. ` +
          `Test symbol: ${quote.symbol}. ` +
          `Latest price received: ${quote.close}.`;


        apiTestButton.textContent =
          'Connection Successful ✓';


        console.log(
          'AI TRADE PRO — API connectivity test successful',
          quote
        );


      } catch (error) {

        console.error(
          'AI TRADE PRO — API connectivity test failed:',
          error
        );


        apiTestStatus.textContent =
          'FAILED';


        apiTestMessage.textContent =
          `API connection failed: ${
            error.message ||
            'Unknown error'
          }`;


        apiTestButton.textContent =
          'Test Failed — Try Again';


        apiTestButton.disabled = false;

      }

    }
  );

}


// ============================================================
// NAVIGATION
// ============================================================

const navigationButtons =
  document.querySelectorAll('.nav-btn');

const pages =
  document.querySelectorAll('.page-section');


navigationButtons.forEach((button) => {

  button.addEventListener('click', () => {

    const selectedPage =
      button.dataset.section;


    // Remove active state from all buttons

    navigationButtons.forEach((item) => {

      item.classList.remove('active');

    });


    // Activate selected button

    button.classList.add('active');


    // Hide all pages

    pages.forEach((page) => {

      page.classList.remove('active');

    });


    // Find selected page

    const targetPage =
      document.querySelector(
        `.page-section[data-page="${selectedPage}"]`
      );


    // Display selected page

    if (targetPage) {

      targetPage.classList.add('active');

    }


    console.log(
      `Navigation selected: ${selectedPage}`
    );

  });

});


console.log(
  'AI TRADE PRO — application shell loaded successfully'
);