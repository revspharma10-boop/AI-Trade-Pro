// ============================================================
// AI TRADE PRO — STEP 2R TEST RUNNER
// CENTRALIZED RISK CONTROL CONTRACT
// ============================================================
import { evaluateRiskControls, authorizePaperTrade } from './services/riskControlEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}
function base(overrides = {}) {
  return {
    accountCapital: 100000,
    entryPrice: 100,
    stopLoss: 98,
    quantity: 100,
    riskRewardRatio: 2,
    openPositions: 0,
    action: 'LONG',
    decision: 'BUY',
    paperOnly: true,
    realOrderPlaced: false,
    ...overrides
  };
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2R TEST RUNNER');
console.log('CENTRALIZED RISK CONTROL');
console.log('============================================================');

const safe = evaluateRiskControls(base());
assert('Safe trade passes all controls', safe.authorized === true);
assert('Safe trade remains paper-only', safe.paperOnly === true);
assert('Safe trade cannot place real order', safe.realOrderPlaced === false);
assert('Safe trade action is LONG', safe.action === 'LONG');

const highRisk = evaluateRiskControls(base({ quantity: 600 }));
assert('Excessive risk is blocked', highRisk.authorized === false);
assert('Excessive risk records rejection', highRisk.rejectionReasons.includes('RISKPERCENTACCEPTABLE'));

const badRR = evaluateRiskControls(base({ riskRewardRatio: 1 }));
assert('Low risk/reward is blocked', badRR.authorized === false);
assert('Low risk/reward records rejection', badRR.rejectionReasons.includes('RISKREWARDACCEPTABLE'));

const shortBlocked = evaluateRiskControls(base({ action: 'SHORT' }), { allowShorts: false });
assert('Short trades can be disabled', shortBlocked.authorized === false);
assert('Disabled shorts produce NONE action', shortBlocked.action === 'NONE');

const concurrent = evaluateRiskControls(base({ openPositions: 5 }));
assert('Position limit blocks sixth concurrent position', concurrent.authorized === false);

const realOrderAttempt = authorizePaperTrade(base({ realOrderPlaced: true }));
assert('Real-order state is rejected', realOrderAttempt.authorized === false);
assert('Real-order attempt is forced paper-only', realOrderAttempt.paperOnly === true);
assert('No real order is reported', realOrderAttempt.realOrderPlaced === false);

const noCapital = evaluateRiskControls(base({ accountCapital: 0 }));
assert('Unavailable capital blocks authorization', noCapital.authorized === false);

console.log('============================================================');
console.log('STEP 2R TEST RESULT');
console.log('============================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2R TEST SUITE PASSED' : '❌ STEP 2R TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2R COMPLETE');
console.log('============================================================');

export { results, allAssertionsPassed };
