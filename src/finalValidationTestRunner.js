/* AI TRADE PRO — FINAL VALIDATION TEST RUNNER
 * Consolidated release-gate assertions. PAPER_ONLY by design.
 */
import { getFinalValidationPlan, assertReadyForFinalValidation } from './finalValidationPlan.js';

const REQUIRED_COUNT = 21;

function check(name, condition) {
  return { name, passed: condition === true };
}

export function runFinalValidationTests() {
  const plan = getFinalValidationPlan();
  const results = [
    check('Development is complete', plan.developmentComplete),
    check('Integration is complete', plan.integrationComplete),
    check('All 21 validation domains are registered', plan.componentCount === REQUIRED_COUNT),
    check('Validation domains are unique', new Set(plan.components).size === REQUIRED_COUNT),
    check('Execution mode is PAPER_ONLY', plan.paperOnly),
    check('No real order has been placed', plan.realOrderPlaced === false),
    check('Production real trading is disabled', plan.productionRealTradingEnabled === false),
    check('Runtime integration is valid', plan.integrationValid),
    check('Final validation gate is ready', plan.readyForFinalValidation)
  ];

  let safetyAssertionPassed = false;
  try {
    assertReadyForFinalValidation();
    safetyAssertionPassed = true;
  } catch (_) {
    safetyAssertionPassed = false;
  }
  results.push(check('Final validation safety assertion passes', safetyAssertionPassed));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const allAssertionsPassed = failed === 0;

  const summary = Object.freeze({
    Passed: passed,
    Failed: failed,
    AllAssertionsPassed: allAssertionsPassed,
    SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED',
    ComponentDomains: plan.componentCount,
    PaperOnly: plan.paperOnly,
    RealOrderPlaced: plan.realOrderPlaced,
    ProductionRealTradingEnabled: plan.productionRealTradingEnabled
  });

  console.log('============================================================');
  console.log('AI TRADE PRO — FINAL VALIDATION TEST RUNNER');
  console.log('============================================================');
  results.forEach((r) => console.log(`${r.passed ? '✅' : '❌'} ${r.name}`));
  console.table(summary);
  console.log(`FINAL VALIDATION: ${summary.SuiteStatus}`);

  return Object.freeze({ results, summary });
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalValidationTests = Object.freeze({ run: runFinalValidationTests });
}

console.log('AI TRADE PRO — final validation test runner loaded');
