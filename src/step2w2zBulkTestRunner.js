// ============================================================
// AI TRADE PRO — STEPS 2W–2Z BULK TEST RUNNER
// WATCHLIST -> SCANNER -> STRATEGY -> PAPER REPORT
// ============================================================
import { createWatchlist, addToWatchlist } from './watchlistEngine.js';
import { scanCandidate, rankCandidates } from './signalScannerEngine.js';
import { buildStrategyDefinition } from './services/strategyDefinitionEngine.js';
import { evaluateWatchlistCandidate, scanWatchlist, buildPaperScanReport } from './services/signalOrchestrationEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEPS 2W–2Z BULK TEST RUNNER');
console.log('WATCHLIST / SCANNER / STRATEGY / PAPER REPORT');
console.log('============================================================');

// ------------------------------------------------------------
// STEP 2W — WATCHLIST -> SCANNER CONTRACT
// ------------------------------------------------------------
console.log('STEP 2W — WATCHLIST -> SCANNER');
const watchlist = createWatchlist({ id: 'WL-BULK-001', name: 'AI Trade Pro Core' });
assert('2W watchlist is paper-only', watchlist.paperOnly === true);
assert('2W symbol add succeeds', addToWatchlist(watchlist, 'INFY:NSE').added === true);
assert('2W duplicate remains one symbol', addToWatchlist(watchlist, 'infy:nse').added === false && watchlist.symbols.length === 1);

const candidate = scanCandidate({
  symbol: 'INFY:NSE', opportunityScore: 82, riskQualityScore: 90,
  technicalScore: 78, fundamentalScore: 75, marketRegimeScore: 70,
  riskRewardRatio: 2, riskGatesPassed: true, recommendation: 'BUY'
});
assert('2W scanner returns valid candidate', candidate.valid === true);
assert('2W scanner remains paper-only', candidate.paperOnly === true && candidate.realOrderPlaced === false);
assert('2W safe candidate is executable before strategy filter', candidate.executable === true);

// ------------------------------------------------------------
// STEP 2X — STRATEGY FILTER
// ------------------------------------------------------------
console.log('STEP 2X — STRATEGY FILTER');
const strategy = buildStrategyDefinition({
  id: 'core-trend-r1', name: 'Core Trend R1', timeframe: '1day', direction: 'BOTH',
  entryRules: [
    { field: 'technical', min: 70 },
    { field: 'marketRegime', min: 60 },
    { field: 'riskReward', min: 1.8 }
  ],
  exitRules: [{ type: 'stopLossTarget' }], minimumRiskReward: 1.8, paperOnly: true
});
assert('2X strategy is valid', strategy.valid === true);
const evaluated = evaluateWatchlistCandidate(watchlist, candidate, strategy.strategy);
assert('2X strategy triggers safe candidate', evaluated.strategyTriggered === true);
assert('2X strategy result remains paper-only', evaluated.paperOnly === true && evaluated.realOrderPlaced === false);
assert('2X safe candidate remains executable', evaluated.executable === true);
assert('2X safe candidate action is LONG', evaluated.action === 'LONG');

const blocked = evaluateWatchlistCandidate(watchlist, { ...candidate, technicalScore: 40 }, strategy.strategy);
assert('2X failed strategy rule blocks candidate', blocked.executable === false);
assert('2X blocked candidate has no action', blocked.action === 'NONE');
assert('2X blocked candidate records rejection', blocked.rejectionReasons.includes('STRATEGY_RULES_NOT_TRIGGERED'));

// ------------------------------------------------------------
// STEP 2Y — BATCH WATCHLIST SCAN / RANKING
// ------------------------------------------------------------
console.log('STEP 2Y — BATCH SCAN / RANKING');
addToWatchlist(watchlist, 'TCS:NSE');
addToWatchlist(watchlist, 'RELIANCE:NSE');
const marketBySymbol = {
  'INFY:NSE': candidate,
  'TCS:NSE': { ...candidate, symbol: 'TCS:NSE', opportunityScore: 91, technicalScore: 88 },
  'RELIANCE:NSE': { ...candidate, symbol: 'RELIANCE:NSE', opportunityScore: 55, technicalScore: 50 }
};
const batch = scanWatchlist(watchlist, marketBySymbol, strategy.strategy, { minimumScore: 0 });
assert('2Y batch scan is valid', batch.valid === true);
assert('2Y batch remains paper-only', batch.paperOnly === true && batch.realOrderPlaced === false);
assert('2Y batch returns all watchlist candidates', batch.candidates.length === 3);
assert('2Y candidates are ranked', batch.candidates[0]?.rank === 1 && batch.candidates[1]?.rank === 2);
assert('2Y ranking is descending by opportunity score', batch.candidates[0].opportunityScore >= batch.candidates[1].opportunityScore);
assert('2Y executable list contains only safe candidates', batch.executableCandidates.every(item => item.paperOnly && !item.realOrderPlaced && item.executable));

// ------------------------------------------------------------
// STEP 2Z — PAPER REPORT / SAFETY CONTRACT
// ------------------------------------------------------------
console.log('STEP 2Z — PAPER REPORT / SAFETY');
const report = buildPaperScanReport(watchlist, marketBySymbol, strategy.strategy);
assert('2Z report is valid', report.valid === true);
assert('2Z report is explicitly paper-only', report.paperOnly === true);
assert('2Z report reports no real order', report.realOrderPlaced === false);
assert('2Z real execution is never authorized', report.realExecutionAuthorized === false);
assert('2Z snapshot exists', report.snapshot?.valid === true);
assert('2Z executable candidates remain paper-only', report.executableCandidates.every(item => item.paperOnly === true && item.realOrderPlaced === false));

console.log('============================================================');
console.log('STEPS 2W–2Z BULK SUMMARY');
console.log('============================================================');
console.table({
  WatchlistSymbols: watchlist.symbols.length,
  RankedCandidates: report.candidates?.length ?? 0,
  ExecutableCandidates: report.executableCandidates?.length ?? 0,
  PaperOnly: report.paperOnly,
  RealOrderPlaced: report.realOrderPlaced,
  RealExecutionAuthorized: report.realExecutionAuthorized
});

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.log('============================================================');
console.log('STEPS 2W–2Z BULK TEST RESULT');
console.log('============================================================');
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEPS 2W–2Z BULK TEST SUITE PASSED' : '❌ STEPS 2W–2Z BULK TEST SUITE FAILED');
console.log('============================================================');

export { results, allAssertionsPassed, report };
