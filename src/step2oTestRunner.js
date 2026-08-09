// ============================================================
// AI TRADE PRO — STEP 2O TEST RUNNER
// PAPER PORTFOLIO MONITOR / RISK DASHBOARD CONTRACT
// ============================================================

import {
  createPaperPortfolio,
  openPaperPosition,
  markPaperPosition,
  closePaperPosition
} from './services/paperPortfolioEngine.js';

import {
  buildPaperPortfolioMonitor,
  getPaperPositionMonitor,
  buildPaperPortfolioDashboardModel
} from './services/paperPortfolioMonitor.js';

const results = [];

function assert(name, condition) {
  const passed = Boolean(condition);
  results.push({ name, passed });
  console[passed ? 'log' : 'error'](
    `${passed ? '✅' : '❌'} ${name}`
  );
  return passed;
}

console.log('='.repeat(60));
console.log('AI TRADE PRO — STEP 2O TEST RUNNER');
console.log('='.repeat(60));

// ------------------------------------------------------------
// 1. Empty paper portfolio
// ------------------------------------------------------------

const portfolio = createPaperPortfolio({
  initialCapital: 100000
});

const emptyMonitor = buildPaperPortfolioMonitor(
  portfolio,
  { maxRiskPercent: 1 }
);

assert(
  'Empty portfolio monitor is valid',
  emptyMonitor.valid === true
);

assert(
  'Monitor remains paper-only',
  emptyMonitor.paperOnly === true &&
  emptyMonitor.realOrderPlaced === false
);

assert(
  'Initial equity is preserved',
  emptyMonitor.equity === 100000
);

assert(
  'Initial open risk is zero',
  emptyMonitor.totalOpenRisk === 0
);

assert(
  'Initial risk status is SAFE',
  emptyMonitor.riskStatus === 'SAFE'
);

// ------------------------------------------------------------
// 2. Open a safe paper position
// ------------------------------------------------------------

const opened = openPaperPosition(portfolio, {
  symbol: 'INFY:NSE',
  side: 'BUY',
  action: 'LONG',
  quantity: 100,
  entryPrice: 1000,
  stopLoss: 985,
  targetPrice: 1030
});

assert(
  'Safe paper position opens',
  opened.created === true
);

const positionMonitor = getPaperPositionMonitor(
  portfolio,
  'INFY:NSE'
);

assert(
  'Open position is visible to monitor',
  positionMonitor.found === true
);

assert(
  'Position action remains LONG',
  positionMonitor.action === 'LONG'
);

assert(
  'Position risk is calculated correctly',
  positionMonitor.riskAmount === 1500
);

const monitoredAfterOpen = buildPaperPortfolioMonitor(
  portfolio,
  { maxRiskPercent: 1 }
);

assert(
  'Open risk is reflected in portfolio monitor',
  monitoredAfterOpen.totalOpenRisk === 1500
);

assert(
  'Risk utilization is 150 percent',
  monitoredAfterOpen.riskUtilizationPercent === 150
);

assert(
  'Risk status becomes OVER_RISK when above limit',
  monitoredAfterOpen.riskStatus === 'OVER_RISK'
);

// ------------------------------------------------------------
// 3. Mark-to-market
// ------------------------------------------------------------

const marked = markPaperPosition(
  portfolio,
  'INFY:NSE',
  1010
);

assert(
  'Paper position can be marked to market',
  marked.updated === true
);

assert(
  'Unrealized P&L is positive after price increase',
  portfolio.unrealizedPnL === 1000
);

const dashboardAfterMark = buildPaperPortfolioDashboardModel(
  portfolio,
  { maxRiskPercent: 2 }
);

assert(
  'Dashboard model is valid after mark-to-market',
  dashboardAfterMark.valid === true
);

assert(
  'Dashboard exposes unrealized P&L through total P&L',
  dashboardAfterMark.headline.totalPnL === 1000
);

assert(
  'Risk utilization falls below 100 percent with 2 percent limit',
  dashboardAfterMark.risk.utilizationPercent === 75
);

assert(
  'Risk status is MODERATE_RISK at 75 percent utilization',
  dashboardAfterMark.risk.status === 'MODERATE_RISK'
);

// ------------------------------------------------------------
// 4. Close position
// ------------------------------------------------------------

const closed = closePaperPosition(
  portfolio,
  'INFY:NSE',
  1020,
  'STEP_2O_TEST'
);

assert(
  'Paper position closes successfully',
  closed.closed === true
);

assert(
  'Realized P&L is 2000 after closing at 1020',
  portfolio.realizedPnL === 2000
);

assert(
  'Open positions return to zero after close',
  portfolio.positions.length === 0
);

const finalMonitor = buildPaperPortfolioMonitor(
  portfolio,
  { maxRiskPercent: 1 }
);

assert(
  'Final monitor shows zero open risk',
  finalMonitor.totalOpenRisk === 0
);

assert(
  'Final monitor shows realized P&L',
  finalMonitor.realizedPnL === 2000
);

assert(
  'Final monitor shows zero unrealized P&L',
  finalMonitor.unrealizedPnL === 0
);

assert(
  'Final monitor shows 2 percent return',
  finalMonitor.totalReturnPercent === 2
);

assert(
  'Final risk status returns to SAFE',
  finalMonitor.riskStatus === 'SAFE'
);

assert(
  'Monitor never reports a real order',
  finalMonitor.realOrderPlaced === false
);

// ------------------------------------------------------------
// 5. Invalid / unsafe portfolio boundary
// ------------------------------------------------------------

const invalidMonitor = buildPaperPortfolioMonitor(null);

assert(
  'Invalid portfolio is rejected safely',
  invalidMonitor.valid === false
);

assert(
  'Invalid portfolio remains non-executable',
  invalidMonitor.paperOnly === true
);

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------

const passed = results.filter(item => item.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;

console.log('='.repeat(60));
console.log('STEP 2O PAPER PORTFOLIO MONITOR SUMMARY');
console.log('='.repeat(60));

console.table({
  InitialCapital: portfolio.initialCapital,
  FinalCash: portfolio.cash,
  FinalEquity: finalMonitor.equity,
  RealizedPnL: finalMonitor.realizedPnL,
  UnrealizedPnL: finalMonitor.unrealizedPnL,
  TotalPnL: finalMonitor.totalPnL,
  ReturnPercent: finalMonitor.totalReturnPercent,
  OpenPositions: finalMonitor.openPositions,
  ClosedPositions: finalMonitor.closedPositions,
  OpenRisk: finalMonitor.totalOpenRisk,
  RiskStatus: finalMonitor.riskStatus,
  PaperOnly: finalMonitor.paperOnly,
  RealOrderPlaced: finalMonitor.realOrderPlaced
});

console.log('='.repeat(60));
console.log('STEP 2O TEST RESULT');
console.log('='.repeat(60));

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: allAssertionsPassed,
  SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED'
});

if (allAssertionsPassed) {
  console.log('✅ STEP 2O TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2O TEST SUITE FAILED');
}

console.log('='.repeat(60));
console.log('STEP 2O COMPLETE');
console.log('='.repeat(60));

export default {
  passed,
  failed,
  allAssertionsPassed
};
