// AI TRADE PRO — APPLICATION CONTROL CENTER
// Development-first orchestration facade. Paper-only by design.

import {
  initializePaperTradingApplication,
  getPaperTradingApplicationState,
  scanPaperCandidates,
  stagePaperCandidate,
  fillPaperOrder,
  cancelPaperOrder,
  markPaperSymbol,
  closePaperSymbol,
  resetPaperDailyRisk,
  isPaperTradingApplicationReady
} from './paperTradingApplicationBridge.js';

import {
  createWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistSignal,
  getWatchlistSnapshot
} from './watchlistEngine.js';

let watchlist = createWatchlist({ name: 'AI Trade Pro' });

export function initializeApplicationControlCenter(config = {}) {
  initializePaperTradingApplication(config);
  return getApplicationControlCenterState();
}

export function getApplicationControlCenterState() {
  const trading = getPaperTradingApplicationState();
  return {
    valid: trading.safe === true,
    paperOnly: true,
    realOrderPlaced: false,
    ready: isPaperTradingApplicationReady(),
    trading,
    watchlist: getWatchlistSnapshot(watchlist)
  };
}

export function addWatchlistSymbol(symbol, metadata = {}) {
  return addToWatchlist(watchlist, symbol, metadata);
}

export function removeWatchlistSymbol(symbol) {
  return removeFromWatchlist(watchlist, symbol);
}

export function updateWatchlistSymbol(symbol, signal = {}) {
  return updateWatchlistSignal(watchlist, symbol, signal);
}

export function runScannerCycle(candidates = []) {
  const state = getPaperTradingApplicationState();
  return scanPaperCandidates(candidates, state.state.portfolio || state.state);
}

export function stageCandidate(candidate = {}) {
  return stagePaperCandidate(candidate);
}

export function fillOrder(orderId, fillPrice) {
  return fillPaperOrder(orderId, fillPrice);
}

export function cancelOrder(orderId) {
  return cancelPaperOrder(orderId);
}

export function markPrice(symbol, price) {
  return markPaperSymbol(symbol, price);
}

export function closePosition(symbol, price) {
  return closePaperSymbol(symbol, price);
}

export function resetDailyRisk() {
  return resetPaperDailyRisk();
}

export function assertApplicationSafety() {
  const state = getApplicationControlCenterState();
  return state.valid === true && state.paperOnly === true && state.realOrderPlaced === false && state.trading.realOrderPlaced === false;
}

console.log('AI TRADE PRO — application control center loaded');
