// ============================================================
// AI TRADE PRO — PAPER EXECUTION ENGINE
// STEP 2L
// PAPER-TRADING EXECUTION SAFETY BOUNDARY
// ============================================================
//
// Purpose:
// - Create the execution boundary between trade decisions and
//   any future broker integration.
// - Allow SAFE BUY / SELL decisions to become paper orders only.
// - Never send a real broker order.
// - Reject every NO TRADE or unsafe decision.
// - Keep broker integration completely outside this layer.
//
// IMPORTANT:
// This engine is PAPER ONLY.
// It does not call any broker API.
// It does not place real orders.
// ============================================================

const VALID_DECISIONS = new Set(['BUY', 'SELL']);
const VALID_ACTIONS = new Set(['LONG', 'SHORT']);

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function buildRejectionReasons(decision = {}) {
  const reasons = [];

  if (!VALID_DECISIONS.has(decision.decision)) {
    reasons.push('DECISION_NOT_EXECUTABLE');
  }

  if (decision.executable !== true) {
    reasons.push('EXECUTABLE_FLAG_FALSE');
  }

  if (decision.riskGatesPassed !== true) {
    reasons.push('RISK_GATES_FAILED');
  }

  if (!finitePositive(decision.entryPrice)) {
    reasons.push('INVALID_ENTRY_PRICE');
  }

  if (!finitePositive(decision.stopLoss)) {
    reasons.push('INVALID_STOP_LOSS');
  }

  if (!finitePositive(decision.targetPrice)) {
    reasons.push('INVALID_TARGET_PRICE');
  }

  if (Number(decision.riskRewardRatio) < 2) {
    reasons.push('RISK_REWARD_BELOW_MINIMUM');
  }

  if (Number(decision.opportunityScore) < 50) {
    reasons.push('OPPORTUNITY_SCORE_BELOW_MINIMUM');
  }

  if (!finitePositive(decision.quantity)) {
    reasons.push('INVALID_QUANTITY');
  }

  if (!finitePositive(decision.positionValue)) {
    reasons.push('INVALID_POSITION_VALUE');
  }

  if (!Number.isFinite(Number(decision.actualRiskAmount)) || Number(decision.actualRiskAmount) < 0) {
    reasons.push('INVALID_ACTUAL_RISK');
  }

  if (decision.capitalAvailable !== true) {
    reasons.push('CAPITAL_NOT_AVAILABLE');
  }

  const expectedAction =
    decision.decision === 'BUY'
      ? 'LONG'
      : decision.decision === 'SELL'
        ? 'SHORT'
        : null;

  if (!VALID_ACTIONS.has(decision.action)) {
    reasons.push('INVALID_ACTION');
  } else if (decision.action !== expectedAction) {
    reasons.push('ACTION_DIRECTION_MISMATCH');
  }

  return reasons;
}

// ============================================================
// PAPER EXECUTION AUTHORIZATION
// ============================================================

export function authorizePaperExecution(decision = {}) {
  const rejectionReasons = buildRejectionReasons(decision);
  const authorized = rejectionReasons.length === 0;

  return {
    valid: true,
    paperOnly: true,
    authorized,
    executable: authorized,
    decision: authorized ? decision.decision : 'NO TRADE',
    action: authorized ? decision.action : 'NONE',
    symbol: decision.symbol || null,
    direction: authorized ? decision.direction || null : null,
    quantity: authorized ? Number(decision.quantity) : 0,
    entryPrice: authorized ? Number(decision.entryPrice) : 0,
    stopLoss: authorized ? Number(decision.stopLoss) : 0,
    targetPrice: authorized ? Number(decision.targetPrice) : 0,
    riskRewardRatio: authorized ? Number(decision.riskRewardRatio) : 0,
    opportunityScore: authorized ? Number(decision.opportunityScore) : 0,
    actualRiskAmount: authorized ? Number(decision.actualRiskAmount) : 0,
    rejectionReasons,
    orderStatus: authorized ? 'PAPER_READY' : 'BLOCKED',
    realOrderPlaced: false,
    brokerOrderId: null,
    reason: authorized
      ? 'Paper execution authorized. No real broker order was placed.'
      : rejectionReasons.join(', ')
  };
}

// ============================================================
// PAPER ORDER CREATION
// ============================================================

export function createPaperOrder(decision = {}) {
  const authorization = authorizePaperExecution(decision);

  if (!authorization.authorized) {
    return authorization;
  }

  return {
    ...authorization,
    orderStatus: 'PAPER_ORDER_CREATED',
    paperOrder: {
      symbol: authorization.symbol,
      side: authorization.decision,
      action: authorization.action,
      quantity: authorization.quantity,
      entryPrice: authorization.entryPrice,
      stopLoss: authorization.stopLoss,
      targetPrice: authorization.targetPrice
    },
    realOrderPlaced: false,
    brokerOrderId: null,
    reason: 'Paper order created. No real broker order was placed.'
  };
}

console.log(
  'AI TRADE PRO — paper execution engine loaded'
);
