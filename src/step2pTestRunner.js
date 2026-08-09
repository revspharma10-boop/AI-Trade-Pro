// ============================================================
// AI TRADE PRO — STEP 2P TEST RUNNER
// PAPER PERFORMANCE / TRADE JOURNAL CONTRACT
// ============================================================

import {
  buildPaperTradeJournal,
  calculatePaperPerformance,
  buildPaperPerformanceDashboardModel
} from './services/paperPerformanceEngine.js';

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
    cash: 100000,
    equity: 100000,
    realizedPnL: 0,
    unrealizedPnL: 0,
    closedPositions: [],
    positions: [],
    orders: [],
    ...overrides
  };
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2P TEST RUNNER');
console.log('PAPER PERFORMANCE / TRADE JOURNAL');
console.log('============================================================');

// ------------------------------------------------------------
// TEST 1 — EMPTY PAPER PORTFOLIO
// ------------------------------------------------------------
const emptyPortfolio = makePortfolio();
const emptyPerformance = calculatePaperPerformance(emptyPortfolio);

assert('Empty paper portfolio is valid', emptyPerformance.valid === true);
assert('Empty portfolio remains paper-only', emptyPerformance.paperOnly === true);
assert('Empty portfolio places no real order', emptyPerformance.realOrderPlaced === false);
assert('Empty portfolio has zero trades', emptyPerformance.totalTrades === 0);
assert('Empty portfolio has zero P&L', emptyPerformance.netPnL === 0);
assert('Empty portfolio has zero win rate', emptyPerformance.winRatePercent === 0);
assert('Empty portfolio has zero drawdown', emptyPerformance.maxDrawdown === 0);

// ------------------------------------------------------------
// TEST 2 — MIXED TRADE HISTORY
// ------------------------------------------------------------
const mixedPortfolio = makePortfolio({
  closedPositions: [
    {
      id: 'T1',
      symbol: 'INFY:NSE',
      action: 'LONG',
      side: 'BUY',
      quantity: 10,
      entryPrice: 100,
      exitPrice: 110,
      realizedPnL: 100,
      openedAt: '2026-08-09T09:15:00Z',
      closedAt: '2026-08-09T10:00:00Z'
    },
    {
      id: 'T2',
      symbol: 'TCS:NSE',
      action: 'SHORT',
      side: 'SELL',
      quantity: 10,
      entryPrice: 200,
      exitPrice: 205,
      realizedPnL: -50
    },
    {
      id: 'T3',
      symbol: 'RELIANCE:NSE',
      action: 'LONG',
      side: 'BUY',
      quantity: 5,
      entryPrice: 300,
      exitPrice: 300,
      realizedPnL: 0
    },
    {
      id: 'T4',
      symbol: 'HDFCBANK:NSE',
      action: 'LONG',
      side: 'BUY',
      quantity: 10,
      entryPrice: 400,
      exitPrice: 410,
      realizedPnL: 100
    }
  ]
});

const journal = buildPaperTradeJournal(mixedPortfolio);
const performance = calculatePaperPerformance(mixedPortfolio);
const dashboard = buildPaperPerformanceDashboardModel(mixedPortfolio);

assert('Trade journal is valid', journal.valid === true);
assert('Journal remains paper-only', journal.paperOnly === true);
assert('Journal blocks real orders', journal.realOrderPlaced === false);
assert('Journal captures four closed trades', journal.totalTrades === 4);
assert('Performance captures two winning trades', performance.winningTrades === 2);
assert('Performance captures one losing trade', performance.losingTrades === 1);
assert('Performance captures one breakeven trade', performance.breakevenTrades === 1);
assert('Gross profit is 200', performance.grossProfit === 200);
assert('Gross loss is 50', performance.grossLoss === 50);
assert('Net P&L is 150', performance.netPnL === 150);
assert('Win rate is 50%', performance.winRatePercent === 50);
assert('Average win is 100', performance.averageWin === 100);
assert('Average loss is 50', performance.averageLoss === 50);
assert('Expectancy is 37.5 per trade', performance.expectancyPerTrade === 37.5);
assert('Profit factor is 4', performance.profitFactor === 4);
assert('Return is 0.15%', performance.returnPercent === 0.15);
assert('Maximum drawdown is 50', performance.maxDrawdown === 50);
assert('Dashboard model is valid', dashboard.valid === true);
assert('Dashboard remains paper-only', dashboard.paperOnly === true);
assert('Dashboard never places real orders', dashboard.realOrderPlaced === false);
assert('Dashboard headline net P&L is 150', dashboard.headline.netPnL === 150);
assert('Dashboard headline win rate is 50%', dashboard.headline.winRatePercent === 50);
assert('Dashboard headline profit factor is 4', dashboard.headline.profitFactor === 4);

// ------------------------------------------------------------
// TEST 3 — UNSAFE / NON-PAPER INPUT
// ------------------------------------------------------------
const unsafePortfolio = {
  ...mixedPortfolio,
  paperOnly: false,
  realOrderPlaced: true
};

const unsafePerformance = calculatePaperPerformance(unsafePortfolio);

assert('Non-paper portfolio is rejected', unsafePerformance.valid === false);
assert('Rejected portfolio remains explicitly paper-only', unsafePerformance.paperOnly === true);
assert('Rejected portfolio reports no real order', unsafePerformance.realOrderPlaced === false);

// ------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------
console.log('============================================================');
console.log('STEP 2P PAPER PERFORMANCE SUMMARY');
console.log('============================================================');

console.table({
  TotalTrades: performance.totalTrades,
  WinningTrades: performance.winningTrades,
  LosingTrades: performance.losingTrades,
  BreakevenTrades: performance.breakevenTrades,
  GrossProfit: performance.grossProfit,
  GrossLoss: performance.grossLoss,
  NetPnL: performance.netPnL,
  WinRatePercent: performance.winRatePercent,
  ExpectancyPerTrade: performance.expectancyPerTrade,
  ProfitFactor: performance.profitFactor,
  MaxDrawdown: performance.maxDrawdown,
  ReturnPercent: performance.returnPercent,
  PaperOnly: performance.paperOnly,
  RealOrderPlaced: performance.realOrderPlaced
});

const passed = results.filter(item => item.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;

console.log('============================================================');
console.log('STEP 2P TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: allAssertionsPassed,
  SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED'
});

if (allAssertionsPassed) {
  console.log('✅ STEP 2P TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2P TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2P COMPLETE');
console.log('============================================================');

export {
  results,
  journal,
  performance,
  dashboard,
  allAssertionsPassed
};
