/* AI TRADE PRO — FINAL 21-COMPONENT VALIDATION CAMPAIGN */
import { getFinalValidationPlan, assertReadyForFinalValidation } from './finalValidationPlan.js';

// IMPORTANT: production engines are split between src/ and src/services/.
// The previous validator probed several stale root-level paths, producing 404s
// even though the application itself loaded those engines successfully.
const MODULE_PROBES = Object.freeze({
  'market-data': './services/marketData.js',
  'technical-analysis': './services/technicalAnalysis.js',
  'fundamental-analysis': './services/fundamentalAnalysis.js',
  'market-regime': './services/marketRegimeEngine.js',
  'liquidity': './services/liquidityEngine.js',
  'technical-confirmation': './services/technicalConfirmationEngine.js',
  'recommendation': './services/recommendationEngine.js',
  'trade-decision': './services/tradeDecisionEngine.js',
  'position-sizing': './services/positionSizingEngine.js',
  'risk-control': './riskControlEngine.js',
  'strategy-definition': './services/strategyDefinitionEngine.js',
  'scanner-orchestration': './scannerOrchestrationEngine.js',
  'watchlist': './watchlistEngine.js',
  'paper-order-queue': './services/paperExecutionEngine.js',
  'paper-position-lifecycle': './services/paperPositionLifecycleEngine.js',
  'paper-portfolio': './services/paperPortfolioEngine.js',
  'paper-backtest': './services/paperBacktestEngine.js',
  'journal': './tradeJournalEngine.js',
  'performance': './services/paperPerformanceEngine.js',
  'application-bridge': './applicationBridgeUI.js',
  'control-center': './applicationControlCenter.js'
});

async function probeModule(path) {
  const module = await import(`${path}?validation=${Date.now()}-${Math.random()}`);
  return Boolean(module && typeof module === 'object');
}

export async function runFinalComponentValidation() {
  assertReadyForFinalValidation();
  const plan = getFinalValidationPlan();
  const results = [];

  for (const domain of plan.components) {
    const path = MODULE_PROBES[domain];
    if (!path) {
      results.push({ domain, passed: false, details: 'No module probe registered.' });
      continue;
    }
    try {
      const loaded = await probeModule(path);
      results.push({ domain, passed: loaded, details: loaded ? `Module loaded: ${path}` : 'Module returned no namespace.' });
    } catch (error) {
      results.push({ domain, passed: false, details: error?.message || String(error) });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const report = Object.freeze({
    Passed: passed,
    Failed: failed,
    AllAssertionsPassed: failed === 0,
    SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    ComponentDomains: results.length,
    PaperOnly: plan.paperOnly,
    RealOrderPlaced: plan.realOrderPlaced,
    ProductionRealTradingEnabled: plan.productionRealTradingEnabled,
    Results: results
  });

  console.table(report);
  return report;
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalComponentValidation = Object.freeze({ run: runFinalComponentValidation });
}

console.log('AI TRADE PRO — final 21-component validation runner loaded');
