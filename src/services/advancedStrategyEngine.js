// ============================================================
// AI TRADE PRO — ADVANCED STRATEGY ENGINE
// STEP 2AE–2AJ
// ============================================================
// Paper-only strategy orchestration layer.
// Combines strategy rules, entry validation, risk/reward,
// position sizing, stop/target and exit evaluation.
// No broker/live-order capability exists in this module.
// ============================================================

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, num(value)));
}

export function calculateRiskReward({ entry = 0, stopLoss = 0, target = 0 } = {}) {
  const e = num(entry);
  const s = num(stopLoss);
  const t = num(target);
  if (e <= 0 || s <= 0 || t <= 0) return { valid: false, risk: 0, reward: 0, ratio: 0 };
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk <= 0 || reward < 0) return { valid: false, risk: 0, reward: 0, ratio: 0 };
  return { valid: true, risk: Number(risk.toFixed(4)), reward: Number(reward.toFixed(4)), ratio: Number((reward / risk).toFixed(4)) };
}

export function calculatePositionSize({ capital = 0, riskPercent = 1, entry = 0, stopLoss = 0, maxCapitalPercent = 100 } = {}) {
  const c = num(capital);
  const e = num(entry);
  const s = num(stopLoss);
  const rp = clamp(riskPercent, 0, 100);
  const cp = clamp(maxCapitalPercent, 0, 100);
  const riskPerUnit = Math.abs(e - s);
  if (c <= 0 || e <= 0 || riskPerUnit <= 0 || rp <= 0) {
    return { valid: false, quantity: 0, riskAmount: 0, capitalUsed: 0, capitalUtilizationPercent: 0 };
  }
  const riskAmount = c * rp / 100;
  const riskQuantity = Math.floor(riskAmount / riskPerUnit);
  const capitalCap = Math.floor((c * cp / 100) / e);
  const quantity = Math.max(0, Math.min(riskQuantity, capitalCap));
  const capitalUsed = quantity * e;
  return {
    valid: quantity > 0,
    quantity,
    riskAmount: Number(riskAmount.toFixed(2)),
    capitalUsed: Number(capitalUsed.toFixed(2)),
    capitalUtilizationPercent: Number((capitalUsed / c * 100).toFixed(2)),
    riskPerUnit: Number(riskPerUnit.toFixed(4))
  };
}

export function buildTradeLevels({ direction = 'LONG', entry = 0, stopLoss = 0, target = 0, riskReward = 2, stopPercent = 0 } = {}) {
  const e = num(entry);
  const rr = Math.max(0, num(riskReward));
  let stop = num(stopLoss);
  let targetPrice = num(target);
  const pct = Math.max(0, num(stopPercent));
  const dir = direction === 'SHORT' ? 'SHORT' : 'LONG';

  if (e <= 0) return { valid: false, direction: dir, entry: e, stopLoss: 0, target: 0, riskReward: 0 };
  if (stop <= 0 && pct > 0) stop = dir === 'LONG' ? e * (1 - pct / 100) : e * (1 + pct / 100);
  if (targetPrice <= 0 && stop > 0 && rr > 0) {
    const risk = Math.abs(e - stop);
    targetPrice = dir === 'LONG' ? e + risk * rr : e - risk * rr;
  }

  const levels = calculateRiskReward({ entry: e, stopLoss: stop, target: targetPrice });
  const directionalValid = dir === 'LONG' ? stop < e && targetPrice > e : stop > e && targetPrice < e;
  return {
    valid: levels.valid && directionalValid,
    direction: dir,
    entry: Number(e.toFixed(4)),
    stopLoss: Number(stop.toFixed(4)),
    target: Number(targetPrice.toFixed(4)),
    riskReward: levels.ratio,
    risk: levels.risk,
    reward: levels.reward
  };
}

export function evaluateEntryConditions({ strategy = {}, market = {} } = {}) {
  const rules = Array.isArray(strategy.entryRules) ? strategy.entryRules : [];
  const conditions = rules.map(rule => {
    if (!rule || typeof rule !== 'object') return false;
    const actual = num(market[rule.field]);
    const min = rule.min == null ? -Infinity : num(rule.min);
    const max = rule.max == null ? Infinity : num(rule.max);
    if (rule.operator === '>' ) return actual > min;
    if (rule.operator === '>=' || !rule.operator) return actual >= min && actual <= max;
    if (rule.operator === '<') return actual < min;
    if (rule.operator === '<=') return actual <= min;
    if (rule.operator === 'between') return actual >= min && actual <= max;
    if (rule.operator === 'equals') return actual === min;
    return false;
  });
  return { valid: rules.length > 0, triggered: conditions.length > 0 && conditions.every(Boolean), conditions };
}

export function evaluateExitConditions({ direction = 'LONG', price = 0, stopLoss = 0, target = 0 } = {}) {
  const p = num(price);
  const s = num(stopLoss);
  const t = num(target);
  const dir = direction === 'SHORT' ? 'SHORT' : 'LONG';
  if (p <= 0 || s <= 0 || t <= 0) return { valid: false, exit: false, reason: 'INVALID_LEVELS' };
  if (dir === 'LONG' && p <= s) return { valid: true, exit: true, reason: 'STOP_LOSS' };
  if (dir === 'LONG' && p >= t) return { valid: true, exit: true, reason: 'TARGET' };
  if (dir === 'SHORT' && p >= s) return { valid: true, exit: true, reason: 'STOP_LOSS' };
  if (dir === 'SHORT' && p <= t) return { valid: true, exit: true, reason: 'TARGET' };
  return { valid: true, exit: false, reason: 'HOLD' };
}

export function validateAdvancedStrategy(strategy = {}) {
  const direction = ['LONG', 'SHORT', 'BOTH'].includes(strategy.direction) ? strategy.direction : null;
  const rules = Array.isArray(strategy.entryRules) ? strategy.entryRules : [];
  const exits = Array.isArray(strategy.exitRules) ? strategy.exitRules : [];
  const minimumRiskReward = num(strategy.minimumRiskReward);
  const paperOnly = strategy.paperOnly !== false;
  const checks = {
    directionValid: Boolean(direction),
    entryRulesPresent: rules.length > 0,
    exitRulesPresent: exits.length > 0,
    minimumRiskRewardValid: minimumRiskReward >= 1.5,
    paperOnly
  };
  return {
    valid: Object.values(checks).every(Boolean),
    paperOnly: true,
    realOrderPlaced: false,
    checks,
    rejectionReasons: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key.toUpperCase())
  };
}

export function evaluateAdvancedStrategy({ strategy = {}, market = {}, trade = {}, account = {} } = {}) {
  const validation = validateAdvancedStrategy(strategy);
  if (!validation.valid) return { valid: false, triggered: false, executable: false, decision: 'NO TRADE', action: 'NONE', paperOnly: true, realOrderPlaced: false, rejectionReasons: validation.rejectionReasons };

  const entry = evaluateEntryConditions({ strategy, market });
  const direction = strategy.direction === 'SHORT' ? 'SHORT' : 'LONG';
  const levels = buildTradeLevels({
    direction,
    entry: trade.entry,
    stopLoss: trade.stopLoss,
    target: trade.target,
    riskReward: strategy.minimumRiskReward,
    stopPercent: trade.stopPercent
  });
  const rrPass = levels.valid && levels.riskReward >= strategy.minimumRiskReward;
  const sizing = calculatePositionSize({
    capital: account.capital,
    riskPercent: account.riskPercent ?? 1,
    entry: levels.entry,
    stopLoss: levels.stopLoss,
    maxCapitalPercent: account.maxCapitalPercent ?? 100
  });
  const triggered = entry.triggered && rrPass && sizing.valid;
  const action = triggered ? (direction === 'SHORT' ? 'SHORT' : 'LONG') : 'NONE';
  return {
    valid: true,
    triggered,
    executable: false,
    decision: triggered ? (direction === 'SHORT' ? 'SELL' : 'BUY') : 'NO TRADE',
    action,
    paperOnly: true,
    realOrderPlaced: false,
    entryConditions: entry,
    levels,
    positionSizing: sizing,
    riskRewardAcceptable: rrPass,
    rejectionReasons: triggered ? [] : [
      ...(entry.triggered ? [] : ['ENTRY_RULES_FAILED']),
      ...(rrPass ? [] : ['RISK_REWARD_FAILED']),
      ...(sizing.valid ? [] : ['POSITION_SIZE_FAILED'])
    ]
  };
}

console.log('AI TRADE PRO — advanced strategy engine loaded');
