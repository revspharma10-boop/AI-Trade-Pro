// ============================================================
// AI TRADE PRO — PAPER TRADING SESSION ENGINE
// STEPS 2AA–2AD
// Coordinates authorization, paper portfolio state and session metrics.
// NEVER places real orders.
// ============================================================

import { authorizePaperTrade, calculatePortfolioRisk } from './portfolioRiskEngine.js';
import { openPaperPosition, closePaperPosition, markPaperPosition, getPortfolioSummary } from './paperPortfolioEngine.js';

export function createPaperTradingSession({ initialCapital = 100000, riskConfig = {} } = {}) {
  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    initialCapital,
    riskConfig: { ...riskConfig },
    portfolio: {
      valid: true,
      paperOnly: true,
      initialCapital,
      cash: initialCapital,
      reservedCapital: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      equity: initialCapital,
      positions: [],
      closedPositions: [],
      orders: [],
      realOrderPlaced: false
    },
    events: []
  };
}

export function submitPaperTrade(session, order = {}) {
  if (!session || session.paperOnly !== true) {
    return { valid: false, authorized: false, executed: false, reason: 'PAPER_SESSION_REQUIRED', realOrderPlaced: false };
  }

  const authorization = authorizePaperTrade({
    portfolio: session.portfolio,
    order: { ...order, paperOnly: true },
    config: session.riskConfig
  });

  if (!authorization.authorized) {
    session.events.push({ type: 'TRADE_BLOCKED', symbol: order.symbol || null, reasons: authorization.rejectionReasons });
    return { valid: true, authorized: false, executed: false, paperOnly: true, authorization, realOrderPlaced: false };
  }

  const result = openPaperPosition(session.portfolio, { ...order, paperOnly: true });
  session.events.push({ type: result.created ? 'PAPER_POSITION_OPENED' : 'TRADE_REJECTED', symbol: order.symbol || null });

  return {
    valid: result.valid,
    authorized: true,
    executed: Boolean(result.created),
    paperOnly: true,
    authorization,
    result,
    realOrderPlaced: false
  };
}

export function updatePaperTrade(session, symbol, marketPrice) {
  if (!session || session.paperOnly !== true) return { valid: false, updated: false, realOrderPlaced: false };
  const result = markPaperPosition(session.portfolio, symbol, marketPrice);
  session.events.push({ type: result.updated ? 'POSITION_MARKED' : 'MARK_REJECTED', symbol });
  return { ...result, paperOnly: true, realOrderPlaced: false };
}

export function closePaperTrade(session, symbol, exitPrice, reason = 'MANUAL_EXIT') {
  if (!session || session.paperOnly !== true) return { valid: false, closed: false, realOrderPlaced: false };
  const result = closePaperPosition(session.portfolio, symbol, exitPrice, reason);
  session.events.push({ type: result.closed ? 'PAPER_POSITION_CLOSED' : 'CLOSE_REJECTED', symbol, reason });
  return { ...result, paperOnly: true, realOrderPlaced: false };
}

export function getPaperSessionSnapshot(session) {
  if (!session || session.paperOnly !== true) return { valid: false };
  const portfolio = getPortfolioSummary(session.portfolio);
  const risk = calculatePortfolioRisk(session.portfolio, session.riskConfig);
  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    portfolio,
    risk,
    eventCount: session.events.length
  };
}

console.log('AI TRADE PRO — paper trading session engine loaded');
