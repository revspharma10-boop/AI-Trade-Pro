// AI TRADE PRO — STEP 2V
// Signal Scanner Engine
// Converts existing analysis outputs into ranked paper-only candidates.

function score(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }

export function scanCandidate(input = {}) {
  const opportunityScore = score(input.opportunityScore);
  const riskQualityScore = score(input.riskQualityScore);
  const technicalScore = score(input.technicalScore);
  const fundamentalScore = score(input.fundamentalScore);
  const marketRegimeScore = score(input.marketRegimeScore);
  const riskRewardRatio = Number(input.riskRewardRatio) || 0;
  const gatesPassed = input.riskGatesPassed === true;
  const recommendation = typeof input.recommendation === 'string' ? input.recommendation : 'NO TRADE';
  const executable = gatesPassed && (recommendation === 'BUY' || recommendation === 'SELL');
  const rejectionReasons = [];
  if (!gatesPassed) rejectionReasons.push('RISK_GATES_FAILED');
  if (opportunityScore < 65) rejectionReasons.push('OPPORTUNITY_SCORE_BELOW_SCAN_THRESHOLD');
  if (riskRewardRatio < 1.5) rejectionReasons.push('RISK_REWARD_BELOW_MINIMUM');
  return { valid: Boolean(input.symbol), paperOnly: true, realOrderPlaced: false, symbol: input.symbol || '', opportunityScore, riskQualityScore, technicalScore, fundamentalScore, marketRegimeScore, riskRewardRatio, riskGatesPassed: gatesPassed, recommendation, executable, rejectionReasons };
}

export function rankCandidates(candidates = [], options = {}) {
  const minimumScore = Number.isFinite(Number(options.minimumScore)) ? Number(options.minimumScore) : 0;
  return candidates.filter(Boolean).map(scanCandidate).filter(item => item.valid && item.opportunityScore >= minimumScore).sort((a, b) => b.opportunityScore - a.opportunityScore || b.riskQualityScore - a.riskQualityScore || b.riskRewardRatio - a.riskRewardRatio).map((item, index) => ({ ...item, rank: index + 1 }));
}

export function getExecutableCandidates(candidates = []) {
  return candidates.filter(item => item?.paperOnly === true && item?.realOrderPlaced === false && item?.executable === true);
}

console.log('AI TRADE PRO — signal scanner engine loaded');
