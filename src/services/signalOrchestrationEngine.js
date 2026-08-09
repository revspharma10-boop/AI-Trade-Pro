// ============================================================
// AI TRADE PRO — SIGNAL ORCHESTRATION ENGINE
// STEPS 2W–2Z FOUNDATION
// ============================================================
// Connects watchlist -> scanner -> strategy evaluation.
// PAPER-ONLY. No broker/order placement is performed here.
// ============================================================

import { addToWatchlist, updateWatchlistSignal, getWatchlistSnapshot } from '../watchlistEngine.js';
import { scanCandidate, rankCandidates, getExecutableCandidates } from '../signalScannerEngine.js';
import { evaluateStrategyRules, validateStrategyDefinition } from './strategyDefinitionEngine.js';

function safeSymbol(value) { return typeof value === 'string' ? value.trim().toUpperCase() : ''; }

export function evaluateWatchlistCandidate(watchlist, candidate = {}, strategy = {}) {
  const symbol = safeSymbol(candidate.symbol);
  if (!symbol) return { valid: false, paperOnly: true, realOrderPlaced: false, reason: 'INVALID_SYMBOL' };

  const scanned = scanCandidate({ ...candidate, symbol });
  const strategyCheck = validateStrategyDefinition(strategy);
  const strategyResult = strategyCheck.valid
    ? evaluateStrategyRules(strategy, {
        score: scanned.opportunityScore,
        technicalScore: scanned.technicalScore,
        marketRegimeScore: scanned.marketRegimeScore,
        riskRewardRatio: scanned.riskRewardRatio
      })
    : { valid: false, triggered: false, paperOnly: true, realOrderPlaced: false };

  const executable = scanned.executable === true && strategyResult.triggered === true;
  const rejectionReasons = [...scanned.rejectionReasons];
  if (!strategyCheck.valid) rejectionReasons.push('STRATEGY_INVALID');
  else if (!strategyResult.triggered) rejectionReasons.push('STRATEGY_RULES_NOT_TRIGGERED');

  const result = {
    ...scanned,
    strategyId: strategy.id || '',
    strategyTriggered: strategyResult.triggered === true,
    strategyDirection: strategyResult.direction || 'NONE',
    executable,
    action: executable ? (strategyResult.direction === 'SHORT' ? 'SHORT' : 'LONG') : 'NONE',
    rejectionReasons: [...new Set(rejectionReasons)],
    paperOnly: true,
    realOrderPlaced: false
  };

  if (watchlist?.paperOnly === true) {
    updateWatchlistSignal(watchlist, symbol, {
      opportunityScore: result.opportunityScore,
      recommendation: result.recommendation,
      executable: result.executable,
      action: result.action,
      rejectionReasons: result.rejectionReasons
    });
  }
  return result;
}

export function scanWatchlist(watchlist, marketBySymbol = {}, strategy = {}, options = {}) {
  if (!watchlist || watchlist.paperOnly !== true) {
    return { valid: false, paperOnly: true, realOrderPlaced: false, candidates: [], executableCandidates: [], reason: 'WATCHLIST_MUST_BE_PAPER_ONLY' };
  }
  const candidates = (watchlist.symbols || []).map(item => evaluateWatchlistCandidate(watchlist, { ...(marketBySymbol[item.symbol] || {}), symbol: item.symbol }, strategy));
  const ranked = rankCandidates(candidates, { minimumScore: options.minimumScore ?? 0 });
  const executableCandidates = getExecutableCandidates(ranked);
  return { valid: true, paperOnly: true, realOrderPlaced: false, count: ranked.length, candidates: ranked, executableCandidates, snapshot: getWatchlistSnapshot(watchlist) };
}

export function buildPaperScanReport(watchlist, marketBySymbol = {}, strategy = {}, options = {}) {
  const result = scanWatchlist(watchlist, marketBySymbol, strategy, options);
  return {
    ...result,
    generatedAt: new Date().toISOString(),
    paperOnly: true,
    realOrderPlaced: false,
    realExecutionAuthorized: false
  };
}

console.log('AI TRADE PRO — signal orchestration engine loaded');
