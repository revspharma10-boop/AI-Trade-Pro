import { createPaperSignalMonitor, assertPaperSignalMonitorSafe } from './paperSignalMonitor.js';

export function runPaperSignalMonitorTests() {
  const results = [];
  const test = (name, condition) => results.push({ name, passed: Boolean(condition) });
  const monitor = createPaperSignalMonitor({ maxHistory: 3 });

  const buy = monitor.record({ symbol: 'RELIANCE', action: 'BUY', price: 2500, score: 88, executable: true });
  const sell = monitor.record({ symbol: 'TCS', action: 'SELL', price: 3500, score: 82, executable: true });
  const noTrade = monitor.record({ symbol: 'INFY', action: 'NO_TRADE', price: 1600, reason: 'RISK_BLOCKED' });
  const snapshot = monitor.snapshot();

  test('BUY signal is recorded', buy.action === 'BUY');
  test('SELL signal is recorded', sell.action === 'SELL');
  test('NO-TRADE signal is recorded', noTrade.action === 'NO_TRADE');
  test('History count is correct', snapshot.count === 3);
  test('Executable signal count is correct', snapshot.executableCount === 2);
  test('BUY count is correct', snapshot.buyCount === 1);
  test('SELL count is correct', snapshot.sellCount === 1);
  test('NO-TRADE count is correct', snapshot.noTradeCount === 1);
  test('Signal history is retained', snapshot.history.length === 3);
  test('Monitor remains paper-only', snapshot.paperOnly === true && snapshot.mode === 'PAPER_ONLY');
  test('No real order is placed', snapshot.realOrderPlaced === false);
  test('Production real trading remains disabled', snapshot.productionRealTradingEnabled === false);
  test('All history records are paper-only', snapshot.history.every(x => x.paperOnly === true && x.realOrderPlaced === false));
  test('Safety assertion passes', assertPaperSignalMonitorSafe(snapshot));

  monitor.record({ symbol: 'AAPL', action: 'BUY', price: 100, executable: true });
  const bounded = monitor.snapshot();
  test('History is bounded', bounded.count === 3 && bounded.history[0].symbol === 'TCS');

  const passed = results.filter(x => x.passed).length;
  const failed = results.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results };
  console.table(summary);
  console.log(`PAPER SIGNAL MONITOR VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperSignalMonitorTests = runPaperSignalMonitorTests;
