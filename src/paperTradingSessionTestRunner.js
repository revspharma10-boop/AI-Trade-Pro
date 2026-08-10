import { createPaperTradingSessionManager, assertPaperTradingSessionSafe } from './paperTradingSessionManager.js';

export function runPaperTradingSessionTests() {
  const results = [];
  const test = (name, condition) => results.push({ name, passed: Boolean(condition) });
  const manager = createPaperTradingSessionManager();
  const started = manager.start({ initialCapital: 100000 });

  test('Session starts', started.status === 'OPEN');
  test('Initial capital is preserved', started.initialCapital === 100000);
  test('Session is paper-only', started.paperOnly === true);
  test('No real order is placed', started.realOrderPlaced === false);
  test('Production real trading is disabled', started.productionRealTradingEnabled === false);

  manager.recordSignal({ action: 'BUY', symbol: 'RELIANCE' });
  manager.recordSignal({ action: 'NO_TRADE', symbol: 'TCS' });
  test('Signals are counted', manager.snapshot().signalCount === 2);

  manager.recordTrade({ symbol: 'RELIANCE', side: 'BUY', quantity: 10, realizedPnL: 1200 });
  test('Paper trade is recorded', manager.snapshot().trades.length === 1);
  test('Realized P&L is updated', manager.snapshot().realizedPnL === 1200);
  test('Ending capital is updated', manager.snapshot().endingCapital === 101200);

  manager.updateUnrealizedPnL(300);
  test('Unrealized P&L is tracked', manager.snapshot().unrealizedPnL === 300);
  test('Peak equity is tracked', manager.snapshot().peakEquity === 101500);

  manager.recordRiskEvent({ type: 'DAILY_RISK_CHECK', status: 'SAFE' });
  test('Risk events are recorded', manager.snapshot().riskEvents.length === 1);

  const closed = manager.close();
  test('Session closes', closed.status === 'CLOSED' && Boolean(closed.endedAt));
  test('Closed session retains trade history', closed.trades.length === 1);
  test('Closed session retains P&L', closed.realizedPnL === 1200);
  test('Closed session remains paper-only', assertPaperTradingSessionSafe(closed));

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results };
  console.table(summary);
  console.log(`PAPER TRADING SESSION VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperTradingSessionTests = runPaperTradingSessionTests;
