// AI TRADE PRO — PHASE 4 BULK DEVELOPMENT SUPPORT
import { createStrategyScannerManager, assertStrategyScannerSafe } from './strategyScannerManagementEngine.js';

export function createDefaultPaperStrategyScanner() {
  const manager = createStrategyScannerManager({ maxStrategies: 50 });
  manager.defineStrategy({ id: 'AI_PRIMARY', name: 'AI Primary', maxPositions: 3, maxCapitalUtilization: 70, cooldownMs: 15 * 60 * 1000 });
  manager.defineStrategy({ id: 'AI_CONFIRMATION', name: 'AI Confirmation', maxPositions: 2, maxCapitalUtilization: 50, cooldownMs: 10 * 60 * 1000 });
  return manager;
}

export function runPhase4DevelopmentSmoke() {
  const manager = createDefaultPaperStrategyScanner();
  const result = manager.rankCandidates([
    { strategyId: 'AI_PRIMARY', symbol: 'RELIANCE', action: 'BUY', score: 92, riskPassed: true },
    { strategyId: 'AI_PRIMARY', symbol: 'TCS', action: 'BUY', score: 86, riskPassed: true },
    { strategyId: 'AI_PRIMARY', symbol: 'INFY', action: 'BUY', score: 80, riskPassed: false }
  ], { capitalUtilizationPercent: 10, openSymbols: [] });
  return { safe: assertStrategyScannerSafe(result), result, manager: manager.snapshot() };
}

if (typeof window !== 'undefined') window.runPhase4DevelopmentSmoke = runPhase4DevelopmentSmoke;
