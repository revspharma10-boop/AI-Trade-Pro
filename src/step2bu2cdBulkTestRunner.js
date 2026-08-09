import {
  validateScannerCandidate,
  allocateScannerCandidates,
  buildScannerCycle,
  assertPaperSafeCycle
} from './scannerOrchestrationEngine.js';

const results = [];
function test(name, condition) {
  const passed = Boolean(condition);
  results.push({ name, passed });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2BU–2CD TEST RUNNER');
console.log('SCANNER ORCHESTRATION / PAPER SAFETY');
console.log('============================================================');

const safe = { symbol:'INFY:NSE', recommendation:'BUY', opportunityScore:88, riskRewardRatio:2.4, riskGatesPassed:true, riskQualityScore:90 };
const safeSell = { symbol:'TCS:NSE', recommendation:'SELL', opportunityScore:81, riskRewardRatio:2.1, riskGatesPassed:true, riskQualityScore:85 };
const weak = { symbol:'ITC:NSE', recommendation:'BUY', opportunityScore:60, riskRewardRatio:2, riskGatesPassed:true };

const cycle = buildScannerCycle([safe, safeSell, safe, weak], { positions:[], capitalUtilizationPercent:20 });
const duplicate = allocateScannerCandidates([safe, safe], {});
const open = allocateScannerCandidates([safe], { positions:[{symbol:'INFY:NSE'}] });
const blocked = allocateScannerCandidates([{...safe, riskGatesPassed:false}], {});

// Validation
 test('Valid BUY candidate passes validation', validateScannerCandidate(safe).valid);
 test('Invalid score is rejected', !validateScannerCandidate(weak).valid);
 test('Failed risk gates are rejected', !validateScannerCandidate({...safe, riskGatesPassed:false}).valid);
 test('Invalid recommendation is rejected', !validateScannerCandidate({...safe, recommendation:'WATCH / WAIT'}).valid);

// Selection
 test('Safe candidates are ranked', cycle.candidates.length === 2);
 test('Highest score receives rank 1', cycle.candidates[0]?.symbol === 'INFY:NSE');
 test('Duplicate symbol is rejected', duplicate.rejected[0]?.rejectionReasons.includes('DUPLICATE_SYMBOL'));
 test('Already-open symbol is rejected', open.rejected[0]?.rejectionReasons.includes('ALREADY_OPEN'));
 test('Failed risk gates stay rejected', blocked.rejected[0]?.rejectionReasons.includes('RISK_GATES_FAILED'));
 test('Rejected candidate is not executable', blocked.rejected[0]?.executable === false);

// Safety
 test('Cycle is paper-only', cycle.paperOnly === true);
 test('Cycle reports no real order', cycle.realOrderPlaced === false);
 test('Paper queue contains no real orders', cycle.paperExecutionQueue.every(x => x.realOrderPlaced === false));
 test('Paper queue is executable-ready only', cycle.paperExecutionQueue.every(x => x.orderStatus === 'PAPER_READY'));
 test('Paper safety assertion passes', assertPaperSafeCycle(cycle));

// Capital protection: use a realistic portfolio already above the configured limit.
const capitalBlocked = buildScannerCycle([safe], { capitalUtilizationPercent: 100 });
test('Capital utilization limit blocks candidate', capitalBlocked.rejected[0]?.rejectionReasons.includes('CAPITAL_UTILIZATION_LIMIT'));
test('Capital-blocked candidate cannot enter paper queue', capitalBlocked.paperExecutionQueue.length === 0);

const passed = results.filter(x => x.passed).length;
const failed = results.length - passed;
console.log('============================================================');
console.log('STEP 2BU–2CD TEST RESULT');
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: failed === 0, SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED' });
console.log('============================================================');
export const allAssertionsPassed = failed === 0;
export { results };
