/* AI TRADE PRO — RUNTIME INTEGRATION GATE
 * Development-first: validates wiring/readiness without enabling real trading.
 */
import { getDevelopmentCompletionRegistry, assertDevelopmentSafety } from './developmentCompletionRegistry.js';

const REQUIRED_COMPONENTS = [
  'market-data','technical-analysis','fundamental-analysis','market-regime',
  'liquidity','technical-confirmation','recommendation','trade-decision',
  'position-sizing','risk-control','strategy-definition','scanner-orchestration',
  'watchlist','paper-order-queue','paper-position-lifecycle','paper-portfolio',
  'paper-backtest','journal','performance','application-bridge','control-center'
];

export function getRuntimeIntegrationStatus() {
  const registry = getDevelopmentCompletionRegistry();
  const loaded = Array.isArray(registry.components) ? registry.components : [];
  const missingComponents = REQUIRED_COMPONENTS.filter((name) => !loaded.includes(name));
  const paperSafe = assertDevelopmentSafety();

  return Object.freeze({
    valid: missingComponents.length === 0,
    componentCount: REQUIRED_COMPONENTS.length,
    loadedComponentCount: REQUIRED_COMPONENTS.filter((name) => loaded.includes(name)).length,
    missingComponents,
    paperOnly: registry.executionMode === 'PAPER_ONLY',
    realOrderPlaced: registry.realOrderPlaced === false ? false : registry.realOrderPlaced,
    productionRealTradingEnabled: registry.releaseGate.productionRealTradingEnabled === true,
    paperSafe,
    developmentComplete: registry.releaseGate.developmentComplete === true,
    integrationComplete: registry.releaseGate.integrationComplete === true,
    finalTestingRequired: registry.finalTestingRequired === true
  });
}

export function assertRuntimeIntegrationSafety() {
  const status = getRuntimeIntegrationStatus();
  if (!status.valid || !status.paperOnly || status.realOrderPlaced || status.productionRealTradingEnabled) {
    throw new Error('AI TRADE PRO runtime integration gate failed. Real trading remains disabled.');
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.AITradeProRuntime = Object.freeze({
    getStatus: getRuntimeIntegrationStatus,
    assertSafety: assertRuntimeIntegrationSafety
  });
}

console.log('AI TRADE PRO — runtime integration gate loaded');
