/* AI TRADE PRO — RUNTIME HEALTH / INTEGRATION GATE
 * Development and paper execution only. No broker order capability is exposed here.
 */
import { assertDevelopmentSafety, getDevelopmentCompletionRegistry } from './developmentCompletionRegistry.js';

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
  const loaded = typeof window !== 'undefined';
  const safety = (() => {
    try { return assertDevelopmentSafety(); } catch { return false; }
  })();

  return Object.freeze({
    valid: loaded && safety,
    mode: registry.mode,
    executionMode: registry.executionMode,
    paperOnly: registry.executionMode === 'PAPER_ONLY',
    realOrderPlaced: registry.realOrderPlaced,
    requiredComponentCount: REQUIRED_SERVICES.length,
    registeredComponentCount: registry.components.length,
    registeredComponents: [...registry.components],
    developmentComplete: registry.releaseGate.developmentComplete,
    integrationComplete: registry.releaseGate.integrationComplete,
    finalTestingComplete: registry.releaseGate.finalComponentTestingComplete,
    productionRealTradingEnabled: registry.releaseGate.productionRealTradingEnabled,
    readyForFinalTesting: safety && registry.releaseGate.productionRealTradingEnabled === false
  });
}

if (typeof window !== 'undefined') {
  window.AITradeProRuntime = Object.freeze({ getHealth: getRuntimeHealth });
}

console.log('AI TRADE PRO — runtime health gate loaded');
