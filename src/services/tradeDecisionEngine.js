// ============================================================
// AI TRADE PRO — TRADE DECISION ENGINE
// STEP 2H ACTION 1
// ============================================================

const DEFAULT_MIN_RISK_REWARD = 2;
const DEFAULT_MIN_OPPORTUNITY_SCORE = 50;

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ============================================================
// VALIDATE TRADE DECISION INPUT
// ============================================================

function validateTradeDecisionInput({
  tradeSetup = {},
  positionSizing = {}
} = {}) {

  const entryPrice =
    toFiniteNumber(tradeSetup.entryPrice);

  const stopLoss =
    toFiniteNumber(tradeSetup.stopLoss);

  const targetPrice =
    toFiniteNumber(tradeSetup.targetPrice);

  const riskRewardRatio =
    toFiniteNumber(tradeSetup.riskRewardRatio);

  const opportunityScore =
    toFiniteNumber(tradeSetup.opportunityScore);

  const quantity =
    toFiniteNumber(positionSizing.quantity);

  const positionValue =
    toFiniteNumber(positionSizing.positionValue);

  const actualRiskAmount =
    toFiniteNumber(positionSizing.actualRiskAmount);

  return {

    symbolValid:
      Boolean(tradeSetup.symbol),

    directionValid:
      tradeSetup.direction === 'BULLISH' ||
      tradeSetup.direction === 'BEARISH',

    entryPriceValid:
      entryPrice !== null &&
      entryPrice > 0,

    stopLossValid:
      stopLoss !== null &&
      stopLoss > 0,

    targetPriceValid:
      targetPrice !== null &&
      targetPrice > 0,

    riskRewardValid:
      riskRewardRatio !== null &&
      riskRewardRatio >= DEFAULT_MIN_RISK_REWARD,

    opportunityScoreValid:
      opportunityScore !== null &&
      opportunityScore >= DEFAULT_MIN_OPPORTUNITY_SCORE,

    positionSizingValid:
      positionSizing.valid === true,

    quantityValid:
      quantity !== null &&
      quantity > 0,

    positionValueValid:
      positionValue !== null &&
      positionValue > 0,

    actualRiskValid:
      actualRiskAmount !== null &&
      actualRiskAmount >= 0
  };
}

// ============================================================
// FINAL TRADE DECISION
// ============================================================

function buildTradeDecision({
  tradeSetup = {},
  positionSizing = {},
  riskGatesPassed = false
} = {}) {

  const validation =
    validateTradeDecisionInput({
      tradeSetup,
      positionSizing
    });

  // ----------------------------------------------------------
  // HARD SAFETY CHECKS
  // ----------------------------------------------------------

  const hardSafetyPassed =
    validation.symbolValid &&
    validation.directionValid &&
    validation.entryPriceValid &&
    validation.stopLossValid &&
    validation.targetPriceValid &&
    validation.riskRewardValid &&
    validation.positionSizingValid &&
    validation.quantityValid &&
    validation.positionValueValid &&
    validation.actualRiskValid;

  // ----------------------------------------------------------
  // FINAL DECISION
  // ----------------------------------------------------------

  let decision = 'NO TRADE';
  let action = 'NONE';

  if (
    hardSafetyPassed &&
    riskGatesPassed === true &&
    validation.opportunityScoreValid
  ) {

    if (tradeSetup.direction === 'BULLISH') {
      decision = 'BUY';
      action = 'LONG';
    }

    else if (tradeSetup.direction === 'BEARISH') {
      decision = 'SELL';
      action = 'SHORT';
    }
  }

  // ----------------------------------------------------------
  // REJECTION REASON
  // ----------------------------------------------------------

  const rejectionReasons = [];

  if (!validation.symbolValid) {
    rejectionReasons.push('INVALID_SYMBOL');
  }

  if (!validation.directionValid) {
    rejectionReasons.push('INVALID_DIRECTION');
  }

  if (!validation.entryPriceValid) {
    rejectionReasons.push('INVALID_ENTRY_PRICE');
  }

  if (!validation.stopLossValid) {
    rejectionReasons.push('INVALID_STOP_LOSS');
  }

  if (!validation.targetPriceValid) {
    rejectionReasons.push('INVALID_TARGET_PRICE');
  }

  if (!validation.riskRewardValid) {
    rejectionReasons.push('RISK_REWARD_BELOW_MINIMUM');
  }

  if (!validation.opportunityScoreValid) {
    rejectionReasons.push('OPPORTUNITY_SCORE_BELOW_MINIMUM');
  }

  if (!validation.positionSizingValid) {
    rejectionReasons.push('POSITION_SIZING_INVALID');
  }

  if (!validation.quantityValid) {
    rejectionReasons.push('INVALID_QUANTITY');
  }

  if (!validation.positionValueValid) {
    rejectionReasons.push('INVALID_POSITION_VALUE');
  }

  if (!validation.actualRiskValid) {
    rejectionReasons.push('INVALID_ACTUAL_RISK');
  }

  if (riskGatesPassed !== true) {
    rejectionReasons.push('RISK_GATES_FAILED');
  }

  // ----------------------------------------------------------
  // FINAL RESULT
  // ----------------------------------------------------------

  return {

    valid:
      hardSafetyPassed,

    executable:
      decision === 'BUY' ||
      decision === 'SELL',

    decision,

    action,

    symbol:
      tradeSetup.symbol || null,

    direction:
      tradeSetup.direction || 'NONE',

    entryPrice:
      tradeSetup.entryPrice ?? null,

    stopLoss:
      tradeSetup.stopLoss ?? null,

    targetPrice:
      tradeSetup.targetPrice ?? null,

    riskRewardRatio:
      tradeSetup.riskRewardRatio ?? 0,

    opportunityScore:
      tradeSetup.opportunityScore ?? 0,

    riskGatesPassed:
      Boolean(riskGatesPassed),

    quantity:
      positionSizing.quantity ?? 0,

    positionValue:
      positionSizing.positionValue ?? 0,

    actualRiskAmount:
      positionSizing.actualRiskAmount ?? 0,

    actualRiskPercent:
      positionSizing.actualRiskPercent ?? 0,

    capitalAvailable:
      positionSizing.capitalAvailable === true,

    validation,

    rejectionReasons,

    reason:
      decision === 'NO TRADE'
        ? rejectionReasons.join(', ')
        : 'Trade passed all decision and safety gates.'
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  buildTradeDecision,
  validateTradeDecisionInput
};

console.log(
  'AI TRADE PRO — trade decision engine loaded'
);