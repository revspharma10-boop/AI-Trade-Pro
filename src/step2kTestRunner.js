// ============================================================
// AI TRADE PRO — STEP 2K TEST RUNNER
// TRADE EXECUTION SAFETY CONTRACT
// ============================================================
//
// Purpose:
// - Validate that NO TRADE can become executable.
// - Validate that failed risk gates block execution.
// - Validate that low opportunity score blocks execution.
// - Validate that invalid position sizing blocks execution.
// - Validate BUY -> LONG and SELL -> SHORT only when every
//   execution prerequisite is satisfied.
// - Validate that the decision engine never emits an executable
//   action for an unsafe input.
//
// This runner tests the decision engine directly. It does NOT place
// real orders and does NOT call market-data APIs.
// ============================================================

import {
  buildTradeDecision,
  validateTradeDecisionInput
} from './services/tradeDecisionEngine.js';


// ============================================================
// TEST HELPERS
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition, label, details = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}`, details);
  }
}

function makeTradeSetup(overrides = {}) {
  return {
    symbol: 'INFY:NSE',
    direction: 'BULLISH',
    entryPrice: 1175.1,
    stopLoss: 1160,
    targetPrice: 1205,
    riskRewardRatio: 2,
    opportunityScore: 80,
    ...overrides
  };
}

function makePositionSizing(overrides = {}) {
  return {
    valid: true,
    quantity: 100,
    positionValue: 117510,
    actualRiskAmount: 1510,
    actualRiskPercent: 0.151,
    capitalAvailable: true,
    ...overrides
  };
}

function makeDecision({
  tradeSetup = makeTradeSetup(),
  positionSizing = makePositionSizing(),
  riskGatesPassed = true
} = {}) {
  return buildTradeDecision({
    tradeSetup,
    positionSizing,
    riskGatesPassed
  });
}


// ============================================================
// START
// ============================================================

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2K TEST RUNNER');
console.log('TRADE EXECUTION SAFETY CONTRACT');
console.log('============================================================');


// ============================================================
// TEST 1 — SAFE BUY PATH
// ============================================================

const safeBuy = makeDecision();

assert(
  safeBuy.valid === true,
  'Safe BUY input is structurally valid'
);

assert(
  safeBuy.decision === 'BUY',
  'All valid gates + sufficient score produce BUY'
);

assert(
  safeBuy.action === 'LONG',
  'BUY produces LONG action'
);

assert(
  safeBuy.executable === true,
  'Valid BUY is executable'
);


// ============================================================
// TEST 2 — SAFE SELL PATH
// ============================================================

const safeSell = makeDecision({
  tradeSetup: makeTradeSetup({
    direction: 'BEARISH'
  })
});

assert(
  safeSell.decision === 'SELL',
  'All valid gates + sufficient score produce SELL'
);

assert(
  safeSell.action === 'SHORT',
  'SELL produces SHORT action'
);

assert(
  safeSell.executable === true,
  'Valid SELL is executable'
);


// ============================================================
// TEST 3 — RISK GATES FAILED
// ============================================================

const riskGateFailure = makeDecision({
  riskGatesPassed: false
});

assert(
  riskGateFailure.decision === 'NO TRADE',
  'Failed risk gates produce NO TRADE'
);

assert(
  riskGateFailure.action === 'NONE',
  'Failed risk gates produce NONE action'
);

assert(
  riskGateFailure.executable === false,
  'Failed risk gates are non-executable'
);

assert(
  riskGateFailure.rejectionReasons.includes('RISK_GATES_FAILED'),
  'Failed risk gates are recorded in rejection reasons'
);


// ============================================================
// TEST 4 — LOW OPPORTUNITY SCORE
// ============================================================

const lowScore = makeDecision({
  tradeSetup: makeTradeSetup({
    opportunityScore: 49.99
  })
});

assert(
  lowScore.decision === 'NO TRADE',
  'Opportunity score below minimum produces NO TRADE'
);

assert(
  lowScore.action === 'NONE',
  'Low opportunity score produces NONE action'
);

assert(
  lowScore.executable === false,
  'Low opportunity score is non-executable'
);

assert(
  lowScore.rejectionReasons.includes('OPPORTUNITY_SCORE_BELOW_MINIMUM'),
  'Low opportunity score is recorded in rejection reasons'
);


// ============================================================
// TEST 5 — INVALID POSITION SIZING
// ============================================================

const invalidSizing = makeDecision({
  positionSizing: makePositionSizing({
    valid: false,
    quantity: 0,
    positionValue: 0
  })
});

assert(
  invalidSizing.decision === 'NO TRADE',
  'Invalid position sizing produces NO TRADE'
);

assert(
  invalidSizing.executable === false,
  'Invalid position sizing is non-executable'
);

assert(
  invalidSizing.rejectionReasons.includes('POSITION_SIZING_INVALID'),
  'Invalid position sizing is recorded'
);

assert(
  invalidSizing.rejectionReasons.includes('INVALID_QUANTITY'),
  'Invalid quantity is recorded'
);

assert(
  invalidSizing.rejectionReasons.includes('INVALID_POSITION_VALUE'),
  'Invalid position value is recorded'
);


// ============================================================
// TEST 6 — INVALID DIRECTION
// ============================================================

const invalidDirection = makeDecision({
  tradeSetup: makeTradeSetup({
    direction: 'SIDEWAYS'
  })
});

assert(
  invalidDirection.decision === 'NO TRADE',
  'Invalid direction produces NO TRADE'
);

assert(
  invalidDirection.action === 'NONE',
  'Invalid direction produces NONE action'
);

assert(
  invalidDirection.executable === false,
  'Invalid direction is non-executable'
);

assert(
  invalidDirection.rejectionReasons.includes('INVALID_DIRECTION'),
  'Invalid direction is recorded'
);


// ============================================================
// TEST 7 — LOW RISK/REWARD
// ============================================================

const lowRiskReward = makeDecision({
  tradeSetup: makeTradeSetup({
    riskRewardRatio: 1.99
  })
});

assert(
  lowRiskReward.decision === 'NO TRADE',
  'Risk/reward below minimum produces NO TRADE'
);

assert(
  lowRiskReward.executable === false,
  'Risk/reward failure is non-executable'
);

assert(
  lowRiskReward.rejectionReasons.includes('RISK_REWARD_BELOW_MINIMUM'),
  'Risk/reward failure is recorded'
);


// ============================================================
// TEST 8 — INPUT VALIDATION CONTRACT
// ============================================================

const validation = validateTradeDecisionInput({
  tradeSetup: makeTradeSetup(),
  positionSizing: makePositionSizing()
});

assert(
  validation.symbolValid === true &&
  validation.directionValid === true &&
  validation.entryPriceValid === true &&
  validation.stopLossValid === true &&
  validation.targetPriceValid === true,
  'Core trade setup validation passes for safe input'
);

assert(
  validation.riskRewardValid === true &&
  validation.opportunityScoreValid === true,
  'Score and risk/reward validation passes for safe input'
);

assert(
  validation.positionSizingValid === true &&
  validation.quantityValid === true &&
  validation.positionValueValid === true &&
  validation.actualRiskValid === true,
  'Position sizing validation passes for safe input'
);


// ============================================================
// TEST 9 — EXECUTION INVARIANTS
// ============================================================

const unsafeCases = [
  makeDecision({ riskGatesPassed: false }),
  makeDecision({
    tradeSetup: makeTradeSetup({ opportunityScore: 40 })
  }),
  makeDecision({
    positionSizing: makePositionSizing({ valid: false, quantity: 0 })
  }),
  makeDecision({
    tradeSetup: makeTradeSetup({ direction: 'INVALID' })
  }),
  makeDecision({
    tradeSetup: makeTradeSetup({ riskRewardRatio: 1 })
  })
];

assert(
  unsafeCases.every(
    result =>
      result.decision === 'NO TRADE' &&
      result.action === 'NONE' &&
      result.executable === false
  ),
  'Every unsafe scenario remains non-executable'
);


// ============================================================
// LIVE-SAFE SUMMARY
// ============================================================

console.log('============================================================');
console.log('STEP 2K SAFETY SUMMARY');
console.log('============================================================');

console.table({
  SafeBUYDecision: safeBuy.decision,
  SafeBUYAction: safeBuy.action,
  SafeBUYExecutable: safeBuy.executable,
  SafeSELLDecision: safeSell.decision,
  SafeSELLAction: safeSell.action,
  SafeSELLExecutable: safeSell.executable,
  FailedGateDecision: riskGateFailure.decision,
  FailedGateExecutable: riskGateFailure.executable,
  LowScoreDecision: lowScore.decision,
  LowScoreExecutable: lowScore.executable
});

console.log('============================================================');
console.log('STEP 2K TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0,
  SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED'
});

if (failed === 0) {
  console.log('✅ STEP 2K TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2K TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2K COMPLETE');
console.log('============================================================');
