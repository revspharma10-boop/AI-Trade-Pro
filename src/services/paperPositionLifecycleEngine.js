// ============================================================
// AI TRADE PRO — PAPER POSITION LIFECYCLE ENGINE
// Final validation domain: paper position open/close lifecycle.
// This module is strictly paper-only and never submits broker orders.
// ============================================================

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function openPaperPosition(position = {}) {
  const quantity = finite(position.quantity);
  const entryPrice = finite(position.entryPrice);
  const symbol = typeof position.symbol === 'string' ? position.symbol.trim().toUpperCase() : '';
  const valid = Boolean(symbol) && quantity > 0 && entryPrice > 0;
  return {
    valid,
    paperOnly: true,
    realOrderPlaced: false,
    position: valid ? { ...position, symbol, quantity, entryPrice, status: 'OPEN' } : null,
    rejectionReasons: valid ? [] : ['INVALID_POSITION']
  };
}

export function closePaperPosition(position = {}, exitPrice) {
  const entryPrice = finite(position.entryPrice);
  const quantity = finite(position.quantity);
  const closePrice = finite(exitPrice);
  const valid = Boolean(position.symbol) && entryPrice > 0 && quantity > 0 && closePrice > 0;
  const realizedPnL = valid ? (closePrice - entryPrice) * quantity : 0;
  return {
    valid,
    paperOnly: true,
    realOrderPlaced: false,
    realizedPnL,
    position: valid ? { ...position, exitPrice: closePrice, realizedPnL, status: 'CLOSED' } : null,
    rejectionReasons: valid ? [] : ['INVALID_CLOSE']
  };
}

export function getPaperPositionLifecycleSnapshot(positions = []) {
  const list = Array.isArray(positions) ? positions : [];
  return Object.freeze({
    valid: true,
    openPositions: list.filter(p => p?.status === 'OPEN').length,
    closedPositions: list.filter(p => p?.status === 'CLOSED').length,
    paperOnly: true,
    realOrderPlaced: false
  });
}

console.log('AI TRADE PRO — paper position lifecycle engine loaded');
