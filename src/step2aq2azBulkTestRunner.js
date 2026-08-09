// ============================================================
// AI TRADE PRO — STEP 2AQ–2AZ BULK TEST RUNNER
// PORTFOLIO RISK + PAPER DASHBOARD CONTRACT
// ============================================================
// Purpose:
// - Validate portfolio-level risk calculations.
// - Validate paper trade authorization gates.
// - Validate paper dashboard aggregation.
// - Keep every scenario explicitly paper-only.
// - No broker API. No real order path.
// ============================================================

import {
  calculatePortfolioRisk,
  authorizePaperTrade
} from './services/portfolioRiskEngine.js';

import {
  buildPaperTradingDashboard,
  buildPaperTradingDashboardSummary,
  getPaperTradingDashboardPosition
} from './services/paperTradingDashboardEngine.js';

const results = [];

function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

function makePortfolio(overrides = {}) {
  return {
    paperOnly: true,
    realOrderPlaced: false,
    initialCapital: 100000,
    cash: 75000,
    reservedCapital: 25000,
    equity: 100000,
    realizedPnL: 500,
    unrealizedPnL: 250,
    positions: [
      {
        symbol: 'INFY:NSE',
        action: 'LONG',
        side: 'BUY',
        quantity: 100,
        entryPrice: 1000,
        currentPrice: 1005,
        stopLoss: 990,
        targetPrice: 1020,
        positionValue: 100000,
        unrealizedPnL: 500,
        status: 'OPEN'
      },
      {
        symbol: 'TCS:NSE',
        action: 'SHORT',
        side: 'SELL',
        quantity: 20,
        entryPrice: 2000,
        currentPrice: 1987.5,
        stopLoss: 2020,
        targetPrice: 1960,
        positionValue: 40000,
        unrealizedPnL: 250,
        status: 'OPEN'
      }
    ],
    closedPositions: [
      { symbol: 'RELIANCE:NSE', pnl: 500, status: 'CLOSED', paperOnly: true }
    ],
    orders: [
      { symbol: 'RELIANCE:NSE', status: 'PAPER_ORDER_CREATED', paperOnly: true }
    ],
    ...overrides
  };
}

console.log('='.repeat(60));
console.log('AI TRADE PRO — STEP 2AQ–2AZ BULK TEST RUNNER');
console.log('PORTFOLIO RISK + PAPER DASHBOARD CONTRACT');
console.log('='.repeat(60));

// ------------------------------------------------------------
// 2AQ–2AT — PORTFOLIO RISK CALCULATION
// ------------------------------------------------------------

const portfolio = makePortfolio();
const risk = calculatePortfolioRisk(portfolio, {
  maxDrawdownPercent: 10,
  maxOpenPositions: 5,
  maxCapitalPerTradePercent: 20
});

assert('Portfolio risk result is valid', risk.valid === true);
assert('Portfolio risk remains paper-only', risk.paperOnly === true);
assert('Portfolio risk reports no real order', risk.realOrderPlaced === false);
assert('Risk equity is 100000', risk.equity === 100000);
assert('Risk initial capital is 100000', risk.initialCapital === 100000);
assert('Risk sees two open positions', risk.openPositions === 2);
assert('Risk exposure is 140000', risk.exposure === 140000);
assert('Risk exposure percent is 140%', risk.exposurePercent === 140);
assert('Drawdown is zero', risk.drawdownPercent === 0);
assert('Capital validity gate passes', risk.gates.capitalValid === true);
assert('Drawdown gate passes', risk.gates.drawdownAcceptable === true);
assert('Position count gate passes', risk.gates.positionCountAcceptable === true);
assert('Exposure gate is evaluated independently', risk.gates.exposureAcceptable === false);

// Invalid / boundary portfolio scenarios.
const invalidCapital = calculatePortfolioRisk(
  makePortfolio({ initialCapital: 0, equity: 0, cash: 0 }),
  {}
);
assert('Zero-capital portfolio is rejected as invalid', invalidCapital.valid === false);
assert('Zero-capital portfolio remains paper-only', invalidCapital.paperOnly === true);
assert('Zero-capital portfolio places no real order', invalidCapital.realOrderPlaced === false);

const drawdownPortfolio = makePortfolio({ equity: 89000 });
const drawdownRisk = calculatePortfolioRisk(drawdownPortfolio, {
  maxDrawdownPercent: 10
});
assert('Drawdown is calculated at 11%', drawdownRisk.drawdownPercent === 11);
assert('Drawdown gate blocks beyond configured limit', drawdownRisk.gates.drawdownAcceptable === false);

const maxPositionsPortfolio = makePortfolio({ positions: [
  { symbol: 'A:NSE', positionValue: 1000 },
  { symbol: 'B:NSE', positionValue: 1000 },
  { symbol: 'C:NSE', positionValue: 1000 }
] });
const maxPositionsRisk = calculatePortfolioRisk(maxPositionsPortfolio, {
  maxOpenPositions: 3
});
assert('Maximum position count is detected', maxPositionsRisk.gates.positionCountAcceptable === false);

// ------------------------------------------------------------
// 2AU–2AW — PAPER TRADE AUTHORIZATION
// ------------------------------------------------------------

const safeOrder = authorizePaperTrade({
  portfolio: makePortfolio({
    positions: [],
    equity: 100000
  }),
  order: {
    symbol: 'INFY:NSE',
    quantity: 100,
    entryPrice: 1000,
    paperOnly: true
  },
  config: {
    maxCapitalPerTradePercent: 20,
    maxOpenPositions: 5
  }
});

assert('Safe paper order is authorized', safeOrder.authorized === true);
assert('Safe order position value is 100000', safeOrder.positionValue === 100000);
assert('Safe order max trade value is 20000', safeOrder.maxTradeValue === 20000);
assert('Safe order remains paper-only', safeOrder.paperOnly === true);
assert('Safe order places no real order', safeOrder.realOrderPlaced === false);
assert('Safe order records no rejection reasons', safeOrder.rejectionReasons.length === 0);

const oversizedOrder = authorizePaperTrade({
  portfolio: makePortfolio({ positions: [] }),
  order: {
    symbol: 'INFY:NSE',
    quantity: 25,
    entryPrice: 1000,
    paperOnly: true
  },
  config: {
    maxCapitalPerTradePercent: 20
  }
});

assert('Oversized paper order is blocked', oversizedOrder.authorized === false);
assert('Oversized order fails trade-size gate', oversizedOrder.gates.tradeSizeAcceptable === false);
assert('Oversized order remains paper-only', oversizedOrder.paperOnly === true);
assert('Oversized order places no real order', oversizedOrder.realOrderPlaced === false);
assert('Oversized rejection reason is recorded', oversizedOrder.rejectionReasons.includes('TRADESIZEACCEPTABLE'));

const invalidOrder = authorizePaperTrade({
  portfolio: makePortfolio({ positions: [] }),
  order: {
    symbol: '',
    quantity: 0,
    entryPrice: 0,
    paperOnly: true
  }
});
assert('Invalid paper order is blocked', invalidOrder.authorized === false);
assert('Invalid order gate fails', invalidOrder.gates.orderValid === false);
assert('Invalid order remains paper-only', invalidOrder.paperOnly === true);
assert('Invalid order places no real order', invalidOrder.realOrderPlaced === false);

const nonPaperOrder = authorizePaperTrade({
  portfolio: makePortfolio({ positions: [] }),
  order: {
    symbol: 'INFY:NSE',
    quantity: 1,
    entryPrice: 1000,
    paperOnly: false
  }
});
assert('Non-paper order is blocked', nonPaperOrder.authorized === false);
assert('Non-paper gate fails explicitly', nonPaperOrder.gates.paperOnly === false);
assert('Non-paper request still reports no real order', nonPaperOrder.realOrderPlaced === false);

// ------------------------------------------------------------
// 2AX–2AZ — PAPER DASHBOARD AGGREGATION
// ------------------------------------------------------------

const dashboardPortfolio = makePortfolio();
const dashboard = buildPaperTradingDashboard(dashboardPortfolio, {
  maxRiskPercent: 1
});

assert('Paper dashboard is valid', dashboard.valid === true);
assert('Dashboard is paper-only', dashboard.paperOnly === true);
assert('Dashboard reports no real order', dashboard.realOrderPlaced === false);
assert('Dashboard account equity is 100000', dashboard.account.equity === 100000);
assert('Dashboard account cash is 75000', dashboard.account.cash === 75000);
assert('Dashboard total P&L is 750', dashboard.account.totalPnL === 750);
assert('Dashboard performance net P&L is 500', dashboard.performance.netPnL === 500);
assert('Dashboard has two open positions', dashboard.activity.openPositions === 2);
assert('Dashboard has one closed position', dashboard.activity.closedPositions === 1);
assert('Dashboard activity reports one order', dashboard.activity.totalOrders === 1);
assert('Dashboard journal reports one closed trade', dashboard.journal.totalTrades === 1);
assert('Dashboard risk status is exposed', typeof dashboard.risk.status === 'string');
assert('Dashboard risk metrics are numeric', Number.isFinite(dashboard.risk.openRisk));

const summary = buildPaperTradingDashboardSummary(dashboardPortfolio, {
  maxRiskPercent: 1
});
assert('Dashboard summary is valid', summary.valid === true);
assert('Dashboard summary remains paper-only', summary.paperOnly === true);
assert('Dashboard summary reports no real order', summary.realOrderPlaced === false);
assert('Summary equity matches dashboard', summary.headline.equity === dashboard.account.equity);
assert('Summary P&L matches dashboard', summary.headline.totalPnL === dashboard.account.totalPnL);
assert('Summary counts match dashboard', summary.counts.openPositions === dashboard.activity.openPositions);
assert('Summary risk status matches dashboard', summary.headline.riskStatus === dashboard.risk.status);

const positionView = getPaperTradingDashboardPosition(dashboardPortfolio, 'INFY:NSE');
assert('Dashboard position lookup is valid', positionView.valid === true);
assert('Dashboard position is found', positionView.position.found === true);
assert('Position lookup remains paper-only', positionView.paperOnly === true);
assert('Position lookup reports no real order', positionView.realOrderPlaced === false);
assert('Position lookup preserves symbol', positionView.symbol === 'INFY:NSE');

const missingPositionView = getPaperTradingDashboardPosition(dashboardPortfolio, 'MISSING:NSE');
assert('Missing position lookup remains valid', missingPositionView.valid === true);
assert('Missing position is not falsely found', missingPositionView.position.found === false);
assert('Missing position remains paper-only', missingPositionView.paperOnly === true);

const failed = results.filter(r => !r.passed);

console.log('\n===== STEP 2AQ–2AZ DASHBOARD SUMMARY =====');
console.table({
  RiskValid: risk.valid,
  RiskExposure: risk.exposure,
  RiskExposurePercent: risk.exposurePercent,
  SafeOrderAuthorized: safeOrder.authorized,
  OversizedOrderAuthorized: oversizedOrder.authorized,
  DashboardValid: dashboard.valid,
  DashboardEquity: dashboard.account?.equity,
  DashboardTotalPnL: dashboard.account?.totalPnL,
  DashboardOpenPositions: dashboard.activity?.openPositions,
  PaperOnly: dashboard.paperOnly,
  RealOrderPlaced: dashboard.realOrderPlaced
});

console.log('\n============================================================');
console.log('STEP 2AQ–2AZ TEST RESULT');
console.log('============================================================');
console.table({
  Passed: results.length - failed.length,
  Failed: failed.length,
  AllAssertionsPassed: failed.length === 0,
  SuiteStatus: failed.length === 0 ? 'PASSED' : 'FAILED'
});
if (failed.length) console.table(failed);
console.log(failed.length === 0
  ? '✅ STEP 2AQ–2AZ BULK TEST SUITE PASSED'
  : '❌ STEP 2AQ–2AZ BULK TEST SUITE FAILED');
console.log('============================================================');

const allAssertionsPassed = failed.length === 0;
export { results, allAssertionsPassed };
