// Development-phase smoke runner; comprehensive validation remains deferred until all phases are complete.
import { buildPaperReliabilitySnapshot, assertPaperReliabilitySafe } from './paperMonitoringReliabilityEngine.js';

export function runPhase3Smoke() {
  const snapshot = buildPaperReliabilitySnapshot({
    marketData: { connected: true, symbols: [{ symbol: 'RELIANCE', price: 2500, timestamp: new Date().toISOString() }] },
    signals: { paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, history: [] },
    execution: { paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, orders: [] },
    portfolio: { capital: 100000, equity: 100000, capitalUsed: 0 },
    risk: { safe: true, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false },
    session: { status: 'OPEN', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false },
    errors: []
  });
  console.log('PHASE 3 DEVELOPMENT SMOKE:', assertPaperReliabilitySafe(snapshot) ? 'SAFE' : 'FAILED');
  return snapshot;
}

if (typeof window !== 'undefined') window.runPhase3Smoke = runPhase3Smoke;
