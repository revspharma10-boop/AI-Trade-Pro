// ============================================================
// AI TRADE PRO — STEP 2T TEST RUNNER
// STRATEGY DEFINITION CONTRACT
// ============================================================
import { validateStrategyDefinition, buildStrategyDefinition, evaluateStrategyRules } from './services/strategyDefinitionEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2T TEST RUNNER');
console.log('STRATEGY DEFINITION ENGINE');
console.log('============================================================');

const strategy = {
  id: 'trend-r2',
  name: 'Trend R2 Strategy',
  timeframe: '1day',
  direction: 'BOTH',
  entryRules: [
    { field: 'technical', min: 60 },
    { field: 'marketRegime', min: 50 },
    { field: 'riskReward', min: 2 }
  ],
  exitRules: [{ type: 'stopLossTarget' }],
  minimumRiskReward: 2,
  paperOnly: true
};

const valid = validateStrategyDefinition(strategy);
assert('Valid strategy passes validation', valid.valid === true);
assert('Strategy remains paper-only', valid.paperOnly === true);
assert('No real order is reported', valid.realOrderPlaced === false);

const built = buildStrategyDefinition(strategy);
assert('Strategy builder returns valid definition', built.valid === true);
assert('Strategy receives stable ID', built.strategy.id === 'trend-r2');
assert('Strategy version defaults safely', built.strategy.version === 1);

const triggered = evaluateStrategyRules(strategy, {
  technicalScore: 70,
  marketRegimeScore: 60,
  riskRewardRatio: 2.5
});
assert('Safe market input triggers strategy', triggered.triggered === true);
assert('Triggered strategy remains paper-only', triggered.paperOnly === true);
assert('Triggered strategy places no real order', triggered.realOrderPlaced === false);

const rejected = evaluateStrategyRules(strategy, {
  technicalScore: 50,
  marketRegimeScore: 60,
  riskRewardRatio: 2.5
});
assert('Failed technical rule blocks strategy', rejected.triggered === false);
assert('Blocked strategy has no real order', rejected.realOrderPlaced === false);

const invalid = validateStrategyDefinition({ name: 'Bad' });
assert('Incomplete strategy is rejected', invalid.valid === false);
assert('Invalid strategy remains paper-only', invalid.paperOnly === true);
assert('Invalid strategy cannot place real order', invalid.realOrderPlaced === false);

const realAttempt = validateStrategyDefinition({ ...strategy, paperOnly: false });
assert('Non-paper strategy definition is rejected', realAttempt.valid === false);

console.log('============================================================');
console.log('STEP 2T TEST RESULT');
console.log('============================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2T TEST SUITE PASSED' : '❌ STEP 2T TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2T COMPLETE');
console.log('============================================================');

export { results, allAssertionsPassed };
