// AI TRADE PRO — STEP 2CE–2CN TEST RUNNER
// PORTFOLIO RISK CONTROL / PAPER SAFETY

import { evaluateRiskControls, canStagePaperOrder, resetDailyRisk } from './riskControlEngine.js';

const results = [];
function test(name, condition) {
  const passed = Boolean(condition);
  results.push({ name, passed });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2CE–2CN TEST RUNNER');
console.log('PORTFOLIO RISK CONTROL / PAPER SAFETY');
console.log('============================================================');

const safe = evaluateRiskControls({ accountCapital: 100000, cash: 60000, grossExposure: 40000, dailyRealizedPnL: 500, openPositions: 2 });
test('Safe portfolio passes risk controls', safe.safe === true);
test('Safe portfolio is executable-ready', safe.executable === true);
test('Safe portfolio remains paper-only', safe.paperOnly === true);
test('Safe portfolio reports no real order', safe.realOrderPlaced === false);
test('Exposure percent is calculated correctly', safe.exposurePercent === 40);
test('Daily loss percent is zero for positive P&L', safe.dailyLossPercent === 0);

const exposureBlocked = evaluateRiskControls({ accountCapital: 100000, cash: 20000, grossExposure: 80000, dailyRealizedPnL: 0, openPositions: 2 });
test('Excess exposure is blocked', exposureBlocked.safe === false);
test('Exposure rejection reason is recorded', exposureBlocked.rejectionReasons.includes('MAX_EXPOSURE_EXCEEDED'));
test('Exposure-blocked state cannot stage paper order', canStagePaperOrder({ accountCapital: 100000, cash: 20000, grossExposure: 80000, dailyRealizedPnL: 0, openPositions: 2 }).stageAllowed === false);

test('Daily loss limit blocks unsafe continuation', evaluateRiskControls({ accountCapital: 100000, cash: 70000, grossExposure: 30000, dailyRealizedPnL: -2500, openPositions: 1 }).rejectionReasons.includes('DAILY_LOSS_LIMIT_EXCEEDED'));
test('Daily loss block remains non-executable', evaluateRiskControls({ accountCapital: 100000, cash: 70000, grossExposure: 30000, dailyRealizedPnL: -2500, openPositions: 1 }).executable === false);

test('Maximum open positions is enforced', evaluateRiskControls({ accountCapital: 100000, cash: 60000, grossExposure: 40000, dailyRealizedPnL: 0, openPositions: 6 }).rejectionReasons.includes('MAX_OPEN_POSITIONS_EXCEEDED'));
test('Minimum cash buffer is enforced', evaluateRiskControls({ accountCapital: 100000, cash: 5000, grossExposure: 50000, dailyRealizedPnL: 0, openPositions: 2 }).rejectionReasons.includes('MIN_CASH_BUFFER_BREACHED'));

test('Multiple risk breaches are all reported', (() => {
  const r = evaluateRiskControls({ accountCapital: 100000, cash: 5000, grossExposure: 80000, dailyRealizedPnL: -3000, openPositions: 6 });
  return r.rejectionReasons.length === 4 && r.safe === false;
})());

test('Reset clears daily realized risk', resetDailyRisk({ dailyRealizedPnL: -2500, dailyLossPercent: 2.5 }).dailyRealizedPnL === 0);
test('Reset clears daily loss percent', resetDailyRisk({ dailyRealizedPnL: -2500, dailyLossPercent: 2.5 }).dailyLossPercent === 0);
test('Reset remains paper-only', resetDailyRisk({ dailyRealizedPnL: -2500 }).paperOnly === true);
test('Reset reports no real order', resetDailyRisk({ dailyRealizedPnL: -2500 }).realOrderPlaced === false);

const invalid = evaluateRiskControls({ accountCapital: -1, cash: -10, grossExposure: 0, dailyRealizedPnL: 0, openPositions: 0 });
test('Negative account values are rejected as invalid', invalid.valid === false);
test('Invalid state remains paper-only', invalid.paperOnly === true);
test('Invalid state reports no real order', invalid.realOrderPlaced === false);

const summary = {
  SafePortfolio: safe.safe,
  ExposureBlocked: exposureBlocked.safe === false,
  ExposurePercent: exposureBlocked.exposurePercent,
  DailyLossBlocked: evaluateRiskControls({ accountCapital: 100000, cash: 70000, grossExposure: 30000, dailyRealizedPnL: -2500, openPositions: 1 }).safe === false,
  PaperOnly: true,
  RealOrderPlaced: false
};
console.log('============================================================');
console.log('STEP 2CE–2CN RISK CONTROL SUMMARY');
console.table(summary);

const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.log('============================================================');
console.log('STEP 2CE–2CN TEST RESULT');
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2CE–2CN BULK TEST SUITE PASSED' : '❌ STEP 2CE–2CN BULK TEST SUITE FAILED');
console.log('============================================================');

export { results, allAssertionsPassed };
