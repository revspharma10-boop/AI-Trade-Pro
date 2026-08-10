/* AI TRADE PRO — RUNTIME HEALTH / INTEGRATION GATE
 * Development and paper execution only. No broker order capability is exposed here.
 */
import { assertDevelopmentSafety, getDevelopmentCompletionRegistry } from './developmentCompletionRegistry.js';
import { getRuntimeIntegrationStatus, assertRuntimeIntegrationSafety } from './runtimeIntegrationGate.js';

const REQUIRED_SERVICES = [
  'market-data', 'technical-analysis', 'fundamental-analysis',
  'market-regime', 'liquidity', 'technical-confirmation',
  'recommendation', 'trade-decision', 'position-sizing', 'risk-control',
  'strategy-definition', 'scanner-orchestration', 'watchlist',
  'paper-order-queue', 'paper-position-lifecycle', 'paper-portfolio',
  'paper-backtest', 'journal', 'performance', 'application-bridge',
  'control-center'
];

export function getRuntimeHealth() {
  const registry = getDevelopmentCompletionRegistry();
  const safety = (() => {
    try { return assertDevelopmentSafety(); } catch { return false; }
  })();
  const integration = (() => {
    try { return getRuntimeIntegrationStatus(); } catch { return null; }
  })();

  return Object.freeze({
    valid: safety && Boolean(integration?.valid),
    mode: registry.mode,
    executionMode: registry.executionMode,
    paperOnly: registry.executionMode === 'PAPER_ONLY',
    realOrderPlaced: registry.realOrderPlaced,
    requiredComponentCount: REQUIRED_SERVICES.length,
    registeredComponentCount: registry.components.length,
    registeredComponents: [...registry.components],
    missingComponents: integration?.missingComponents ?? REQUIRED_SERVICES,
    developmentComplete: registry.releaseGate.developmentComplete,
    integrationComplete: registry.releaseGate.integrationComplete,
    finalTestingComplete: registry.releaseGate.finalComponentTestingComplete,
    productionRealTradingEnabled: registry.releaseGate.productionRealTradingEnabled,
    readyForFinalTesting: safety && Boolean(integration?.valid) && registry.releaseGate.productionRealTradingEnabled === false
  });
}

export function assertRuntimeHealthSafety() {
  if (!getRuntimeHealth().valid) {
    throw new Error('AI TRADE PRO runtime health check failed. Real trading remains disabled.');
  }
  assertRuntimeIntegrationSafety();
  return true;
}

if (typeof window !== 'undefined') {
  window.AITradeProRuntime = Object.freeze({
    getHealth: getRuntimeHealth,
    getStatus: getRuntimeIntegrationStatus,
    assertSafety: assertRuntimeHealthSafety
  });
}

console.log('AI TRADE PRO — runtime health gate loaded');
