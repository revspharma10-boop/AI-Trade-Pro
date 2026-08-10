/* AI TRADE PRO — FINAL 21-COMPONENT VALIDATION CAMPAIGN */
import { getFinalValidationPlan, assertReadyForFinalValidation } from './finalValidationPlan.js';

const MODULE_PROBES = Object.freeze({
  'market-data': './marketData.js',
  'technical-analysis': './technicalAnalysis.js',
  'fundamental-analysis': './fundamentalAnalysis.js',
  'market-regime': './marketRegimeEngine.js',
  'liquidity': './liquidityEngine.js',
  'technical-confirmation': './technicalConfirmationEngine.js',
  'recommendation': './recommendationEngine.js',
  'trade-decision': './tradeDecisionEngine.js',
  'position-sizing': './positionSizingEngine.js',
  'risk-control': './riskControlEngine.js',
  'strategy-definition': './strategyDefinitionEngine.js',
  'scanner-orchestration': './multiSymbolScannerEngine.js',
  'watchlist': './watchlistEngine.js',
  'paper-order-queue': './paperExecutionEngine.js',
  'paper-position-lifecycle': './paperPortfolioEngine.js',
  'paper-portfolio': './paperPortfolioEngine.js',
  'paper-backtest': './paperBacktestEngine.js',
  'journal': './tradeJournalEngine.js',
  'performance': './performanceEngine.js',
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
      results.push({ domain, passed: loaded, details: loaded ? 'Module loaded.' : 'Module returned no namespace.' });
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
