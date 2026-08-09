// ============================================================
// AI TRADE PRO — STEP 2M TEST RUNNER
// PAPER PORTFOLIO / POSITION / P&L MANAGEMENT
// ============================================================

import {
  createPaperPortfolio,
  getPortfolioSummary,
  openPaperPosition,
  markPaperPosition,
  closePaperPosition,
  resetPaperPortfolio
} from './services/paperPortfolioEngine.js';

const results = [];

function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](
    `${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`
  );
}

function safeBuyOrder(overrides = {}) {
  return {
    symbol: 'INFY:NSE',
    side: 'BUY',
    action: 'LONG',
    quantity: 100,
    entryPrice: 100,
    stopLoss: 95,
    targetPrice: 110,
    ...overrides
  };
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2M TEST RUNNER');
console.log('PAPER PORTFOLIO / POSITION / P&L MANAGEMENT');
console.log('============================================================');

// ------------------------------------------------------------
// TEST 1 — CREATE PORTFOLIO
// ------------------------------------------------------------

const portfolio = createPaperPortfolio({ initialCapital: 100000 });

assert('Paper portfolio initializes successfully', portfolio.valid === true);
assert('Portfolio is explicitly paper-only', portfolio.paperOnly === true);
assert('Initial capital is preserved', portfolio.initialCapital === 100000);
assert('Initial cash equals capital', portfolio.cash === 100000);
assert('Portfolio starts with no positions', portfolio.positions.length === 0);
assert('Portfolio starts with zero realized P&L', portfolio.realizedPnL === 0);
assert('Portfolio starts with zero unrealized P&L', portfolio.unrealizedPnL === 0);
assert('Portfolio starts with zero real orders', portfolio.realOrderPlaced === false);

// ------------------------------------------------------------
// TEST 2 — OPEN LONG POSITION
// ------------------------------------------------------------

const opened = openPaperPosition(portfolio, safeBuyOrder());

assert('Valid BUY paper order opens a position', opened.created === true);
assert('Opened position is LONG', opened.position?.action === 'LONG');
assert('Opened position has correct quantity', opened.position?.quantity === 100);
assert('Opened position has correct entry price', opened.position?.entryPrice === 100);
assert('Cash is reduced by position value', portfolio.cash === 90000);
assert('Reserved capital equals position value', portfolio.reservedCapital === 10000);
assert('Open position count is one', portfolio.positions.length === 1);
assert('Paper order is recorded', portfolio.orders.length === 1);
assert('Real order remains false', opened.realOrderPlaced === false);

// ------------------------------------------------------------
// TEST 3 — DUPLICATE POSITION PROTECTION
// ------------------------------------------------------------

const duplicate = openPaperPosition(portfolio, safeBuyOrder());
assert('Duplicate symbol position is rejected', duplicate.created === false);
assert('Duplicate position rejection reason is recorded', duplicate.reason === 'DUPLICATE_OPEN_POSITION');
assert('Duplicate position does not change position count', portfolio.positions.length === 1);

// ------------------------------------------------------------
// TEST 4 — MARK TO MARKET
// ------------------------------------------------------------

const markedUp = markPaperPosition(portfolio, 'INFY:NSE', 105);

assert('Open position can be marked to market', markedUp.updated === true);
assert('LONG unrealized P&L is positive at higher price', markedUp.position?.unrealizedPnL === 500);
assert('Portfolio unrealized P&L updates', portfolio.unrealizedPnL === 500);
assert('Portfolio equity reflects unrealized P&L', portfolio.equity === 100500);
assert('Mark-to-market remains paper-only', markedUp.realOrderPlaced === false);

const markedDown = markPaperPosition(portfolio, 'INFY:NSE', 98);
assert('Position can be marked down', markedDown.updated === true);
assert('LONG unrealized P&L becomes negative below entry', markedDown.position?.unrealizedPnL === -200);
assert('Negative unrealized P&L is represented correctly', portfolio.unrealizedPnL === -200);

// ------------------------------------------------------------
// TEST 5 — CLOSE LONG AND REALIZED P&L
// ------------------------------------------------------------

const closed = closePaperPosition(portfolio, 'INFY:NSE', 110, 'TARGET_HIT');

assert('Open position can be closed', closed.closed === true);
assert('Closed position records realized profit', closed.realizedPnL === 1000);
assert('Open position count returns to zero', portfolio.positions.length === 0);
assert('Closed position history contains one position', portfolio.closedPositions.length === 1);
assert('Realized P&L is retained', portfolio.realizedPnL === 1000);
assert('Cash reflects closing proceeds', portfolio.cash === 101000);
assert('Reserved capital is released', portfolio.reservedCapital === 0);
assert('Equity equals cash after close', portfolio.equity === 101000);
assert('Close operation remains paper-only', closed.realOrderPlaced === false);

// ------------------------------------------------------------
// TEST 6 — INVALID / UNSAFE INPUTS
// ------------------------------------------------------------

const invalidSymbol = openPaperPosition(portfolio, safeBuyOrder({ symbol: '' }));
assert('Invalid symbol is rejected', invalidSymbol.created === false);

const invalidQuantity = openPaperPosition(portfolio, safeBuyOrder({ quantity: 0 }));
assert('Zero quantity is rejected', invalidQuantity.created === false);

const invalidPrice = openPaperPosition(portfolio, safeBuyOrder({ entryPrice: 0 }));
assert('Invalid entry price is rejected', invalidPrice.created === false);

const mismatch = openPaperPosition(portfolio, safeBuyOrder({ side: 'SELL', action: 'LONG' }));
assert('Side/action mismatch is rejected', mismatch.created === false);

const insufficient = openPaperPosition(portfolio, safeBuyOrder({ quantity: 2000 }));
assert('Insufficient paper cash is rejected', insufficient.created === false);

const missingPosition = markPaperPosition(portfolio, 'TCS:NSE', 100);
assert('Marking an unknown position is rejected', missingPosition.updated === false);

const missingClose = closePaperPosition(portfolio, 'TCS:NSE', 100);
assert('Closing an unknown position is rejected', missingClose.closed === false);

// ------------------------------------------------------------
// TEST 7 — SHORT POSITION / P&L
// ------------------------------------------------------------

const shortOpened = openPaperPosition(
  portfolio,
  {
    symbol: 'TCS:NSE',
    side: 'SELL',
    action: 'SHORT',
    quantity: 100,
    entryPrice: 200,
    stopLoss: 210,
    targetPrice: 180
  }
);

assert('Valid SELL paper order opens SHORT position', shortOpened.created === true);
assert('SHORT position action is correct', shortOpened.position?.action === 'SHORT');

const shortMarked = markPaperPosition(portfolio, 'TCS:NSE', 190);
assert('SHORT position can be marked to market', shortMarked.updated === true);
assert('SHORT unrealized P&L is positive when price falls', shortMarked.position?.unrealizedPnL === 1000);

const shortClosed = closePaperPosition(portfolio, 'TCS:NSE', 180, 'TARGET_HIT');
assert('SHORT position can be closed', shortClosed.closed === true);
assert('SHORT realized P&L is correct', shortClosed.realizedPnL === 2000);
assert('Total realized P&L includes LONG and SHORT', portfolio.realizedPnL === 3000);

// ------------------------------------------------------------
// TEST 8 — SUMMARY CONTRACT
// ------------------------------------------------------------

const summary = getPortfolioSummary(portfolio);

assert('Portfolio summary is valid', summary.valid === true);
assert('Summary remains paper-only', summary.paperOnly === true);
assert('Summary reports no open positions', summary.openPositions === 0);
assert('Summary reports two closed positions', summary.closedPositions === 2);
assert('Summary reports four recorded orders', summary.totalOrders === 4);
assert('Summary reports cumulative realized P&L', summary.realizedPnL === 3000);
assert('Summary confirms no real order placement', summary.realOrderPlaced === false);

// ------------------------------------------------------------
// TEST 9 — RESET
// ------------------------------------------------------------

const reset = resetPaperPortfolio(portfolio, 50000);

assert('Portfolio can be reset', reset.reset === true);
assert('Reset restores initial capital', portfolio.initialCapital === 50000);
assert('Reset restores cash', portfolio.cash === 50000);
assert('Reset removes positions', portfolio.positions.length === 0);
assert('Reset removes closed history', portfolio.closedPositions.length === 0);
assert('Reset removes order history', portfolio.orders.length === 0);
assert('Reset clears realized P&L', portfolio.realizedPnL === 0);
assert('Reset remains paper-only', reset.realOrderPlaced === false);

// ------------------------------------------------------------
// FINAL RESULT
// ------------------------------------------------------------

const passed = results.filter(result => result.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;

console.log('============================================================');
console.log('STEP 2M PAPER PORTFOLIO SUMMARY');
console.log('============================================================');

console.table({
  InitialCapital: 100000,
  FinalTestCapital: portfolio.initialCapital,
  FinalCash: portfolio.cash,
  OpenPositions: portfolio.positions.length,
  ClosedPositions: portfolio.closedPositions.length,
  RealizedPnLAfterReset: portfolio.realizedPnL,
  RealOrderPlaced: portfolio.realOrderPlaced
});

console.log('============================================================');
console.log('STEP 2M TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: allAssertionsPassed,
  SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED'
});

if (allAssertionsPassed) {
  console.log('✅ STEP 2M TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2M TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2M COMPLETE');
console.log('============================================================');

export default {
  results,
  passed,
  failed,
  allAssertionsPassed
};
