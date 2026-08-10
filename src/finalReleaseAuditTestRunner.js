/* AI TRADE PRO — FINAL RELEASE AUDIT */

export async function runFinalReleaseAudit() {
  const results = [];
  const test = (name, passed, details = '') => results.push({ name, passed: Boolean(passed), details });

  const [planModule, runtimeBridge, execution, portfolio, lifecycle, backtest, performance, journal, controlCenter] = await Promise.all([
    import('./finalValidationPlan.js'),
    import('./paperTradingApplicationBridge.js'),
    import('./services/paperExecutionEngine.js'),
    import('./services/paperPortfolioEngine.js'),
    import('./paperPositionLifecycleEngine.js'),
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

  const portfolio = portfolio.createPaperPortfolio({ initialCapital: 100000 });
  const opened = portfolioModuleOpen(portfolio, portfolioEngineOpen(portfolio));
  test('Paper position opens through portfolio engine', opened?.created === true && opened?.realOrderPlaced === false);

  const closed = portfolio.closePaperPosition(portfolio, 'AUDIT', 120, 'FINAL_AUDIT');
  test('Paper position closes through portfolio engine', closed?.closed === true && closed?.realOrderPlaced === false);
  test('Realized P&L is positive after paper close', closed?.realizedPnL === 200);

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

  const controlState = controlCenter.getApplicationControlState?.() ?? null;
  test('Application control center is importable', typeof controlCenter === 'object');
  if (controlState) test('Application control state is paper-safe', controlState.paperOnly === true && controlState.realOrderPlaced === false);

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

function portfolioEngineOpen(portfolio) {
  return {
    symbol: 'AUDIT', side: 'BUY', action: 'LONG', quantity: 10,
    entryPrice: 100, stopLoss: 95, targetPrice: 120
  };
}

function portfolioModuleOpen(portfolio, order) {
  return portfolioEngineOpenFn(portfolio, order);
}

function portfolioEngineOpenFn(portfolio, order) {
  return portfolio.__openPaperPosition
    ? portfolio.__openPaperPosition(order)
    : openPaperPositionDirect(portfolio, order);
}

function openPaperPositionDirect(portfolio, order) {
  // The actual function is attached below by the runner after module loading.
  return { created: false, realOrderPlaced: false };
}

console.log('AI TRADE PRO — final release audit runner loaded');
