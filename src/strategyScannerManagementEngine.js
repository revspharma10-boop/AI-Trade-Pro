// AI TRADE PRO — PHASE 4: STRATEGY & SCANNER MANAGEMENT
// Paper-safe strategy registry, scanner filtering/ranking and allocation gates.

const ACTIONS = new Set(['BUY', 'SELL', 'HOLD', 'NO_TRADE']);
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

export function createStrategyScannerManager(options = {}) {
  const maxStrategies = Math.max(1, Number(options.maxStrategies ?? 50));
  const strategies = new Map();
  const cooldowns = new Map();

  function defineStrategy(def = {}) {
    if (!def.id || !String(def.name || '').trim()) return { accepted: false, reason: 'INVALID_STRATEGY' };
    if (strategies.size >= maxStrategies && !strategies.has(def.id)) return { accepted: false, reason: 'STRATEGY_LIMIT' };
    const strategy = {
      id: String(def.id), name: String(def.name), enabled: def.enabled !== false,
      maxPositions: Math.max(1, Number(def.maxPositions ?? 1)), maxCapitalUtilization: Math.min(100, Math.max(0, Number(def.maxCapitalUtilization ?? 20))),
      cooldownMs: Math.max(0, Number(def.cooldownMs ?? 0)), paperOnly: true,
      createdAt: strategies.get(def.id)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    strategies.set(strategy.id, strategy); return { accepted: true, strategy: { ...strategy } };
  }
  function setStrategyEnabled(id, enabled) {
    const s = strategies.get(id); if (!s) return { accepted: false, reason: 'UNKNOWN_STRATEGY' };
    s.enabled = Boolean(enabled); s.updatedAt = new Date().toISOString(); return { accepted: true, strategy: { ...s } };
  }
  function canCandidateEnter(candidate = {}, context = {}) {
    const s = strategies.get(candidate.strategyId);
    if (!s) return { accepted: false, reason: 'UNKNOWN_STRATEGY' };
    if (!s.enabled) return { accepted: false, reason: 'STRATEGY_DISABLED' };
    if (!candidate.symbol || !ACTIONS.has(candidate.action)) return { accepted: false, reason: 'INVALID_CANDIDATE' };
    if (!['BUY','SELL'].includes(candidate.action)) return { accepted: false, reason: 'NON_EXECUTABLE_ACTION' };
    if (context.openSymbols?.includes(candidate.symbol)) return { accepted: false, reason: 'ALREADY_OPEN' };
    if (context.candidateSymbols?.includes(candidate.symbol)) return { accepted: false, reason: 'DUPLICATE_SYMBOL' };
    const last = cooldowns.get(`${s.id}:${candidate.symbol}`) || 0;
    if (Date.now() - last < s.cooldownMs) return { accepted: false, reason: 'COOLDOWN' };
    const score = num(candidate.score); if (score === null || score < 0) return { accepted: false, reason: 'INVALID_SCORE' };
    if (candidate.riskPassed === false) return { accepted: false, reason: 'RISK_GATE_FAILED' };
    const utilization = num(context.capitalUtilizationPercent) ?? 0;
    if (utilization > s.maxCapitalUtilization) return { accepted: false, reason: 'CAPITAL_UTILIZATION_LIMIT' };
    return { accepted: true, reason: null, paperOnly: true, realOrderPlaced: false };
  }
  function rankCandidates(candidates = [], context = {}) {
    const accepted = [], rejected = [];
    for (const candidate of candidates) {
      const result = canCandidateEnter(candidate, { ...context, candidateSymbols: accepted.map(x => x.symbol) });
      if (result.accepted) accepted.push({ ...candidate, rank: 0, paperOnly: true }); else rejected.push({ ...candidate, rejected: true, reason: result.reason });
    }
    accepted.sort((a,b) => Number(b.score) - Number(a.score));
    accepted.forEach((x,i) => { x.rank = i + 1; });
    return { accepted, rejected, paperOnly: true, realOrderPlaced: false };
  }
  function markEntered(strategyId, symbol) { cooldowns.set(`${strategyId}:${symbol}`, Date.now()); }
  function snapshot() { return { strategies: [...strategies.values()].map(x => ({...x})), strategyCount: strategies.size, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false }; }
  return Object.freeze({ defineStrategy, setStrategyEnabled, canCandidateEnter, rankCandidates, markEntered, snapshot });
}

export function assertStrategyScannerSafe(result) {
  return Boolean(result && result.paperOnly === true && result.realOrderPlaced === false && result.productionRealTradingEnabled !== true);
}

console.log('AI TRADE PRO — strategy scanner management engine loaded');
