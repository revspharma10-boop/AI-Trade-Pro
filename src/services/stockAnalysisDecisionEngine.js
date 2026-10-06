// AI TRADE PRO — STOCK ANALYSIS DECISION CONTRACT
// Fail-closed analysis layer. It never invents a trade when required evidence is missing.

import {
  calculateTechnicalScore,
  calculateFundamentalScore,
  calculateRiskQualityScore,
  buildRecommendation
} from './recommendationEngine.js';

const REQUIRED_TECHNICAL = ['trend','momentum','adx','supertrend','volume','candlestick','chartPattern','supportResistance','vwap','atr'];
const REQUIRED_FUNDAMENTAL = ['revenueGrowth','profitGrowth','profitability','roeRoce','debt','cashFlow','valuation','earningsConsistency','businessSector','riskFlags'];

const finite = v => Number.isFinite(Number(v));
const complete = (obj, keys) => obj && keys.every(k => finite(obj[k]));

function waitResult(symbol, reasons) {
  return Object.freeze({
    symbol: String(symbol || '').trim().toUpperCase(),
    recommendation: 'WAIT',
    confidence: 0,
    status: 'INSUFFICIENT_DATA',
    entryZone: null,
    stopLoss: null,
    targets: [],
    riskRewardRatio: 0,
    technicalScore: null,
    fundamentalScore: null,
    marketRegimeScore: null,
    riskQualityScore: null,
    technicalEvidence: [],
    fundamentalEvidence: [],
    invalidation: 'No paper trade until complete, fresh technical and fundamental evidence is available.',
    reasons,
    paperEligible: false,
    paperOnly: true,
    realOrderPlaced: false
  });
}

export function buildStockAnalysisDecision(input = {}) {
  const symbol = String(input.symbol || '').trim().toUpperCase();
  const reasons = [];
  if (!symbol) reasons.push('SYMBOL_REQUIRED');
  if (!input.marketDataFresh) reasons.push('MARKET_DATA_MISSING_OR_STALE');
  if (!complete(input.technicalScores, REQUIRED_TECHNICAL)) reasons.push('TECHNICAL_EVIDENCE_INCOMPLETE');
  if (!complete(input.fundamentalScores, REQUIRED_FUNDAMENTAL)) reasons.push('FUNDAMENTAL_EVIDENCE_INCOMPLETE');
  if (!finite(input.marketRegimeScore)) reasons.push('MARKET_REGIME_MISSING');
  const entryLow = Number(input.entryZone?.low);
  const entryHigh = Number(input.entryZone?.high);
  const stopLoss = Number(input.stopLoss);
  const targets = Array.isArray(input.targets) ? input.targets.map(Number).filter(Number.isFinite) : [];
  if (!(entryLow > 0 && entryHigh >= entryLow)) reasons.push('ENTRY_ZONE_INVALID');
  if (!(stopLoss > 0)) reasons.push('STOP_LOSS_INVALID');
  if (!targets.length) reasons.push('TARGET_REQUIRED');
  if (reasons.length) return waitResult(symbol, reasons);

  const technicalScore = calculateTechnicalScore(input.technicalScores);
  const fundamentalScore = calculateFundamentalScore(input.fundamentalScores);
  const riskRewardRatio = Number(input.riskRewardRatio) || 0;
  const riskGates = {
    dataValid: true,
    liquidityAcceptable: input.riskGates?.liquidityAcceptable === true,
    technicalConfirmation: input.riskGates?.technicalConfirmation === true,
    stopLossValid: input.riskGates?.stopLossValid === true,
    volatilityAcceptable: input.riskGates?.volatilityAcceptable === true,
    marketRegimeAcceptable: input.riskGates?.marketRegimeAcceptable === true,
    riskRewardAcceptable: riskRewardRatio >= 1.5
  };
  const riskQualityScore = calculateRiskQualityScore(riskGates, riskRewardRatio);
  const result = buildRecommendation({
    symbol, technicalScore, fundamentalScore,
    marketRegimeScore: Number(input.marketRegimeScore),
    riskQualityScore, riskRewardRatio, riskGates
  });
  const executable = ['BUY','STRONG BUY'].includes(result.recommendation) && result.riskGatesPassed;
  return {
    ...result,
    recommendation: executable ? result.recommendation : 'WAIT',
    confidence: executable ? Math.round(result.opportunityScore) : 0,
    status: executable ? 'QUALIFIED' : 'WAIT',
    entryZone: { low: entryLow, high: entryHigh },
    stopLoss,
    targets,
    technicalEvidence: Array.isArray(input.technicalEvidence) ? input.technicalEvidence : [],
    fundamentalEvidence: Array.isArray(input.fundamentalEvidence) ? input.fundamentalEvidence : [],
    invalidation: String(input.invalidation || 'Setup invalid if the stop-loss or stated technical thesis is breached.'),
    paperEligible: executable,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function assertStockAnalysisDecisionSafe(result = {}) {
  return result.paperOnly === true && result.realOrderPlaced === false &&
    (result.paperEligible !== true || (['BUY','STRONG BUY'].includes(result.recommendation) && result.riskGatesPassed === true));
}
