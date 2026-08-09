// AI TRADE PRO — PAPER TRADING RUNTIME
// Integrated paper-only runtime connecting scanner -> risk -> orders -> positions -> P&L.
// This module deliberately contains no broker/exchange execution capability.

import { buildScannerCycle } from './scannerOrchestrationEngine.js';
import { canStagePaperOrder, evaluateRiskControls, resetDailyRisk } from './riskControlEngine.js';
import { createPaperOrder, fillPaperOrder, transitionPaperOrder } from './paperOrderQueueEngine.js';
import {
  createPaperPosition,
  markPaperPosition,
  closePaperPosition,
  buildPaperLifecycleSnapshot
} from './paperPositionLifecycleEngine.js';

const DEFAULT_CONFIG = Object.freeze({
  initialCapital: 100000,
  maxExposurePercent: 70,
  maxDailyLossPercent: 2,
  maxOpenPositions: 5,
  minCashPercent: 10,
  maxCandidates: 5,
  minimumScore: 65,
  minimumRiskReward: 1.5
});

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSide(recommendation) {
  const value = String(recommendation || '').toUpperCase();
  return value === 'BUY' ? 'LONG' : value === 'SELL' ? 'SHORT' : '';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createPaperTradingRuntime(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const capital = num(cfg.initialCapital);
  if (!(capital > 0)) throw new Error('initialCapital must be greater than zero');

  let state = {
    initialCapital: capital,
    cash: capital,
    positions: [],
    orders: [],
    journal: [],
    dailyRealizedPnL: 0,
    lastScannerCycle: null,
    paperOnly: true,
    realOrderPlaced: false,
    createdAt: Date.now()
  };

  function snapshot() {
    const open = state.positions.filter(p => p.status === 'OPEN');
    const grossExposure = open.reduce((sum, p) => sum + num(p.quantity) * num(p.markPrice ?? p.entryPrice), 0);
    const lifecycle = buildPaperLifecycleSnapshot(state.positions, state.cash);
    const risk = evaluateRiskControls({
      accountCapital: state.initialCapital,
      cash: state.cash,
      grossExposure,
      dailyRealizedPnL: state.dailyRealizedPnL,
      openPositions: open.length
    }, cfg);

    return {
      valid: true,
      initialCapital: state.initialCapital,
      cash: Number(state.cash.toFixed(2)),
      equity: Number((state.cash + lifecycle.unrealizedPnL).toFixed(2)),
      realizedPnL: Number(lifecycle.realizedPnL.toFixed(2)),
      unrealizedPnL: Number(lifecycle.unrealizedPnL.toFixed(2)),
      dailyRealizedPnL: Number(state.dailyRealizedPnL.toFixed(2)),
      openPositions: open.length,
      closedPositions: state.positions.filter(p => p.status === 'CLOSED').length,
      stagedOrders: state.orders.filter(o => o.status === 'PAPER_QUEUED').length,
      filledOrders: state.orders.filter(o => o.status === 'PAPER_FILLED').length,
      cancelledOrders: state.orders.filter(o => o.status === 'PAPER_CANCELLED').length,
      journalTrades: state.journal.length,
      grossExposure: Number(grossExposure.toFixed(2)),
      capitalUtilizationPercent: Number((state.initialCapital > 0 ? grossExposure / state.initialCapital * 100 : 0).toFixed(2)),
      risk,
      paperOnly: true,
      realOrderPlaced: false
    };
  }

  function scan(candidates = []) {
    const current = snapshot();
    const cycle = buildScannerCycle(candidates, {
      positions: state.positions.filter(p => p.status === 'OPEN'),
      capitalUtilizationPercent: current.capitalUtilizationPercent
    }, cfg);
    state.lastScannerCycle = clone(cycle);
    return clone(cycle);
  }

  function stageCandidate(candidate = {}) {
    const current = snapshot();
    const side = normalizeSide(candidate.recommendation);
    const quantity = num(candidate.quantity || candidate.positionSize || 0);
    const price = num(candidate.price || candidate.entryPrice || 0);
    const orderValue = quantity * price;
    const risk = canStagePaperOrder({
      accountCapital: state.initialCapital,
      cash: state.cash,
      grossExposure: current.grossExposure + orderValue,
      dailyRealizedPnL: state.dailyRealizedPnL,
      openPositions: current.openPositions + 1
    }, cfg);

    if (!side) return { valid: false, executable: false, rejectionReasons: ['INVALID_RECOMMENDATION'], paperOnly: true, realOrderPlaced: false };
    if (!risk.stageAllowed) return { valid: false, executable: false, rejectionReasons: risk.rejectionReasons, risk, paperOnly: true, realOrderPlaced: false };

    const order = createPaperOrder({
      ...candidate,
      symbol: candidate.symbol,
      side: candidate.recommendation,
      quantity,
      price
    });
    if (order.status === 'PAPER_QUEUED') state.orders.push(order);
    return clone({ ...order, risk, action: side });
  }

  function fillOrder(orderId, fillPrice) {
    const index = state.orders.findIndex(o => o.id === orderId);
    if (index < 0) return { valid: false, rejectionReasons: ['ORDER_NOT_FOUND'], paperOnly: true, realOrderPlaced: false };
    const order = state.orders[index];
    const filled = fillPaperOrder(order, fillPrice);
    if (!filled.transitionValid) return clone(filled);

    const position = createPaperPosition({
      symbol: filled.symbol,
      side: normalizeSide(filled.recommendation || filled.side),
      quantity: filled.quantity,
      fillPrice: filled.fillPrice
    });
    if (!position.valid) return { valid: false, rejectionReasons: ['POSITION_CREATION_FAILED'], paperOnly: true, realOrderPlaced: false };

    state.orders[index] = filled;
    state.positions.push(position);
    state.cash -= filled.quantity * filled.fillPrice;
    return clone({ order: filled, position, paperOnly: true, realOrderPlaced: false });
  }

  function cancelOrder(orderId) {
    const index = state.orders.findIndex(o => o.id === orderId);
    if (index < 0) return { valid: false, rejectionReasons: ['ORDER_NOT_FOUND'], paperOnly: true, realOrderPlaced: false };
    const result = transitionPaperOrder(state.orders[index], 'PAPER_CANCELLED');
    if (result.transitionValid) state.orders[index] = result;
    return clone(result);
  }

  function mark(symbol, markPrice) {
    const target = String(symbol || '').toUpperCase();
    state.positions = state.positions.map(position =>
      position.symbol === target && position.status === 'OPEN'
        ? markPaperPosition(position, markPrice)
        : position
    );
    return snapshot();
  }

  function close(symbol, exitPrice) {
    const target = String(symbol || '').toUpperCase();
    const index = state.positions.findIndex(p => p.symbol === target && p.status === 'OPEN');
    if (index < 0) return { valid: false, rejectionReasons: ['OPEN_POSITION_NOT_FOUND'], paperOnly: true, realOrderPlaced: false };
    const position = state.positions[index];
    const closed = closePaperPosition(position, exitPrice);
    if (!closed.valid) return clone(closed);

    const pnl = num(closed.realizedPnL);
    state.positions[index] = closed;
    // Cash is restored using exit proceeds; entry cash was reserved at fill.
    state.cash += num(closed.quantity) * num(exitPrice);
    state.dailyRealizedPnL += pnl;
    state.journal.push({
      symbol: target,
      side: closed.side,
      quantity: closed.quantity,
      entryPrice: closed.entryPrice,
      exitPrice: closed.exitPrice,
      realizedPnL: pnl,
      result: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
      paperOnly: true,
      realOrderPlaced: false,
      closedAt: closed.closedAt
    });
    return clone(closed);
  }

  function resetDailyRiskState() {
    const reset = resetDailyRisk({ dailyRealizedPnL: state.dailyRealizedPnL });
    state.dailyRealizedPnL = reset.dailyRealizedPnL;
    return snapshot();
  }

  function getState() {
    return clone({ ...state, snapshot: snapshot() });
  }

  return Object.freeze({
    scan,
    stageCandidate,
    fillOrder,
    cancelOrder,
    mark,
    close,
    resetDailyRisk: resetDailyRiskState,
    snapshot,
    getState
  });
}

export function assertPaperRuntimeSafe(runtime) {
  if (!runtime || typeof runtime.getState !== 'function') return false;
  const state = runtime.getState();
  return state.paperOnly === true && state.realOrderPlaced === false &&
    state.orders.every(o => o.paperOnly === true && o.realOrderPlaced === false) &&
    state.positions.every(p => p.paperOnly === true && p.realOrderPlaced === false) &&
    state.journal.every(j => j.paperOnly === true && j.realOrderPlaced === false);
}

console.log('AI TRADE PRO — integrated paper trading runtime loaded');
