/* AI TRADE PRO — FINAL FUNCTIONAL VALIDATION CAMPAIGN
 * Consolidates the 21 release domains into one deterministic safety-first gate.
 * This module does not place broker orders and never enables live execution.
 */
import { getFinalValidationPlan, assertReadyForFinalValidation } from './finalValidationPlan.js';

const REQUIRED_DOMAINS = Object.freeze([
  'market-data','technical-analysis','fundamental-analysis','market-regime','liquidity',
  'technical-confirmation','recommendation','trade-decision','position-sizing','risk-control',
  'strategy-definition','scanner-orchestration','watchlist','paper-order-queue',
  'paper-position-lifecycle','paper-portfolio','paper-backtest','journal','performance',
  'application-bridge','control-center'
]);

const test = (name, condition, details = '') => ({ name, passed: Boolean(condition), details });

export function runFinalFunctionalValidation() {
  const plan = getFinalValidationPlan();
  const results = [
    test('Development gate is complete', plan.developmentComplete),
    test('Integration gate is complete', plan.integrationComplete),
    test('All 21 domains are registered', plan.componentCount === 21),
    test('All validation domains are unique', new Set(plan.components).size === 21),
    test('All required domains are present', REQUIRED_DOMAINS.every(d => plan.components.includes(d))),
    test('Execution mode is PAPER_ONLY', plan.paperOnly),
    test('No real order has been placed', plan.realOrderPlaced === false),
    test('Production real trading is disabled', plan.productionRealTradingEnabled === false),
    test('Runtime integration is valid', plan.integrationValid === true),
    test('Final validation gate is ready', plan.readyForFinalValidation === true),
    test('Functional validation remains paper-only', plan.paperOnly && plan.realOrderPlaced === false),
  ];

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const report = Object.freeze({
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    componentDomains: plan.componentCount,
    paperOnly: plan.paperOnly,
    realOrderPlaced: plan.realOrderPlaced,
    productionRealTradingEnabled: plan.productionRealTradingEnabled,
    results
  });

  if (!report.allAssertionsPassed) {
    throw new Error('AI TRADE PRO final functional validation failed.');
  }
  return report;
}

export function assertFinalFunctionalValidationSafety() {
  assertReadyForFinalValidation();
  return true;
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalFunctionalValidation = Object.freeze({
    run: runFinalFunctionalValidation,
    assertSafety: assertFinalFunctionalValidationSafety
  });
}

console.log('AI TRADE PRO — final functional validation runner loaded');
