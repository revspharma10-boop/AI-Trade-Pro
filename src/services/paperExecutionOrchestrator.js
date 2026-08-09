// ============================================================
// AI TRADE PRO — PAPER EXECUTION ORCHESTRATOR
// STEP 2N
// DECISION → AUTHORIZATION → PORTFOLIO BOUNDARY
// ============================================================
// PAPER ONLY. No broker API. No real order placement.
// ============================================================

import { authorizePaperExecution, createPaperOrder } from './paperExecutionEngine.js';
import {
  openPaperPosition,
  markPaperPosition,
  closePaperPosition,
  getPortfolioSummary
} from './paperPortfolioEngine.js';

export function processPaperDecision(portfolio, decision = {}) {
  const authorization = authorizePaperExecution(decision);

  if (!authorization.authorized) {
    return {
      valid: true,
      paperOnly: true,
      authorized: false,
      executed: false,
      decision: 'NO TRADE',
      action: 'NONE',
      orderStatus: 'BLOCKED',
      authorization,
      portfolio: getPortfolioSummary(portfolio),
      realOrderPlaced: false
    };
  }

  const paperOrder = createPaperOrder(decision);
  if (!paperOrder.authorized) {
    return {
      valid: true,
      paperOnly: true,
      authorized: false,
      executed: false,
      decision: 'NO TRADE',
      action: 'NONE',
      orderStatus: 'BLOCKED',
      authorization: paperOrder,
      portfolio: getPortfolioSummary(portfolio),
      realOrderPlaced: false
    };
  }

  const opened = openPaperPosition(portfolio, paperOrder.paperOrder);

  if (!opened.created) {
    return {
      valid: true,
      paperOnly: true,
      authorized: true,
      executed: false,
      decision: decision.decision,
      action: decision.action,
      orderStatus: 'PAPER_ORDER_REJECTED',
      reason: opened.reason,
      authorization: paperOrder,
      portfolio: getPortfolioSummary(portfolio),
      realOrderPlaced: false
    };
  }

  return {
    valid: true,
    paperOnly: true,
    authorized: true,
    executed: true,
    decision: decision.decision,
    action: decision.action,
    orderStatus: 'PAPER_POSITION_OPEN',
    authorization: paperOrder,
    position: opened.position,
    portfolio: opened.portfolio,
    realOrderPlaced: false
  };
}

export function updatePaperMarket(portfolio, symbol, marketPrice) {
  const result = markPaperPosition(portfolio, symbol, marketPrice);
  return {
    ...result,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function closePaperTrade(portfolio, symbol, exitPrice, reason = 'MANUAL_EXIT') {
  const result = closePaperPosition(portfolio, symbol, exitPrice, reason);
  return {
    ...result,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function buildPaperExecutionSnapshot(portfolio, decision = {}) {
  const summary = getPortfolioSummary(portfolio);
  const safeDecision = decision?.executable === true &&
    ['BUY', 'SELL'].includes(decision?.decision) &&
    ['LONG', 'SHORT'].includes(decision?.action);

  return {
    valid: true,
    paperOnly: true,
    decision: safeDecision ? decision.decision : 'NO TRADE',
    action: safeDecision ? decision.action : 'NONE',
    executable: safeDecision,
    symbol: decision?.symbol || null,
    opportunityScore: Number(decision?.opportunityScore) || 0,
    riskRewardRatio: Number(decision?.riskRewardRatio) || 0,
    riskGatesPassed: decision?.riskGatesPassed === true,
    portfolio: summary,
    realOrderPlaced: false
  };
}

console.log('AI TRADE PRO — paper execution orchestrator loaded');
