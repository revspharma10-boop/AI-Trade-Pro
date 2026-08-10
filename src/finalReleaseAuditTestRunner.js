/* AI TRADE PRO — FINAL RELEASE AUDIT */

export async function runFinalReleaseAudit() {
  const results = [];
  const test = (name, passed, details = '') => results.push({ name, passed: Boolean(passed), details });

  const [planModule, runtimeBridge, execution, portfolioEngine, backtest, performance, journal, controlCenter] = await Promise.all([
    import('./finalValidationPlan.js'),
    import('./paperTradingApplicationBridge.js'),
    import('./services/paperExecutionEngine.js'),
    import('./services/paperPortfolioEngine.js'),
    import('./services/paperBacktestEngine.js'),
    import('./services/paperPerformanceEngine.js'),
    import('./tradeJournalEngine.js'),
    import('./applicationControlCenter.js')
  ]);

  const plan = planModule.getFinalValidationPlan();
  test('Development gate is complete', plan.developmentComplete);
  test('Runtime integration gate is complete', plan.integrationComplete && plan.integrationValid);
  test('All 21 validation domains are registered', plan.componentCount === 21);
  test('Execution mode is PAPER_ONLY', plan.paperOnly);
  test('No real order has been placed', plan.realOrderPlaced === false);
  test('Production real trading is disabled', plan.productionRealTradingEnabled === false);

  const runtimeState = runtimeBridge.initializePaperTradingApplication({ initialCapital: 100000 });
  test('Paper application initializes safely', runtimeState?.safe === true);
  test('Paper application is paper-only', runtimeState?.paperOnly === true && runtimeState?.realOrderPlaced === false);

  const blocked = execution.authorizePaperExecution({
    symbol: 'TEST', decision: 'NO TRADE', action: 'NONE', executable: false,
    riskGatesPassed: false, entryPrice: 100, stopLoss: 95, targetPrice: 110,
    riskRewardRatio: 2, opportunityScore: 80, quantity: 10, positionValue: 1000,
    actualRiskAmount: 50, capitalAvailable: true
  });
  test('Unsafe decision is blocked', blocked.authorized === false && blocked.decision === 'NO TRADE');
  test('Blocked execution remains paper-only', blocked.paperOnly === true && blocked.realOrderPlaced === false);

  const authorized = execution.authorizePaperExecution({
    symbol: 'AUDIT', decision: 'BUY', action: 'LONG', executable: true,
    riskGatesPassed: true, entryPrice: 100, stopLoss: 95, targetPrice: 110,
    riskRewardRatio: 2, opportunityScore: 80, quantity: 10, positionValue: 1000,
    actualRiskAmount: 50, capitalAvailable: true
  });
  test('Safe decision is paper-executable', authorized.authorized === true && authorized.paperOnly === true);

  const portfolio = portfolioEngine.createPaperPortfolio({ initialCapital: 100000 });
  const opened = portfolioEngine.openPaperPosition(portfolio, {
    symbol: 'AUDIT', side: 'BUY', action: 'LONG', quantity: 10,
    entryPrice: 100, stopLoss: 95, targetPrice: 120
  });
  test('Paper position opens through production portfolio engine', opened?.created === true && opened?.realOrderPlaced === false);
  test('Portfolio remains paper-only after open', portfolio.paperOnly === true && portfolio.realOrderPlaced === false);

  const duplicate = portfolioEngine.openPaperPosition(portfolio, {
    symbol: 'AUDIT', side: 'BUY', action: 'LONG', quantity: 10,
    entryPrice: 100, stopLoss: 95, targetPrice: 120
  });
  test('Duplicate open position is blocked', duplicate?.created === false && duplicate?.reason === 'DUPLICATE_OPEN_POSITION');

  const closed = portfolioEngine.closePaperPosition(portfolio, 'AUDIT', 120, 'FINAL_AUDIT');
  test('Paper position closes through production portfolio engine', closed?.closed === true && closed?.realOrderPlaced === false);
  test('Realized P&L is positive after paper close', closed?.realizedPnL === 200);
  test('Closed portfolio has no open position', portfolio.positions.length === 0 && portfolio.closedPositions.length === 1);

  const perf = performance.calculatePaperPerformance(portfolio);
  test('Performance engine consumes closed paper trade', perf?.valid === true && perf?.totalTrades === 1 && perf?.netPnL === 200);
  test('Performance remains paper-only', perf?.paperOnly === true && perf?.realOrderPlaced === false);

  const journalInstance = journal.createJournal();
  const journalRecord = journal.recordTrade(journalInstance, {
    symbol: 'AUDIT', side: 'BUY', quantity: 10, entryPrice: 100, exitPrice: 120
  });
  test('Journal records closed paper trade', journalRecord?.valid === true && journalRecord?.record?.pnl === 200);
  test('Journal remains paper-only', journalRecord?.record?.paperOnly === true && journalRecord?.record?.realOrderPlaced === false);

  const bt = backtest.runPaperBacktest({
    initialCapital: 100000,
    trades: [{ symbol: 'AUDIT', action: 'LONG', quantity: 10, entryPrice: 100, exitPrice: 120 }]
  });
  test('Paper backtest produces expected P&L', bt?.valid === true && bt?.netPnL === 200 && bt?.finalEquity === 100200);
  test('Backtest remains paper-only', bt?.paperOnly === true && bt?.realOrderPlaced === false);

  test('Application control center is importable', typeof controlCenter === 'object');

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const report = Object.freeze({
    Passed: passed,
    Failed: failed,
    AllAssertionsPassed: failed === 0,
    SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    PaperOnly: true,
    RealOrderPlaced: false,
    ProductionRealTradingEnabled: plan.productionRealTradingEnabled,
    Results: results
  });

  console.table(report);
  console.log(`FINAL RELEASE AUDIT: ${report.SuiteStatus}`);
  return report;
}

console.log('AI TRADE PRO — final release audit runner loaded');
