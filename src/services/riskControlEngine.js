// ============================================================
// AI TRADE PRO — RISK CONTROL ENGINE
// STEP 2R
// ============================================================
// PAPER/ANALYTICAL ONLY. No broker API. No real orders.
// Centralizes pre-trade safety decisions so every future strategy
// must pass the same risk controls before paper authorization.
// ============================================================

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positive(value) {
  return number(value) > 0;
}

export const RISK_CONTROL_CONFIG = {
  maxRiskPercent: 1,
  maxPositionValuePercent: 25,
  minimumRiskReward: 1.5,
  maxConcurrentPositions: 5,
  allowShorts: true
};

export function evaluateRiskControls(input = {}, config = {}) {
  const rules = { ...RISK_CONTROL_CONFIG, ...config };
  const capital = number(input.accountCapital);
  const entry = number(input.entryPrice);
  const stop = number(input.stopLoss);
  const quantity = Math.floor(number(input.quantity));
  const riskPerShare = Math.abs(entry - stop);
  const riskAmount = riskPerShare * quantity;
  const positionValue = entry * quantity;
  const riskPercent = capital > 0 ? (riskAmount / capital) * 100 : Infinity;
  const positionValuePercent = capital > 0 ? (positionValue / capital) * 100 : Infinity;
  const ratio = number(input.riskRewardRatio);
  const openPositions = Math.max(0, Math.floor(number(input.openPositions)));
  const action = input.action === 'SHORT' ? 'SHORT' : input.action === 'LONG' ? 'LONG' : 'NONE';

  const gates = {
    capitalAvailable: capital > 0,
    entryValid: positive(entry),
    stopLossValid: positive(stop) && riskPerShare > 0,
    quantityValid: quantity > 0,
    riskRewardAcceptable: ratio >= rules.minimumRiskReward,
    riskPercentAcceptable: riskPercent <= rules.maxRiskPercent,
    positionValueAcceptable: positionValuePercent <= rules.maxPositionValuePercent,
    concurrentPositionsAcceptable: openPositions < rules.maxConcurrentPositions,
    directionAllowed: action !== 'SHORT' || rules.allowShorts === true,
    paperOnly: input.paperOnly !== false,
    realOrderBlocked: input.realOrderPlaced !== true
  };

  const passed = Object.values(gates).every(Boolean);
  const rejectionReasons = Object.entries(gates)
    .filter(([, ok]) => !ok)
    .map(([name]) => name.toUpperCase());

  return {
    valid: true,
    authorized: passed,
    paperOnly: true,
    realOrderPlaced: false,
    action: passed ? action : 'NONE',
    gates,
    rejectionReasons,
    metrics: {
      riskPerShare: Number(riskPerShare.toFixed(4)),
      riskAmount: Number(riskAmount.toFixed(2)),
      riskPercent: Number(riskPercent.toFixed(4)),
      positionValue: Number(positionValue.toFixed(2)),
      positionValuePercent: Number(positionValuePercent.toFixed(4)),
      riskRewardRatio: Number(ratio.toFixed(2))
    }
  };
}

export function authorizePaperTrade(input = {}, config = {}) {
  const result = evaluateRiskControls(input, config);
  return {
    valid: result.valid,
    authorized: result.authorized,
    decision: result.authorized ? (input.decision || 'TRADE') : 'NO TRADE',
    action: result.authorized ? result.action : 'NONE',
    paperOrderAllowed: result.authorized,
    paperOnly: true,
    realOrderPlaced: false,
    rejectionReasons: result.rejectionReasons,
    risk: result
  };
}

console.log('AI TRADE PRO — risk control engine loaded');
