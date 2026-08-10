import { buildPaperSessionPerformance, assertPaperPerformanceSafe } from './paperSessionPerformanceEngine.js';

export function runPaperSessionPerformanceTests() {
  const results = [];
  const test = (name, condition) => results.push({ name, passed: Boolean(condition) });
  const report = buildPaperSessionPerformance({
    sessionId: 'TEST-SESSION', status: 'CLOSED', initialCapital: 100000,
    realizedPnL: 1500, unrealizedPnL: 200, maxDrawdown: 500, signalCount: 6,
    riskEvents: [{ type: 'CHECK' }],
    trades: [{ realizedPnL: 1000 }, { realizedPnL: 750 }, { realizedPnL: -250 }]
  });

  test('Trade count is calculated', report.tradeCount === 3);
  test('Winners are counted', report.winners === 2);
  test('Losers are counted', report.losers === 1);
  test('Win rate is calculated', report.winRate === (2 / 3) * 100);
  test('Gross profit is calculated', report.grossProfit === 1750);
  test('Gross loss is calculated', report.grossLoss === 250);
  test('Realized P&L is preserved', report.realizedPnL === 1500);
  test('Return percent is calculated', report.returnPercent === 1.5);
  test('Profit factor is calculated', report.profitFactor === 7);
  test('Expectancy is calculated', report.expectancy === 500);
  test('Max drawdown is preserved', report.maxDrawdown === 500);
  test('Signal count is preserved', report.signalCount === 6);
  test('Risk event count is calculated', report.riskEventCount === 1);
  test('Performance report is paper-only', report.paperOnly === true);
  test('No real order is reported', report.realOrderPlaced === false);
  test('Production real trading remains disabled', report.productionRealTradingEnabled === false);
  test('Performance safety assertion passes', assertPaperPerformanceSafe(report));

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results };
  console.table(summary);
  console.log(`PAPER SESSION PERFORMANCE VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperSessionPerformanceTests = runPaperSessionPerformanceTests;
