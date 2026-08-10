/* AI TRADE PRO — FINAL VALIDATION COORDINATOR
 * Coordinates the eventual full test pass without enabling broker execution.
 */
import { getDevelopmentCompletionRegistry, assertDevelopmentSafety } from './developmentCompletionRegistry.js';
import { getRuntimeIntegrationStatus } from './runtimeIntegrationGate.js';

const REQUIRED_TEST_DOMAINS = Object.freeze([
  'analysis-pipeline',
  'trade-decision-safety',
  'paper-execution',
  'paper-portfolio',
  'backtest',
  'strategy-definition',
  'watchlist',
  'scanner-orchestration',
  'portfolio-risk-control',
  'application-ui',
  'runtime-integration'
]);

export function getFinalValidationPlan() {
  const registry = getDevelopmentCompletionRegistry();
  const integration = getRuntimeIntegrationStatus();
  return Object.freeze({
    ready: integration.paperSafe && integration.productionRealTradingEnabled === false,
    executionMode: registry.executionMode,
    realOrderPlaced: registry.realOrderPlaced,
    developmentComplete: registry.releaseGate.developmentComplete,
    integrationComplete: registry.releaseGate.integrationComplete,
    finalTestingComplete: registry.releaseGate.finalComponentTestingComplete,
    requiredDomains: [...REQUIRED_TEST_DOMAINS],
    pendingDomains: [...REQUIRED_TEST_DOMAINS]
  });
}

export function assertFinalValidationSafety() {
  assertDevelopmentSafety();
  const plan = getFinalValidationPlan();
  if (!plan.ready || plan.realOrderPlaced || plan.executionMode !== 'PAPER_ONLY') {
    throw new Error('AI TRADE PRO final validation gate is unsafe. Real trading remains disabled.');
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.AITradeProValidation = Object.freeze({
    getPlan: getFinalValidationPlan,
    assertSafety: assertFinalValidationSafety
  });
}

console.log('AI TRADE PRO — final validation coordinator loaded');
