// AI TRADE PRO — PAPER TRADING APPLICATION BRIDGE
// Single browser-facing facade for the completed paper trading stack.
// Deliberately excludes broker adapters and real-order APIs.

import { createPaperTradingRuntime, assertPaperRuntimeSafe } from './paperTradingRuntimeEngine.js';
import { buildPaperTradingDashboardModel, assertDashboardModelSafe } from './paperTradingDashboardModel.js';

let runtime = null;

export function initializePaperTradingApplication(config = {}) {
  runtime = createPaperTradingRuntime(config);
  return getPaperTradingApplicationState();
}

function ensureRuntime() {
  if (!runtime) runtime = createPaperTradingRuntime();
  return runtime;
}

export function scanPaperCandidates(candidates = []) {
  return ensureRuntime().scan(candidates);
}

export function stagePaperCandidate(candidate = {}) {
  return ensureRuntime().stageCandidate(candidate);
}

export function fillPaperOrder(orderId, fillPrice) {
  return ensureRuntime().fillOrder(orderId, fillPrice);
}

export function cancelPaperOrder(orderId) {
  return ensureRuntime().cancelOrder(orderId);
}

export function markPaperSymbol(symbol, price) {
  return ensureRuntime().mark(symbol, price);
}

export function closePaperSymbol(symbol, price) {
  return ensureRuntime().close(symbol, price);
}

export function resetPaperDailyRisk() {
  return ensureRuntime().resetDailyRisk();
}

export function getPaperTradingApplicationState() {
  const active = ensureRuntime();
  const state = active.getState();
  const dashboard = buildPaperTradingDashboardModel(state);
  return {
    state,
    dashboard,
    safe: assertPaperRuntimeSafe(active) && assertDashboardModelSafe(dashboard),
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function isPaperTradingApplicationReady() {
  const result = getPaperTradingApplicationState();
  return result.safe === true && result.paperOnly === true && result.realOrderPlaced === false;
}

console.log('AI TRADE PRO — paper trading application bridge loaded');
