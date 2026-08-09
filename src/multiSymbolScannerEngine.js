// AI TRADE PRO — STEP 2BK–2BT
// Portfolio-aware multi-symbol scanner engine. Paper-only by design.

const DEFAULTS = Object.freeze({
  minimumScore: 65,
  minimumRiskReward: 1.5,
  maxCandidates: 10,
  maxOpenPositions: 5
});

export function normalizeSymbol(symbol = '') {
  return String(symbol).trim().toUpperCase();
}

export function scanUniverse(candidates = [], portfolio = {}, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const openSymbols = new Set((portfolio.positions || []).map(p => normalizeSymbol(p.symbol)));
  const seen = new Set();
  const results = [];

  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const symbol = normalizeSymbol(raw?.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);

    const score = Number(raw?.opportunityScore) || 0;
    const rr = Number(raw?.riskRewardRatio) || 0;
    const recommendation = String(raw?.recommendation || '').toUpperCase();
    const rejectionReasons = [];

    if (openSymbols.has(symbol)) rejectionReasons.push('ALREADY_OPEN');
    if (score < cfg.minimumScore) rejectionReasons.push('SCORE_BELOW_MINIMUM');
    if (rr < cfg.minimumRiskReward) rejectionReasons.push('RISK_REWARD_BELOW_MINIMUM');
    if (raw?.riskGatesPassed !== true) rejectionReasons.push('RISK_GATES_FAILED');
    if (!['BUY', 'SELL'].includes(recommendation)) rejectionReasons.push('NON_EXECUTABLE_RECOMMENDATION');
    if (Number(portfolio.openPositions || 0) >= cfg.maxOpenPositions && !openSymbols.has(symbol)) {
      rejectionReasons.push('MAX_OPEN_POSITIONS_REACHED');
    }

    const executable = rejectionReasons.length === 0;
    results.push({
      symbol,
      recommendation,
      opportunityScore: score,
      riskRewardRatio: rr,
      riskQualityScore: Number(raw?.riskQualityScore) || 0,
      executable,
      paperOnly: true,
      realOrderPlaced: false,
      rejectionReasons
    });
  }

  return results;
}

export function rankScanResults(results = [], { maxCandidates = DEFAULTS.maxCandidates } = {}) {
  return results
    .filter(item => item?.executable === true)
    .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.riskQualityScore - a.riskQualityScore) || (b.riskRewardRatio - a.riskRewardRatio))
    .slice(0, maxCandidates)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function getPaperExecutionQueue(results = []) {
  return rankScanResults(results).filter(item => item.executable && item.paperOnly && !item.realOrderPlaced);
}

export function buildScannerSnapshot(results = [], ranked = []) {
  return {
    valid: Array.isArray(results) && Array.isArray(ranked),
    scanned: results.length,
    executable: ranked.length,
    blocked: results.filter(x => !x.executable).length,
    paperOnly: true,
    realOrderPlaced: false,
    symbols: ranked.map(x => x.symbol)
  };
}
