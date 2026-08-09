// ============================================================
// AI TRADE PRO — STEP 2Q TEST RUNNER
// PAPER TRADING DASHBOARD CONTRACT
// ============================================================

import {
  buildPaperTradingDashboard,
  getPaperTradingDashboardPosition,
  buildPaperTradingDashboardSummary
} from './services/paperTradingDashboardEngine.js';

const results = [];

function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](
    `${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`
  );
  return passed;
}

function makePortfolio(overrides = {}) {
  return {
    paperOnly: true,
    realOrderPlaced: false,
    initialCapital: 100000,
    cash: 98500,
    reservedCapital: 1500,
    equity: 100150,
    realizedPnL: 150,
    unrealizedPnL: 0,
    positions: [
      {
        symbol: 'INFY:NSE',
        action: 'LONG',
        side: 'BUY',
        quantity: 10,
        entryPrice: 100,
        currentPrice: 105,
        stopLoss: 95,
        targetPrice: 110,
        positionValue: 1050,
        unrealizedPnL: 50,
        status: 'OPEN'
      }
    ],
    closedPositions: [
      {
        id: 'T1',
        symbol: 'TCS:NSE',
        action: 'LONG',
        side: 'BUY',
        quantity: 10,
        entryPrice: 100,
        exitPrice: 110,
        realizedPnL: 100
      },
      {
        id: 'T2',
        symbol: 'RELIANCE:NSE',
        action: 'SHORT',
        side: 'SELL',
        quantity: 10,
        entryPrice: 200,
        exitPrice: 205,
        realizedPnL: -50
      },
      {
        id: 'T3',
        symbol: 'HDFCBANK:NSE',
        action: 'LONG',
        side: 'BUY',
        quantity: 5,
        entryPrice: 300,
        exitPrice: 300,
        realizedPnL: 0
      }
    ],
    orders: [
      { id: 'O1', status: 'PAPER_ORDER_CREATED' }
    ],
    ...overrides
  };
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2Q TEST RUNNER');
console.log('PAPER TRADING DASHBOARD');
console.log('============================================================');

// ------------------------------------------------------------
// TEST 1 — COMPLETE PAPER DASHBOARD
// ------------------------------------------------------------
const portfolio = makePortfolio();
const dashboard = buildPaperTradingDashboard(portfolio);
const summary = buildPaperTradingDashboardSummary(portfolio);
const position = getPaperTradingDashboardPosition(
  portfolio,
  'INFY:NSE'
);

assert('Dashboard is valid', dashboard.valid === true);
assert('Dashboard remains paper-only', dashboard.paperOnly === true);
assert('Dashboard places no real order', dashboard.realOrderPlaced === false);
assert('Initial capital is preserved', dashboard.account.initialCapital === 100000);
assert('Cash is preserved', dashboard.account.cash === 98500);
assert('Equity is preserved', dashboard.account.equity === 100150);
assert('Total P&L is calculated', dashboard.account.totalPnL === 150);
assert('Open risk is calculated', dashboard.risk.openRisk === 50);
assert('Risk limit is calculated', dashboard.risk.maxAllowedRisk === 1000);
assert('Risk utilization is 5%', dashboard.risk.riskUtilizationPercent === 5);
assert('Risk status is SAFE', dashboard.risk.status === 'SAFE');
assert('Closed trade count is preserved', dashboard.performance.totalTrades === 3);
assert('Win count is preserved', dashboard.performance.winningTrades === 1);
assert('Loss count is preserved', dashboard.performance.losingTrades === 1);
assert('Breakeven count is preserved', dashboard.performance.breakevenTrades === 1);
assert('Net performance P&L is 50', dashboard.performance.netPnL === 50);
assert('Win rate is 33.33%', dashboard.performance.winRatePercent === 33.33);
assert('Maximum drawdown is 50', dashboard.performance.maxDrawdown === 50);
assert('Open position count is 1', dashboard.activity.openPositions === 1);
assert('Closed position count is 3', dashboard.activity.closedPositions === 3);
assert('Order count is 1', dashboard.activity.totalOrders === 1);
assert('Journal contains three trades', dashboard.journal.totalTrades === 3);
assert('Position lookup is valid', position.valid === true);
assert('Position lookup finds INFY', position.position.found === true);
assert('Position lookup remains paper-only', position.position.paperOnly === true);
assert('Position lookup reports no real order', position.position.realOrderPlaced === false);
assert('Summary model is valid', summary.valid === true);
assert('Summary remains paper-only', summary.paperOnly === true);
assert('Summary exposes equity', summary.headline.equity === 100150);
assert('Summary exposes risk status', summary.headline.riskStatus === 'SAFE');

// ------------------------------------------------------------
// TEST 2 — UNSAFE INPUT
// ------------------------------------------------------------
const unsafePortfolio = makePortfolio({
  paperOnly: false,
  realOrderPlaced: true
});

const unsafeDashboard = buildPaperTradingDashboard(unsafePortfolio);
const unsafeSummary = buildPaperTradingDashboardSummary(unsafePortfolio);

assert('Non-paper dashboard input is rejected', unsafeDashboard.valid === false);
assert('Rejected dashboard remains paper-only', unsafeDashboard.paperOnly === true);
assert('Rejected dashboard reports no real order', unsafeDashboard.realOrderPlaced === false);
assert('Non-paper summary input is rejected', unsafeSummary.valid === false);
assert('Rejected summary reports no real order', unsafeSummary.realOrderPlaced === false);

// ------------------------------------------------------------
// TEST 3 — MISSING POSITION
// ------------------------------------------------------------
const missingPosition = getPaperTradingDashboardPosition(
  portfolio,
  'SBIN:NSE'
);

assert('Missing position lookup remains valid', missingPosition.valid === true);
assert('Missing position is reported as not found', missingPosition.position.found === false);
assert('Missing position remains paper-only', missingPosition.paperOnly === true);
assert('Missing position reports no real order', missingPosition.realOrderPlaced === false);

// ------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------
console.log('============================================================');
console.log('STEP 2Q PAPER TRADING DASHBOARD SUMMARY');
console.log('============================================================');

console.table({
  InitialCapital: dashboard.account.initialCapital,
  Cash: dashboard.account.cash,
  Equity: dashboard.account.equity,
  TotalPnL: dashboard.account.totalPnL,
  ReturnPercent: dashboard.account.totalReturnPercent,
  OpenRisk: dashboard.risk.openRisk,
  MaxAllowedRisk: dashboard.risk.maxAllowedRisk,
  RiskUtilizationPercent: dashboard.risk.riskUtilizationPercent,
  RiskStatus: dashboard.risk.status,
  TotalTrades: dashboard.performance.totalTrades,
  WinRatePercent: dashboard.performance.winRatePercent,
  NetPerformancePnL: dashboard.performance.netPnL,
  MaxDrawdown: dashboard.performance.maxDrawdown,
  OpenPositions: dashboard.activity.openPositions,
  ClosedPositions: dashboard.activity.closedPositions,
  TotalOrders: dashboard.activity.totalOrders,
  PaperOnly: dashboard.paperOnly,
  RealOrderPlaced: dashboard.realOrderPlaced
});

const passed = results.filter(item => item.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;

console.log('============================================================');
console.log('STEP 2Q TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: allAssertionsPassed,
  SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED'
});

if (allAssertionsPassed) {
  console.log('✅ STEP 2Q TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2Q TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2Q COMPLETE');
console.log('============================================================');

export {
  results,
  dashboard,
  summary,
  position,
  allAssertionsPassed
};
