/* AI TRADE PRO — FINAL VALIDATION PLAN
 * Development is complete. This module defines the single final validation campaign.
 * It never enables broker execution and never places a real order.
 */

import { getDevelopmentCompletionRegistry, assertDevelopmentSafety } from './developmentCompletionRegistry.js';
import { getRuntimeIntegrationStatus, assertRuntimeIntegrationSafety } from './runtimeIntegrationGate.js';

const VALIDATION_DOMAINS = Object.freeze([
  'market-data',
  'technical-analysis',
  'fundamental-analysis',
  'market-regime',
  'liquidity',
  'technical-confirmation',
  'recommendation',
  'trade-decision',
  'position-sizing',
  'risk-control',
  'strategy-definition',
  'scanner-orchestration',
  'watchlist',
  'paper-order-queue',
  'paper-position-lifecycle',
  'paper-portfolio',
  'paper-backtest',
  'journal',
  'performance',
  'application-bridge',
  'control-center'
]);

export function getFinalValidationPlan() {
  const registry = getDevelopmentCompletionRegistry();
  const integration = getRuntimeIntegrationStatus();

  return Object.freeze({
    developmentComplete: registry.releaseGate.developmentComplete === true,
    integrationComplete: registry.releaseGate.integrationComplete === true,
    finalComponentTestingComplete: registry.releaseGate.finalComponentTestingComplete === true,
    componentCount: VALIDATION_DOMAINS.length,
    components: [...VALIDATION_DOMAINS],
    paperOnly: registry.executionMode === 'PAPER_ONLY',
    realOrderPlaced: registry.realOrderPlaced,
    productionRealTradingEnabled: registry.releaseGate.productionRealTradingEnabled,
    integrationValid: integration.valid,
    readyForFinalValidation: registry.releaseGate.developmentComplete === true &&
      registry.releaseGate.integrationComplete === true &&
      integration.valid === true &&
      registry.executionMode === 'PAPER_ONLY' &&
      registry.realOrderPlaced === false &&
      registry.releaseGate.productionRealTradingEnabled === false
  });
}

export function assertReadyForFinalValidation() {
  assertDevelopmentSafety();
  assertRuntimeIntegrationSafety();
  const plan = getFinalValidationPlan();
  if (!plan.readyForFinalValidation) {
    throw new Error('AI TRADE PRO is not ready for final validation.');
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalValidation = Object.freeze({
    getPlan: getFinalValidationPlan,
    assertReady: assertReadyForFinalValidation
  });
}

console.log('AI TRADE PRO — final validation plan loaded');
