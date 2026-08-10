// AI TRADE PRO — BULK PAPER OPERATIONS ORCHESTRATOR
// Connects observation, signals, session, performance and existing paper application state.
// No broker/live-order execution is exposed.

import { createPaperTradingSessionManager, assertPaperTradingSessionSafe } from './paperTradingSessionManager.js';
import { createPaperSignalMonitor, assertPaperSignalMonitorSafe } from './paperSignalMonitor.js';
import { buildPaperSessionPerformance, assertPaperPerformanceSafe } from './paperSessionPerformanceEngine.js';
import { initializePaperTradingApplication, getPaperTradingApplicationState, stagePaperCandidate, fillPaperOrder, closePaperSymbol, markPaperSymbol, resetPaperDailyRisk } from './paperTradingApplicationBridge.js';

export function createPaperOperationsOrchestrator(options = {}) {
  const initialCapital = Number(options.initialCapital ?? 100000);
  const sessionManager = createPaperTradingSessionManager();
  const signalMonitor = createPaperSignalMonitor({ maxHistory: options.maxSignalHistory || 250 });
  let initialized = false;

  function ensureInitialized() {
    if (!initialized) {
      initializePaperTradingApplication({ initialCapital, maxOpenPositions: 5, maxCapitalUtilizationPercent: 70, maxDailyLossPercent: 2, minCashBufferPercent: 20 });
      initialized = true;
    }
  }

  function startSession(config = {}) { ensureInitialized(); return sessionManager.start({ initialCapital: config.initialCapital ?? initialCapital, sessionId: config.sessionId }); }
  function observeSignal(signal = {}) { ensureInitialized(); const event = signalMonitor.record(signal); sessionManager.recordSignal(event); return event; }
  function stage(candidate) { ensureInitialized(); return stagePaperCandidate(candidate); }
  function fill(orderId, price) { ensureInitialized(); return fillPaperOrder(orderId, price); }
  function mark(symbol, price) { ensureInitialized(); return markPaperSymbol(symbol, price); }
  function close(symbol, price) { ensureInitialized(); return closePaperSymbol(symbol, price); }
  function recordTrade(trade) { return sessionManager.recordTrade(trade); }
  function riskEvent(event) { return sessionManager.recordRiskEvent(event); }
  function updateUnrealizedPnL(value) { return sessionManager.updateUnrealizedPnL(value); }
  function resetRisk() { ensureInitialized(); return resetPaperDailyRisk(); }
  function performance() { return buildPaperSessionPerformance(sessionManager.snapshot()); }
  function snapshot() {
    ensureInitialized();
    const session = sessionManager.snapshot();
    const signals = signalMonitor.snapshot();
    const app = getPaperTradingApplicationState();
    const report = buildPaperSessionPerformance(session);
    return { mode: 'PAPER_ONLY', application: app, session, signals, performance: report, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, safe: assertPaperTradingSessionSafe(session) && assertPaperSignalMonitorSafe(signals) && assertPaperPerformanceSafe(report) };
  }
  function closeSession() { const closed = sessionManager.close(); return { ...snapshot(), session: closed, performance: buildPaperSessionPerformance(closed) }; }

  return Object.freeze({ startSession, observeSignal, stage, fill, mark, close, recordTrade, riskEvent, updateUnrealizedPnL, resetRisk, performance, snapshot, closeSession });
}

export function assertPaperOperationsSafe(snapshot) {
  return Boolean(snapshot && snapshot.mode === 'PAPER_ONLY' && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false && snapshot.safe === true);
}

console.log('AI TRADE PRO — bulk paper operations orchestrator loaded');
