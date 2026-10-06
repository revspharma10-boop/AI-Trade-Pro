import './style.css';

import {
  getQuote,
  isMarketDataConfigured
} from './services/marketData.js';

import {
  buildRecommendation
} from './services/recommendationEngine.js';


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


      <!-- =========================
           RECOMMENDATIONS PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="recommendations"
      >

        <section class="welcome"><div><h2>Recommendations & Paper Ticket</h2><p>Review qualified opportunities and simulate execution.</p></div><div class="engine-badge">Broker Execution <strong>BLOCKED</strong></div></section>
        <section class="dashboard-grid">
          <div class="panel"><div class="panel-header"><div><h3>🎯 Qualified Setup</h3><span>Paper-only demonstration candidate</span></div><span class="panel-status">PAPER</span></div>
            <div class="market-list"><div class="market-row"><span>Symbol</span><strong id="paper-symbol">INFY:NSE</strong></div><div class="market-row"><span>Side</span><strong>BUY</strong></div><div class="market-row"><span>Opportunity Score</span><strong>78</strong></div><div class="market-row"><span>Risk / Reward</span><strong>2.10</strong></div></div>
          </div>
          <div class="panel"><div class="panel-header"><div><h3>📝 Paper Order Ticket</h3><span>Simulation only</span></div><span class="panel-status">NO BROKER ROUTE</span></div>
            <div class="api-test-content"><label>Entry Price</label><input id="paper-entry" type="number" value="1500" min="0" step="0.05"><label>Quantity</label><input id="paper-qty" type="number" value="1" min="1" step="1"><button class="primary-btn" id="paper-stage">Stage Paper BUY</button><button class="primary-btn" id="paper-fill" disabled>Simulate Fill</button><div id="paper-ticket-status" class="market-list"><div class="market-row"><span>Status</span><strong>READY</strong></div></div></div>
          </div>
          <div class="panel"><div class="panel-header"><div><h3>💼 Paper Position</h3><span>Mark, P&amp;L and simulated close</span></div><span class="panel-status">SIMULATION</span></div>
            <div class="api-test-content"><label>Market / Exit Price</label><input id="paper-mark" type="number" value="1510" min="0" step="0.05"><button class="primary-btn" id="paper-mark-btn">Update Mark</button><button class="primary-btn" id="paper-close">Close Paper Position</button><div id="paper-position-state" class="market-list"></div></div>
          </div>
        </section>

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