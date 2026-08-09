// ============================================================
// AI TRADE PRO — STEP 2AE–2AJ BULK TEST RUNNER
// ADVANCED STRATEGY ENGINE
// ============================================================
import {
  calculateRiskReward,
  calculatePositionSize,
  buildTradeLevels,
  evaluateEntryConditions,
  evaluateExitConditions,
  validateAdvancedStrategy,
  evaluateAdvancedStrategy
} from './services/advancedStrategyEngine.js';

const results = [];
function assert(name, condition, details = '') {
  const passed = Boolean(condition);
  results.push({ name, passed, details });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2AE–2AJ BULK TEST RUNNER');
console.log('ADVANCED STRATEGY ENGINE');
console.log('============================================================');

const strategy = {
  id: 'trend-r3', name: 'Trend R3', timeframe: '1day', direction: 'LONG',
  entryRules: [
    { field: 'technicalScore', min: 60 },
    { field: 'marketRegimeScore', min: 50 },
    { field: 'riskRewardRatio', min: 2 }
  ],
  exitRules: [{ type: 'stopLossTarget' }], minimumRiskReward: 2, paperOnly: true
};

const validation = validateAdvancedStrategy(strategy);
assert('Valid advanced strategy passes validation', validation.valid === true);
assert('Advanced strategy is paper-only', validation.paperOnly === true);
assert('Advanced strategy places no real order', validation.realOrderPlaced === false);
assert('Validation rejection list is empty', validation.rejectionReasons.length === 0);

const rr = calculateRiskReward({ entry: 100, stopLoss: 95, target: 110 });
assert('Risk/reward calculation is valid', rr.valid === true);
assert('Risk/reward ratio equals 2', rr.ratio === 2);
assert('Risk equals 5', rr.risk === 5);
assert('Reward equals 10', rr.reward === 10);

const levels = buildTradeLevels({ direction: 'LONG', entry: 100, stopLoss: 95, riskReward: 2 });
assert('Trade levels build successfully', levels.valid === true);
assert('Long target is generated at 110', levels.target === 110);
assert('Long stop remains below entry', levels.stopLoss < levels.entry);
assert('Generated levels preserve risk/reward', levels.riskReward === 2);

const shortLevels = buildTradeLevels({ direction: 'SHORT', entry: 100, stopLoss: 105, riskReward: 2 });
assert('Short trade levels build successfully', shortLevels.valid === true);
assert('Short target is generated at 90', shortLevels.target === 90);
assert('Short stop remains above entry', shortLevels.stopLoss > shortLevels.entry);

const size = calculatePositionSize({ capital: 100000, riskPercent: 1, entry: 100, stopLoss: 95, maxCapitalPercent: 20 });
assert('Safe position sizing is valid', size.valid === true);
assert('Position quantity respects risk and capital caps', size.quantity === 200);
assert('Capital utilization stays within configured cap', size.capitalUtilizationPercent <= 20);
assert('Risk amount is 1000', size.riskAmount === 1000);

const noSize = calculatePositionSize({ capital: 0, riskPercent: 1, entry: 100, stopLoss: 95 });
assert('Invalid capital blocks position sizing', noSize.valid === false);
assert('Invalid capital produces zero quantity', noSize.quantity === 0);

const entryGood = evaluateEntryConditions({ strategy, market: { technicalScore: 70, marketRegimeScore: 60, riskRewardRatio: 2.5 } });
assert('All entry rules pass', entryGood.triggered === true);
assert('Entry condition count matches rules', entryGood.conditions.length === 3);

const entryBad = evaluateEntryConditions({ strategy, market: { technicalScore: 50, marketRegimeScore: 60, riskRewardRatio: 2.5 } });
assert('Failed technical rule blocks entry', entryBad.triggered === false);
assert('Entry failure is represented in conditions', entryBad.conditions.includes(false));

const longHold = evaluateExitConditions({ direction: 'LONG', price: 102, stopLoss: 95, target: 110 });
assert('Long position remains open between levels', longHold.exit === false);
assert('Long hold reason is HOLD', longHold.reason === 'HOLD');

const longStop = evaluateExitConditions({ direction: 'LONG', price: 94, stopLoss: 95, target: 110 });
assert('Long stop loss triggers exit', longStop.exit === true);
assert('Long stop loss reason is STOP_LOSS', longStop.reason === 'STOP_LOSS');

const longTarget = evaluateExitConditions({ direction: 'LONG', price: 111, stopLoss: 95, target: 110 });
assert('Long target triggers exit', longTarget.exit === true);
assert('Long target reason is TARGET', longTarget.reason === 'TARGET');

const shortTarget = evaluateExitConditions({ direction: 'SHORT', price: 89, stopLoss: 105, target: 90 });
assert('Short target triggers exit', shortTarget.exit === true);
assert('Short target reason is TARGET', shortTarget.reason === 'TARGET');

const safe = evaluateAdvancedStrategy({
  strategy,
  market: { technicalScore: 70, marketRegimeScore: 60, riskRewardRatio: 2.5 },
  trade: { entry: 100, stopLoss: 95, target: 110 },
  account: { capital: 100000, riskPercent: 1, maxCapitalPercent: 20 }
});
assert('Safe strategy evaluation is valid', safe.valid === true);
assert('Safe strategy triggers', safe.triggered === true);
assert('Safe strategy decision is BUY', safe.decision === 'BUY');
assert('Safe strategy action is LONG', safe.action === 'LONG');
assert('Safe strategy remains non-executable', safe.executable === false);
assert('Safe strategy remains paper-only', safe.paperOnly === true);
assert('Safe strategy reports no real order', safe.realOrderPlaced === false);
assert('Safe strategy has no rejection reasons', safe.rejectionReasons.length === 0);

const lowScore = evaluateAdvancedStrategy({
  strategy,
  market: { technicalScore: 40, marketRegimeScore: 60, riskRewardRatio: 2.5 },
  trade: { entry: 100, stopLoss: 95, target: 110 },
  account: { capital: 100000, riskPercent: 1, maxCapitalPercent: 20 }
});
assert('Failed entry strategy produces NO TRADE', lowScore.decision === 'NO TRADE');
assert('Failed entry strategy has no action', lowScore.action === 'NONE');
assert('Failed entry strategy is non-executable', lowScore.executable === false);
assert('Failed entry strategy reports ENTRY_RULES_FAILED', lowScore.rejectionReasons.includes('ENTRY_RULES_FAILED'));

const badRR = evaluateAdvancedStrategy({
  strategy,
  market: { technicalScore: 70, marketRegimeScore: 60, riskRewardRatio: 1 },
  trade: { entry: 100, stopLoss: 95, target: 103 },
  account: { capital: 100000, riskPercent: 1, maxCapitalPercent: 20 }
});
assert('Low risk/reward blocks strategy', badRR.decision === 'NO TRADE');
assert('Low risk/reward reports rejection', badRR.rejectionReasons.includes('RISK_REWARD_FAILED'));
assert('Low risk/reward remains non-executable', badRR.executable === false);

const noCapital = evaluateAdvancedStrategy({
  strategy,
  market: { technicalScore: 70, marketRegimeScore: 60, riskRewardRatio: 2.5 },
  trade: { entry: 100, stopLoss: 95, target: 110 },
  account: { capital: 0, riskPercent: 1, maxCapitalPercent: 20 }
});
assert('Unavailable capital blocks strategy', noCapital.decision === 'NO TRADE');
assert('Unavailable capital reports position-size rejection', noCapital.rejectionReasons.includes('POSITION_SIZE_FAILED'));
assert('Unavailable capital remains non-executable', noCapital.executable === false);

const invalid = validateAdvancedStrategy({ direction: 'LONG', paperOnly: false });
assert('Incomplete strategy is rejected', invalid.valid === false);
assert('Non-paper strategy is rejected', invalid.checks.paperOnly === false);
assert('Invalid strategy cannot place real order', invalid.realOrderPlaced === false);

const invalidEval = evaluateAdvancedStrategy({ strategy: { direction: 'LONG', paperOnly: false } });
assert('Invalid strategy evaluation is blocked', invalidEval.decision === 'NO TRADE');
assert('Invalid strategy evaluation is non-executable', invalidEval.executable === false);
assert('Invalid strategy evaluation remains paper-only', invalidEval.paperOnly === true);

console.log('============================================================');
console.log('STEP 2AE–2AJ TEST RESULT');
console.log('============================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });
console.log(allAssertionsPassed ? '✅ STEP 2AE–2AJ BULK TEST SUITE PASSED' : '❌ STEP 2AE–2AJ BULK TEST SUITE FAILED');
console.log('============================================================');
console.log('STEP 2AE–2AJ COMPLETE');
console.log('============================================================');

export { results, allAssertionsPassed };
