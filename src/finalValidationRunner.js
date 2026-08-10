/* AI TRADE PRO — FINAL VALIDATION RUNNER
 * Runs the consolidated release gate for all 21 validation domains.
 * PAPER ONLY: this runner never enables broker execution or places real orders.
 */
import { assertReadyForFinalValidation, getFinalValidationPlan } from './finalValidationPlan.js';

const RUNNER_VERSION = '1.0.0';

export function runFinalValidationGate() {
  const plan = getFinalValidationPlan();
  assertReadyForFinalValidation();

  const result = Object.freeze({
    valid: true,
    runnerVersion: RUNNER_VERSION,
    developmentComplete: plan.developmentComplete,
    integrationComplete: plan.integrationComplete,
    componentCount: plan.componentCount,
    components: [...plan.components],
    paperOnly: plan.paperOnly,
    realOrderPlaced: plan.realOrderPlaced,
    productionRealTradingEnabled: plan.productionRealTradingEnabled,
    readyForFinalValidation: plan.readyForFinalValidation,
    finalComponentTestingComplete: plan.finalComponentTestingComplete
  });

  return result;
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalValidationRunner = Object.freeze({
    run: runFinalValidationGate
  });
}

console.log('AI TRADE PRO — final validation runner loaded');
