// ============================================================
// AI TRADE PRO — STEP 2N TEST RUNNER
// PAPER EXECUTION ORCHESTRATION / PORTFOLIO BOUNDARY
// ============================================================

import {
  createPaperPortfolio,
  openPaperPosition,
  markPaperPosition,
  closePaperPosition,
  getPortfolioSummary,
  resetPaperPortfolio
} from './services/paperPortfolioEngine.js';

import {
  processPaperDecision,
  buildPaperExecutionSnapshot
} from './services/paperExecutionOrchestrator.js';

const results = [];

function assert(condition, label) {
  const passed = Boolean(condition);
  results.push({ label, passed });
  console.log(passed ? `✅ ${label}` : `❌ ${label}`);
  return passed;
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2N TEST RUNNER');
console.log('============================================================');

const portfolio = createPaperPortfolio({ initialCapital: 100000 });

assert(portfolio.paperOnly === true, 'Portfolio is paper-only');
assert(portfolio.cash === 100000, 'Initial cash is correct');
assert(portfolio.positions.length === 0, 'Portfolio starts with no positions');
assert(portfolio.realOrderPlaced === false, 'No real order exists');

const safeBuy = {
  symbol: 'INFY:NSE',
  decision: 'BUY',
  action: 'LONG',
  executable: true,
  riskGatesPassed: true,
  entryPrice: 1000,
  stopLoss: 980,
  targetPrice: 1040,
  riskRewardRatio: 2,
  opportunityScore: 75,
  quantity: 20,
  positionValue: 20000,
  actualRiskAmount: 400,
  capitalAvailable: true
};

const buyResult = processPaperDecision(portfolio, safeBuy);
assert(buyResult.executed === true, 'Safe BUY becomes a paper position');
assert(buyResult.orderStatus === 'PAPER_POSITION_OPEN', 'Safe BUY order status is paper position open');
assert(buyResult.realOrderPlaced === false, 'Safe BUY never places a real order');
assert(portfolio.positions.length === 1, 'One position is open after BUY');
assert(portfolio.cash === 80000, 'Cash is reduced by position value');

const duplicate = processPaperDecision(portfolio, safeBuy);
assert(duplicate.executed === false, 'Duplicate position is blocked');
assert(duplicate.orderStatus === 'PAPER_ORDER_REJECTED', 'Duplicate position is rejected safely');

const mark = markPaperPosition(portfolio, 'INFY:NSE', 1025);
assert(mark.updated === true, 'Open position can be marked to market');
assert(mark.position.unrealizedPnL === 500, 'LONG unrealized P&L is calculated correctly');

const unsafe = processPaperDecision(portfolio, {
  ...safeBuy,
  symbol: 'TCS:NSE',
  executable: false,
  riskGatesPassed: false,
  decision: 'NO TRADE',
  action: 'NONE'
});
assert(unsafe.executed === false, 'Unsafe decision remains blocked');
assert(unsafe.orderStatus === 'BLOCKED', 'Unsafe decision produces BLOCKED status');
assert(unsafe.realOrderPlaced === false, 'Unsafe decision remains paper-only');
assert(portfolio.positions.length === 1, 'Unsafe decision does not create a position');

const close = closePaperPosition(portfolio, 'INFY:NSE', 1030, 'TEST_EXIT');
assert(close.closed === true, 'Paper position can be closed');
assert(close.realizedPnL === 600, 'Realized LONG P&L is calculated correctly');
assert(portfolio.positions.length === 0, 'Position is removed after close');
assert(portfolio.closedPositions.length === 1, 'Closed history is recorded');
assert(portfolio.realizedPnL === 600, 'Portfolio realized P&L is updated');
assert(portfolio.cash === 100600, 'Cash reflects realized P&L after close');

const reset = resetPaperPortfolio(portfolio, 100000);
assert(reset.reset === true, 'Portfolio reset succeeds');
assert(portfolio.cash === 100000, 'Reset restores cash');
assert(portfolio.positions.length === 0, 'Reset removes open positions');
assert(portfolio.closedPositions.length === 0, 'Reset removes closed history');
assert(portfolio.orders.length === 0, 'Reset removes order history');
assert(portfolio.realizedPnL === 0, 'Reset clears realized P&L');

const snapshot = buildPaperExecutionSnapshot(portfolio, safeBuy);
assert(snapshot.executable === true, 'Safe BUY snapshot is executable');
assert(snapshot.decision === 'BUY', 'Safe BUY snapshot preserves decision');
assert(snapshot.action === 'LONG', 'Safe BUY snapshot preserves action');
assert(snapshot.realOrderPlaced === false, 'Snapshot remains paper-only');

const blockedSnapshot = buildPaperExecutionSnapshot(portfolio, {
  ...safeBuy,
  executable: false,
  riskGatesPassed: false,
  decision: 'NO TRADE',
  action: 'NONE'
});
assert(blockedSnapshot.executable === false, 'Blocked snapshot is non-executable');
assert(blockedSnapshot.decision === 'NO TRADE', 'Blocked snapshot is NO TRADE');
assert(blockedSnapshot.action === 'NONE', 'Blocked snapshot has no action');

const summary = getPortfolioSummary(portfolio);

console.log('============================================================');
console.log('STEP 2N PAPER EXECUTION SUMMARY');
console.log('============================================================');
console.table({
  InitialCapital: summary.initialCapital,
  Cash: summary.cash,
  RealizedPnL: summary.realizedPnL,
  UnrealizedPnL: summary.unrealizedPnL,
  OpenPositions: summary.openPositions,
  ClosedPositions: summary.closedPositions,
  TotalOrders: summary.totalOrders,
  PaperOnly: summary.paperOnly,
  RealOrderPlaced: summary.realOrderPlaced
});

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;

console.log('============================================================');
console.log('STEP 2N TEST RESULT');
console.log('============================================================');
console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0,
  SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED'
});

if (failed === 0) {
  console.log('✅ STEP 2N TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2N TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2N COMPLETE');
console.log('============================================================');
