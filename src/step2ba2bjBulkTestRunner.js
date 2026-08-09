// AI TRADE PRO — STEP 2BA–2BJ
// Bulk integration tests: risk dashboard + signal scanner contract

import { buildRiskDashboard, isRiskDashboardSafe } from './riskDashboardEngine.js';
import { scanCandidate, rankCandidates, getExecutableCandidates } from './signalScannerEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2BA–2BJ BULK TEST RUNNER');
console.log('RISK DASHBOARD + SIGNAL SCANNER INTEGRATION');
console.log('============================================================');

const flat = buildRiskDashboard({ accountCapital: 100000, cash: 100000, positions: [], journalSummary: { netPnL: 0 } });
assert('Flat dashboard is valid', flat.valid === true);
assert('Flat dashboard is paper-only', flat.paperOnly === true);
assert('Flat dashboard reports no real order', flat.realOrderPlaced === false);
assert('Flat dashboard reports FLAT state', flat.riskState === 'FLAT');
assert('Flat dashboard has zero exposure', flat.grossExposure === 0);
assert('Flat dashboard is safe', isRiskDashboardSafe(flat) === true);

const exposed = buildRiskDashboard({
  accountCapital: 100000,
  cash: 58000,
  positions: [
    { symbol: 'INFY:NSE', side: 'BUY', entryPrice: 1000, currentPrice: 1025, quantity: 20 },
    { symbol: 'TCS:NSE', side: 'SHORT', entryPrice: 2000, currentPrice: 1975, quantity: 10 }
  ],
  journalSummary: { netPnL: 500 }
});
assert('Exposed dashboard counts positions', exposed.openPositions === 2);
assert('Exposure is calculated correctly', exposed.grossExposure === 40000);
assert('Exposure percent is calculated correctly', exposed.exposurePercent === 40);
assert('Unrealized P&L is calculated correctly', exposed.unrealizedPnL === 750);
assert('Total P&L combines realized and unrealized', exposed.totalPnL === 1250);
assert('Exposed dashboard remains paper-only', exposed.paperOnly === true && exposed.realOrderPlaced === false);
assert('Exposed dashboard remains safe', isRiskDashboardSafe(exposed) === true);

const safeBuy = scanCandidate({
  symbol: 'INFY:NSE', opportunityScore: 82, riskQualityScore: 90,
  technicalScore: 84, fundamentalScore: 76, marketRegimeScore: 78,
  riskRewardRatio: 2, riskGatesPassed: true, recommendation: 'BUY'
});
assert('Safe BUY candidate is valid', safeBuy.valid === true);
assert('Safe BUY candidate is paper-only', safeBuy.paperOnly === true && safeBuy.realOrderPlaced === false);
assert('Safe BUY candidate is executable', safeBuy.executable === true);
assert('Safe BUY candidate has no rejection reasons', safeBuy.rejectionReasons.length === 0);

const blocked = scanCandidate({
  symbol: 'BAD:NSE', opportunityScore: 60, riskQualityScore: 40,
  riskRewardRatio: 1.2, riskGatesPassed: false, recommendation: 'BUY'
});
assert('Unsafe candidate is non-executable', blocked.executable === false);
assert('Unsafe candidate remains paper-only', blocked.paperOnly === true && blocked.realOrderPlaced === false);
assert('Unsafe candidate records gate failure', blocked.rejectionReasons.includes('RISK_GATES_FAILED'));
assert('Unsafe candidate records low score', blocked.rejectionReasons.includes('OPPORTUNITY_SCORE_BELOW_SCAN_THRESHOLD'));
assert('Unsafe candidate records low risk/reward', blocked.rejectionReasons.includes('RISK_REWARD_BELOW_MINIMUM'));

const ranked = rankCandidates([
  safeBuy,
  { symbol: 'TCS:NSE', opportunityScore: 88, riskQualityScore: 80, riskRewardRatio: 2.2, riskGatesPassed: true, recommendation: 'SELL' },
  blocked,
  { symbol: 'RELIANCE:NSE', opportunityScore: 70, riskQualityScore: 95, riskRewardRatio: 1.6, riskGatesPassed: true, recommendation: 'WATCH / WAIT' }
], { minimumScore: 65 });
assert('Ranked candidates are returned', ranked.length === 3);
assert('Highest opportunity score ranks first', ranked[0]?.symbol === 'TCS:NSE' && ranked[0]?.rank === 1);
assert('Ranks are sequential', ranked.every((item, index) => item.rank === index + 1));
assert('Low-score candidate is excluded from ranking', ranked.every(item => item.symbol !== 'BAD:NSE'));

const executable = getExecutableCandidates(ranked);
assert('Executable candidate filter returns only safe BUY/SELL', executable.length === 2);
assert('Executable candidates contain no real orders', executable.every(item => item.paperOnly === true && item.realOrderPlaced === false));
assert('Executable candidates are actually executable', executable.every(item => item.executable === true));

const summary = {
  dashboardOpenPositions: exposed.openPositions,
  grossExposure: exposed.grossExposure,
  exposurePercent: exposed.exposurePercent,
  unrealizedPnL: exposed.unrealizedPnL,
  totalPnL: exposed.totalPnL,
  rankedCandidates: ranked.length,
  executableCandidates: executable.length,
  paperOnly: true,
  realOrderPlaced: false
};

console.log('============================================================');
console.log('STEP 2BA–2BJ SUMMARY');
console.table(summary);
console.log('============================================================');

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.log('STEP 2BA–2BJ TEST RESULT');
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2BA–2BJ BULK TEST SUITE PASSED' : '❌ STEP 2BA–2BJ BULK TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2BA–2BJ COMPLETE');
console.log('============================================================');

export { results, summary, allAssertionsPassed };
