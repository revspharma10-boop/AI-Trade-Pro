// AI TRADE PRO — STEP 2BK–2BT TEST RUNNER
import { scanUniverse, rankScanResults, getPaperExecutionQueue, buildScannerSnapshot } from './multiSymbolScannerEngine.js';

const results = [];
const assert = (name, condition) => { const passed = Boolean(condition); results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); };

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2BK–2BT TEST RUNNER');
console.log('MULTI-SYMBOL PORTFOLIO-AWARE SCANNER');
console.log('============================================================');

const portfolio = { openPositions: 1, positions: [{ symbol: 'INFY:NSE' }] };
const candidates = [
  { symbol: 'TCS:NSE', opportunityScore: 88, riskQualityScore: 90, riskRewardRatio: 2.4, riskGatesPassed: true, recommendation: 'BUY' },
  { symbol: 'RELIANCE:NSE', opportunityScore: 82, riskQualityScore: 86, riskRewardRatio: 2.0, riskGatesPassed: true, recommendation: 'SELL' },
  { symbol: 'INFY:NSE', opportunityScore: 95, riskQualityScore: 95, riskRewardRatio: 3, riskGatesPassed: true, recommendation: 'BUY' },
  { symbol: 'HDFCBANK:NSE', opportunityScore: 60, riskQualityScore: 90, riskRewardRatio: 2, riskGatesPassed: true, recommendation: 'BUY' },
  { symbol: 'ITC:NSE', opportunityScore: 78, riskQualityScore: 80, riskRewardRatio: 1.2, riskGatesPassed: true, recommendation: 'BUY' },
  { symbol: 'SBIN:NSE', opportunityScore: 81, riskQualityScore: 80, riskRewardRatio: 1.8, riskGatesPassed: false, recommendation: 'BUY' },
  { symbol: 'TCS:NSE', opportunityScore: 70, riskQualityScore: 70, riskRewardRatio: 2, riskGatesPassed: true, recommendation: 'BUY' }
];

const scanned = scanUniverse(candidates, portfolio);
assert('Scanner returns one result per unique symbol', scanned.length === 6);
assert('Symbols are normalized', scanned.every(x => x.symbol === x.symbol.toUpperCase()));
assert('Already-open symbol is blocked', scanned.find(x => x.symbol === 'INFY:NSE')?.rejectionReasons.includes('ALREADY_OPEN'));
assert('Low-score candidate is blocked', scanned.find(x => x.symbol === 'HDFCBANK:NSE')?.rejectionReasons.includes('SCORE_BELOW_MINIMUM'));
assert('Low risk/reward candidate is blocked', scanned.find(x => x.symbol === 'ITC:NSE')?.rejectionReasons.includes('RISK_REWARD_BELOW_MINIMUM'));
assert('Failed risk gates block candidate', scanned.find(x => x.symbol === 'SBIN:NSE')?.rejectionReasons.includes('RISK_GATES_FAILED'));
assert('Blocked candidates are non-executable', scanned.filter(x => !x.executable).every(x => x.realOrderPlaced === false));

const ranked = rankScanResults(scanned, { maxCandidates: 10 });
assert('Only executable candidates enter ranking', ranked.length === 2);
assert('Highest score ranks first', ranked[0]?.symbol === 'TCS:NSE');
assert('Second candidate ranks correctly', ranked[1]?.symbol === 'RELIANCE:NSE');
assert('Ranks are sequential', ranked.every((x, i) => x.rank === i + 1));
assert('Existing position never enters executable queue', ranked.every(x => x.symbol !== 'INFY:NSE'));

const queue = getPaperExecutionQueue(scanned);
assert('Paper execution queue contains only safe candidates', queue.length === 2);
assert('Queue is paper-only', queue.every(x => x.paperOnly === true));
assert('Queue contains zero real orders', queue.every(x => x.realOrderPlaced === false));
assert('Queue candidates are executable', queue.every(x => x.executable === true));
assert('Queue directions are BUY or SELL', queue.every(x => ['BUY', 'SELL'].includes(x.recommendation)));

const snapshot = buildScannerSnapshot(scanned, ranked);
assert('Scanner snapshot is valid', snapshot.valid === true);
assert('Snapshot reports scanned count', snapshot.scanned === 6);
assert('Snapshot reports executable count', snapshot.executable === 2);
assert('Snapshot reports blocked count', snapshot.blocked === 4);
assert('Snapshot remains paper-only', snapshot.paperOnly === true && snapshot.realOrderPlaced === false);

console.log('============================================================');
console.log('STEP 2BK–2BT SUMMARY');
console.table({ Scanned: snapshot.scanned, Executable: snapshot.executable, Blocked: snapshot.blocked, RankedSymbols: snapshot.symbols.join(', '), PaperOnly: snapshot.paperOnly, RealOrderPlaced: snapshot.realOrderPlaced });
console.log('============================================================');
const passed = results.filter(x => x.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2BK–2BT BULK TEST SUITE PASSED' : '❌ STEP 2BK–2BT BULK TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2BK–2BT COMPLETE');
console.log('============================================================');
export { results, snapshot, allAssertionsPassed };
