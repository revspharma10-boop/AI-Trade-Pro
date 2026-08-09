// ============================================================
// AI TRADE PRO — STRATEGY DEFINITION ENGINE
// STEP 2T
// ============================================================
// Defines deterministic strategy rules without executing trades.
// Strategy definitions are validated before entering the backtest
// or paper execution layers.
// ============================================================

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const DIRECTIONS = new Set(['LONG', 'SHORT', 'BOTH']);

export function validateStrategyDefinition(strategy = {}) {
  const name = typeof strategy.name === 'string' ? strategy.name.trim() : '';
  const timeframe = typeof strategy.timeframe === 'string' ? strategy.timeframe.trim() : '';
  const direction = strategy.direction;
  const entryRules = Array.isArray(strategy.entryRules) ? strategy.entryRules : [];
  const exitRules = Array.isArray(strategy.exitRules) ? strategy.exitRules : [];
  const riskReward = number(strategy.minimumRiskReward, 0);

  const checks = {
    nameValid: name.length >= 2,
    timeframeValid: timeframe.length > 0,
    directionValid: DIRECTIONS.has(direction),
    entryRulesPresent: entryRules.length > 0,
    exitRulesPresent: exitRules.length > 0,
    riskRewardValid: riskReward >= 1.5,
    paperOnly: strategy.paperOnly !== false
  };

  const valid = Object.values(checks).every(Boolean);
  return {
    valid,
    paperOnly: true,
    realOrderPlaced: false,
    checks,
    rejectionReasons: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key.toUpperCase()),
    strategy: valid ? {
      name,
      timeframe,
      direction,
      entryRules,
      exitRules,
      minimumRiskReward: riskReward,
      enabled: strategy.enabled !== false
    } : null
  };
}

export function buildStrategyDefinition(strategy = {}) {
  const result = validateStrategyDefinition(strategy);
  if (!result.valid) return result;
  return {
    ...result,
    strategy: {
      ...result.strategy,
      id: strategy.id || result.strategy.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: strategy.version || 1
    }
  };
}

export function evaluateStrategyRules(strategy, market = {}) {
  const validation = validateStrategyDefinition(strategy);
  if (!validation.valid) {
    return { valid: false, triggered: false, paperOnly: true, realOrderPlaced: false, reason: 'Invalid strategy definition.' };
  }

  const conditions = validation.strategy.entryRules.map(rule => {
    if (!rule || typeof rule !== 'object') return false;
    if (rule.field === 'score') return number(market.score) >= number(rule.min);
    if (rule.field === 'riskReward') return number(market.riskRewardRatio) >= number(rule.min);
    if (rule.field === 'marketRegime') return number(market.marketRegimeScore) >= number(rule.min);
    if (rule.field === 'technical') return number(market.technicalScore) >= number(rule.min);
    return false;
  });

  const triggered = conditions.length > 0 && conditions.every(Boolean);
  return {
    valid: true,
    triggered,
    paperOnly: true,
    realOrderPlaced: false,
    direction: triggered && validation.strategy.direction !== 'BOTH' ? validation.strategy.direction : triggered ? 'LONG' : 'NONE',
    conditions
  };
}

console.log('AI TRADE PRO — strategy definition engine loaded');
