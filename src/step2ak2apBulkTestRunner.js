// ============================================================
// AI TRADE PRO — STEP 2AK–2AP BULK TEST RUNNER
// STRATEGY PORTFOLIO ORCHESTRATION
// ============================================================
import {
  createStrategyPortfolio,
  registerStrategy,
  advancePortfolioBar,
  validatePortfolioRisk,
  rankSignals,
  stagePaperOrder,
  closePaperPosition,
  processSignalBatch,
  getStrategyPortfolioSnapshot,
  resetDailyRisk
} from './services/strategyPortfolioEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('='.repeat(60));
console.log('AI TRADE PRO — STEP 2AK–2AP BULK TEST RUNNER');
console.log('STRATEGY PORTFOLIO ORCHESTRATION');
console.log('='.repeat(60));

const portfolio = createStrategyPortfolio({
  capital: 100000,
  maxOpenPositions: 2,
  maxCapitalUtilizationPercent: 50,
  maxDailyLossPercent: 2,
  cooldownBars: 1
});

assert('Portfolio is valid', portfolio.valid === true);
assert('Portfolio is paper-only', portfolio.paperOnly === true);
assert('Portfolio reports no real order', portfolio.realOrderPlaced === false);

const a = registerStrategy(portfolio, { id: 'TREND-A', name: 'Trend Strategy', priority: 80 });
const b = registerStrategy(portfolio, { id: 'MOMENTUM-B', name: 'Momentum Strategy', priority: 60 });
const dup = registerStrategy(portfolio, { id: 'TREND-A', name: 'Duplicate' });
assert('First strategy registers', a.added === true);
assert('Second strategy registers', b.added === true);
assert('Duplicate strategy does not increase count', dup.duplicate === true && portfolio.strategies.length === 2);

const signals = [
  { symbol: 'infy:nse', decision: 'BUY', opportunityScore: 82, priority: 70, strategyId: 'TREND-A', quantity: 100, entry: 1000, stopLoss: 990, target: 1020, capitalUsed: 25000 },
  { symbol: 'TCS:NSE', decision: 'SELL', opportunityScore: 91, priority: 60, strategyId: 'MOMENTUM-B', quantity: 20, entry: 2000, stopLoss: 2020, target: 1960, capitalUsed: 20000 },
  { symbol: 'OVERSIZED:NSE', decision: 'BUY', opportunityScore: 70, priority: 50, quantity: 10, entry: 1000, stopLoss: 990, target: 1020, capitalUsed: 10000 },
  { symbol: 'BAD:NSE', decision: 'NO TRADE', opportunityScore: 99 }
];

const ranked = rankSignals(signals);
assert('Signals are ranked by opportunity score', ranked[0]?.symbol === 'TCS:NSE');
assert('NO TRADE is excluded from executable candidates', ranked.every(s => s.decision !== 'NO TRADE'));

advancePortfolioBar(portfolio);
const batch = processSignalBatch(portfolio, signals);
assert('Batch processing is valid', batch.valid === true);
assert('Batch remains paper-only', batch.paperOnly === true);
assert('Batch places no real order', batch.realOrderPlaced === false);
assert('Two safe signals are staged', batch.acceptedCount === 2);
assert('Oversized candidate is blocked by capital limit', batch.blockedCount === 1);
assert('Open position count is two', portfolio.positions.length === 2);

// Duplicate-symbol protection must be tested while the portfolio is not
// already at the position limit; otherwise MAX_OPEN_POSITIONS correctly
// takes precedence over the duplicate-symbol check.
const duplicatePortfolio = createStrategyPortfolio({
  capital: 100000,
  maxOpenPositions: 2,
  maxCapitalUtilizationPercent: 50,
  maxDailyLossPercent: 2,
  cooldownBars: 1
});
stagePaperOrder(duplicatePortfolio, {
  symbol: 'TCS:NSE', decision: 'SELL', quantity: 1, entry: 2000,
  stopLoss: 2020, target: 1960, capitalUsed: 1000
});
const duplicateRisk = validatePortfolioRisk(duplicatePortfolio, { symbol: 'TCS:NSE', capitalUsed: 1000 });
assert('Already-open symbol is blocked', duplicateRisk.allowed === false && duplicateRisk.reason === 'SYMBOL_ALREADY_OPEN');

const third = stagePaperOrder(portfolio, {
  symbol: 'RELIANCE:NSE', decision: 'BUY', strategyId: 'TREND-A', quantity: 10,
  entry: 2500, stopLoss: 2475, target: 2550, capitalUsed: 5000
});
assert('Portfolio limit blocks third open position', third.authorized === false && third.reason === 'MAX_OPEN_POSITIONS');

const closed = closePaperPosition(portfolio, { symbol: 'INFY:NSE', exitPrice: 1020, reason: 'TARGET' });
assert('Paper position closes successfully', closed.closed === true);
assert('Closed paper position records positive P&L', closed.pnl === 2000);
assert('Realized P&L is updated', portfolio.dailyRealizedPnL === 2000);
assert('Closed trade remains paper-only', closed.paperOnly === true && closed.realOrderPlaced === false);

const reopened = stagePaperOrder(portfolio, {
  symbol: 'RELIANCE:NSE', decision: 'BUY', strategyId: 'TREND-A', quantity: 10,
  entry: 2500, stopLoss: 2475, target: 2550, capitalUsed: 5000
});
assert('Freed position slot permits safe staging', reopened.authorized === true);
assert('Reopened position is paper-only', reopened.authorized === true && reopened.realOrderPlaced === false);

// Cooldown must be tested against a recently CLOSED symbol, not an already
// OPEN symbol. An open symbol is correctly rejected as SYMBOL_ALREADY_OPEN.
const cooldown = stagePaperOrder(portfolio, {
  symbol: 'INFY:NSE', decision: 'BUY', quantity: 100, entry: 1000,
  stopLoss: 990, target: 1020, capitalUsed: 25000
});
assert('Cooldown prevents immediate re-entry', cooldown.authorized === false && cooldown.reason === 'COOLDOWN_ACTIVE');

const snapshot = getStrategyPortfolioSnapshot(portfolio);
console.log('\n===== STEP 2AK–2AP PORTFOLIO SUMMARY =====');
console.table(snapshot);
assert('Portfolio snapshot is valid', snapshot.valid === true);
assert('Snapshot remains paper-only', snapshot.paperOnly === true);
assert('Snapshot reports no real order', snapshot.realOrderPlaced === false);
assert('Snapshot is marked safe', snapshot.safe === true);

// Controlled paper loss: 20 TCS shares at 2000 -> 1500 = -10000.
// Existing +2000 profit leaves -8000 daily P&L, beyond the -2% limit (-2000).
const lossClose = closePaperPosition(portfolio, { symbol: 'TCS:NSE', exitPrice: 1500, reason: 'STOP_LOSS' });
assert('Paper losing trade closes safely', lossClose.closed === true && lossClose.pnl === -10000);
const dailyLimit = validatePortfolioRisk(portfolio, { symbol: 'ITC:NSE', capitalUsed: 1000 });
assert('Daily loss protection blocks unsafe continuation', dailyLimit.allowed === false && dailyLimit.reason === 'DAILY_LOSS_LIMIT');

const beforeReset = portfolio.dailyRealizedPnL;
const reset = resetDailyRisk(portfolio);
assert('Daily risk reset succeeds', reset.valid === true);
assert('Daily P&L reset clears realized daily risk', portfolio.dailyRealizedPnL === 0 && beforeReset !== 0);
assert('Reset remains paper-only', reset.paperOnly === true && reset.realOrderPlaced === false);

const failed = results.filter(r => !r.passed);
console.log('\n============================================================');
console.log('STEP 2AK–2AP TEST RESULT');
console.log('============================================================');
console.table({
  Passed: results.length - failed.length,
  Failed: failed.length,
  AllAssertionsPassed: failed.length === 0,
  SuiteStatus: failed.length === 0 ? 'PASSED' : 'FAILED'
});
if (failed.length) console.table(failed);
console.log(failed.length === 0 ? '✅ STEP 2AK–2AP BULK TEST SUITE PASSED' : '❌ STEP 2AK–2AP BULK TEST SUITE FAILED');
console.log('============================================================');

const allAssertionsPassed = failed.length === 0;
export { results, allAssertionsPassed };
