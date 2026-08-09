// ============================================================
// AI TRADE PRO — STEP 2S TEST RUNNER
// PAPER BACKTEST CONTRACT
// ============================================================
import { runPaperBacktest, compareBacktests } from './services/paperBacktestEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2S TEST RUNNER');
console.log('PAPER BACKTEST ENGINE');
console.log('============================================================');

// Expected P&L:
// T1 LONG  : +100
// T2 SHORT : +100
// T3 LONG  : -50
// T4 LONG  :   0
// ----------------
// Net P&L  : +150
const trades = [
  { id: 'T1', symbol: 'INFY:NSE', action: 'LONG', entryPrice: 100, exitPrice: 110, quantity: 10 },
  { id: 'T2', symbol: 'TCS:NSE', action: 'SHORT', entryPrice: 200, exitPrice: 190, quantity: 10 },
  { id: 'T3', symbol: 'RELIANCE:NSE', action: 'LONG', entryPrice: 300, exitPrice: 295, quantity: 10 },
  { id: 'T4', symbol: 'HDFCBANK:NSE', action: 'LONG', entryPrice: 400, exitPrice: 400, quantity: 10 }
];

const result = runPaperBacktest({ trades, initialCapital: 100000 });
assert('Backtest result is valid', result.valid === true);
assert('Backtest remains paper-only', result.paperOnly === true);
assert('Backtest places no real order', result.realOrderPlaced === false);
assert('Four trades are processed', result.totalTrades === 4);
assert('Two trades are winners', result.winningTrades === 2);
assert('One trade is a loser', result.losingTrades === 1);
assert('One trade is breakeven', result.breakevenTrades === 1);
assert('Net P&L is 150', result.netPnL === 150);
assert('Final equity is 100150', result.finalEquity === 100150);
assert('Return is 0.15%', result.returnPercent === 0.15);
assert('Maximum drawdown is 50', result.maxDrawdown === 50);
assert('Win rate is 50%', result.winRatePercent === 50);

const invalid = runPaperBacktest({ trades, initialCapital: 0 });
assert('Invalid capital is rejected', invalid.valid === false);
assert('Rejected backtest remains paper-only', invalid.paperOnly === true);
assert('Rejected backtest reports no real order', invalid.realOrderPlaced === false);

const comparison = compareBacktests(result, runPaperBacktest({
  trades: [...trades, { id: 'T5', symbol: 'SBIN:NSE', action: 'LONG', entryPrice: 100, exitPrice: 105, quantity: 10 }],
  initialCapital: 100000
}));
assert('Backtest comparison is valid', comparison.valid === true);
assert('Backtest comparison remains paper-only', comparison.paperOnly === true);
assert('Backtest comparison places no real order', comparison.realOrderPlaced === false);
assert('Comparison detects P&L delta', comparison.netPnLDelta === 50);

console.log('============================================================');
console.log('STEP 2S BACKTEST SUMMARY');
console.log('============================================================');
console.table({ TotalTrades: result.totalTrades, NetPnL: result.netPnL, ReturnPercent: result.returnPercent, WinRatePercent: result.winRatePercent, ProfitFactor: result.profitFactor, MaxDrawdown: result.maxDrawdown, PaperOnly: result.paperOnly, RealOrderPlaced: result.realOrderPlaced });

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.log('============================================================');
console.log('STEP 2S TEST RESULT');
console.log('============================================================');
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2S TEST SUITE PASSED' : '❌ STEP 2S TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2S COMPLETE');
console.log('============================================================');

export { results, result, comparison, allAssertionsPassed };
