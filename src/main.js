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
            Multi-Market Algo & Recommendation Platform
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
              Trading Intelligence Dashboard
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
                  Algo execution layer
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

        <div class="page-placeholder">

          <div class="placeholder-icon">
            📊
          </div>

          <h2>
            Market
          </h2>

          <p>
            Market Data & Analysis
          </p>

          <span>
            Market data integration will be developed
            in a later step.
          </span>

        </div>

      </section>


      <!-- =========================
           RECOMMENDATIONS PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="recommendations"
      >

        <div class="page-placeholder">

          <div class="placeholder-icon">
            🎯
          </div>

          <h2>
            Recommendations
          </h2>

          <p>
            Top Market Opportunities
          </p>

          <span>
            Recommendation engine will be developed
            in a later step.
          </span>

        </div>

      </section>


      <!-- =========================
           SCANNER PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="scanner"
      >

        <div class="page-placeholder">

          <div class="placeholder-icon">
            🔎
          </div>

          <h2>
            Scanner
          </h2>

          <p>
            Market Opportunity Scanner
          </p>

          <span>
            Scanner rules will be developed
            in a later step.
          </span>

        </div>

      </section>


      <!-- =========================
           WATCHLIST PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="watchlist"
      >

        <div class="page-placeholder">

          <div class="placeholder-icon">
            ⭐
          </div>

          <h2>
            Watchlist
          </h2>

          <p>
            Your Selected Opportunities
          </p>

          <span>
            Watchlist functionality will be developed
            in a later step.
          </span>

        </div>

      </section>


      <!-- =========================
           JOURNAL PAGE
      ========================== -->

      <section
        class="page-section"
        data-page="journal"
      >

        <div class="page-placeholder">

          <div class="placeholder-icon">
            📓
          </div>

          <h2>
            Journal
          </h2>

          <p>
            Trading Journal
          </p>

          <span>
            Journal functionality will be developed
            in a later step.
          </span>

        </div>

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