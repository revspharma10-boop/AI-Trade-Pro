// AI TRADE PRO — STEP 2BU–2CD
// Scanner orchestration and paper-safe candidate selection.

const DEFAULTS = Object.freeze({
  maxCandidates: 5,
  maxCapitalUtilizationPercent: 70,
  maxRiskPerTradePercent: 2,
  minimumScore: 65,
  minimumRiskReward: 1.5
});

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function validateScannerCandidate(candidate = {}) {
  const symbol = String(candidate.symbol || '').trim().toUpperCase();
  const recommendation = String(candidate.recommendation || '').toUpperCase();
  const score = num(candidate.opportunityScore);
  const rr = num(candidate.riskRewardRatio);
  const reasons = [];
  if (!symbol) reasons.push('INVALID_SYMBOL');
  if (!['BUY', 'SELL'].includes(recommendation)) reasons.push('NON_EXECUTABLE_RECOMMENDATION');
  if (score < 65) reasons.push('OPPORTUNITY_SCORE_BELOW_MINIMUM');
  if (rr < 1.5) reasons.push('RISK_REWARD_BELOW_MINIMUM');
  if (candidate.riskGatesPassed !== true) reasons.push('RISK_GATES_FAILED');
  return { valid: reasons.length === 0, symbol, recommendation, reasons };
}

export function allocateScannerCandidates(candidates = [], portfolio = {}, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const openSymbols = new Set((portfolio.positions || []).map(p => String(p.symbol || '').trim().toUpperCase()));
  const used = num(portfolio.capitalUtilizationPercent);
  const selected = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const check = validateScannerCandidate(raw);
    const symbol = check.symbol;
    const reasons = [...check.reasons];
    if (symbol && seen.has(symbol)) reasons.push('DUPLICATE_SYMBOL');
    if (symbol && openSymbols.has(symbol)) reasons.push('ALREADY_OPEN');
    if (used >= cfg.maxCapitalUtilizationPercent) reasons.push('CAPITAL_UTILIZATION_LIMIT');
    seen.add(symbol);

    const item = {
      symbol,
      recommendation: check.recommendation,
      opportunityScore: num(raw.opportunityScore),
      riskRewardRatio: num(raw.riskRewardRatio),
      riskQualityScore: num(raw.riskQualityScore),
      executable: reasons.length === 0,
      paperOnly: true,
      realOrderPlaced: false,
      rejectionReasons: reasons
    };
    (item.executable ? selected : rejected).push(item);
  }

  selected.sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.riskQualityScore - a.riskQualityScore) || (b.riskRewardRatio - a.riskRewardRatio));
  const ranked = selected.slice(0, cfg.maxCandidates).map((x, i) => ({ ...x, rank: i + 1 }));
  return { ranked, rejected, paperOnly: true, realOrderPlaced: false };
}

export function buildScannerCycle(candidates = [], portfolio = {}, config = {}) {
  const result = allocateScannerCandidates(candidates, portfolio, config);
  return {
    valid: true,
    scanned: Array.isArray(candidates) ? candidates.length : 0,
    executable: result.ranked.length,
    rejected: result.rejected,
    rejectedCount: result.rejected.length,
    candidates: result.ranked,
    rejectedCandidates: result.rejected,
    paperExecutionQueue: result.ranked.map(x => ({ ...x, orderStatus: 'PAPER_READY', realOrderPlaced: false })),
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function assertPaperSafeCycle(cycle = {}) {
  return Boolean(cycle.paperOnly === true && cycle.realOrderPlaced === false &&
    Array.isArray(cycle.paperExecutionQueue) &&
    cycle.paperExecutionQueue.every(x => x.paperOnly === true && x.realOrderPlaced === false));
}
