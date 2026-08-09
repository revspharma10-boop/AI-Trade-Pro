// AI TRADE PRO — STEP 2CY–2DH
// Paper position lifecycle: fill, close, P&L, and strict paper safety.

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function createPaperPosition(order = {}) {
  const symbol = String(order.symbol || '').trim().toUpperCase();
  const side = String(order.side || '').toUpperCase();
  const quantity = num(order.quantity);
  const entryPrice = num(order.fillPrice ?? order.price);
  const valid = Boolean(symbol) && ['LONG', 'SHORT'].includes(side) && quantity > 0 && entryPrice > 0;
  return {
    valid,
    symbol,
    side,
    quantity,
    entryPrice,
    status: valid ? 'OPEN' : 'REJECTED',
    paperOnly: true,
    realOrderPlaced: false,
    realizedPnL: 0
  };
}

export function calculatePaperPnL(position = {}, exitPrice) {
  const qty = num(position.quantity);
  const entry = num(position.entryPrice);
  const exit = num(exitPrice);
  if (!['LONG', 'SHORT'].includes(position.side) || qty <= 0 || entry <= 0 || exit <= 0) return 0;
  return position.side === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
}

export function closePaperPosition(position = {}, exitPrice) {
  if (position.status !== 'OPEN') {
    return { ...position, valid: false, status: position.status || 'REJECTED', paperOnly: true, realOrderPlaced: false };
  }
  const pnl = calculatePaperPnL(position, exitPrice);
  const closed = {
    ...position,
    status: 'CLOSED',
    exitPrice: num(exitPrice),
    realizedPnL: pnl,
    closedAt: Date.now(),
    paperOnly: true,
    realOrderPlaced: false
  };
  return { ...closed, valid: closed.exitPrice > 0 };
}

export function markPaperPosition(position = {}, markPrice) {
  const unrealizedPnL = position.status === 'OPEN' ? calculatePaperPnL(position, markPrice) : 0;
  return { ...position, markPrice: num(markPrice), unrealizedPnL, paperOnly: true, realOrderPlaced: false };
}

export function buildPaperLifecycleSnapshot(positions = [], cash = 0) {
  const safePositions = Array.isArray(positions) ? positions : [];
  const openPositions = safePositions.filter(p => p.status === 'OPEN');
  const closedPositions = safePositions.filter(p => p.status === 'CLOSED');
  const realizedPnL = closedPositions.reduce((s, p) => s + num(p.realizedPnL), 0);
  const unrealizedPnL = openPositions.reduce((s, p) => s + num(p.unrealizedPnL), 0);
  return {
    valid: num(cash) >= 0 && safePositions.every(p => p.paperOnly === true && p.realOrderPlaced === false),
    cash: num(cash),
    openPositions: openPositions.length,
    closedPositions: closedPositions.length,
    realizedPnL,
    unrealizedPnL,
    equity: num(cash) + realizedPnL + unrealizedPnL,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function assertPaperLifecycleSafe(value = {}) {
  return value.paperOnly === true && value.realOrderPlaced === false;
}
