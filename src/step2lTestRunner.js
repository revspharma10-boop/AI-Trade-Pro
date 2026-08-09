// ============================================================
// AI TRADE PRO — STEP 2L TEST RUNNER
// PAPER EXECUTION SAFETY CONTRACT
// ============================================================
//
// Purpose:
// - Validate the paper execution boundary.
// - Confirm SAFE BUY becomes LONG paper execution only.
// - Confirm SAFE SELL becomes SHORT paper execution only.
// - Confirm NO TRADE can never become executable.
// - Confirm failed gates, low score, bad sizing and mismatched
//   direction are blocked.
// - Confirm no real broker order is ever reported.
//
// This runner does NOT call market-data APIs.
// This runner does NOT place real orders.
// ============================================================

import {
  buildTradeDecision
} from './services/tradeDecisionEngine.js';

import {
  authorizePaperExecution,
  createPaperOrder
} from './services/paperExecutionEngine.js';


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
console.log('AI TRADE PRO — STEP 2L TEST RUNNER');
console.log('PAPER EXECUTION SAFETY CONTRACT');
console.log('============================================================');


// ============================================================
// TEST 1 — SAFE BUY
// ============================================================

const safeBuy = makeDecision();
const safeBuyAuthorization = authorizePaperExecution(safeBuy);
const safeBuyOrder = createPaperOrder(safeBuy);

assert(
  safeBuyAuthorization.paperOnly === true,
  'BUY authorization is explicitly paper-only'
);

assert(
  safeBuyAuthorization.authorized === true,
  'Safe BUY is authorized for paper execution'
);

assert(
  safeBuyAuthorization.decision === 'BUY' &&
  safeBuyAuthorization.action === 'LONG',
  'BUY maps to LONG paper action'
);

assert(
  safeBuyAuthorization.executable === true,
  'Safe BUY is executable inside paper boundary'
);

assert(
  safeBuyOrder.orderStatus === 'PAPER_ORDER_CREATED',
  'Safe BUY creates a paper order'
);

assert(
  safeBuyOrder.realOrderPlaced === false &&
  safeBuyOrder.brokerOrderId === null,
  'BUY never creates a real broker order'
);


// ============================================================
// TEST 2 — SAFE SELL
// ============================================================

const safeSell = makeDecision({
  tradeSetup: makeTradeSetup({
    direction: 'BEARISH'
  })
});

const safeSellAuthorization = authorizePaperExecution(safeSell);
const safeSellOrder = createPaperOrder(safeSell);

assert(
  safeSellAuthorization.authorized === true,
  'Safe SELL is authorized for paper execution'
);

assert(
  safeSellAuthorization.decision === 'SELL' &&
  safeSellAuthorization.action === 'SHORT',
  'SELL maps to SHORT paper action'
);

assert(
  safeSellOrder.orderStatus === 'PAPER_ORDER_CREATED',
  'Safe SELL creates a paper order'
);

assert(
  safeSellOrder.realOrderPlaced === false &&
  safeSellOrder.brokerOrderId === null,
  'SELL never creates a real broker order'
);


// ============================================================
// TEST 3 — NO TRADE
// ============================================================

const noTrade = makeDecision({
  riskGatesPassed: false
});

const noTradeAuthorization = authorizePaperExecution(noTrade);
const noTradeOrder = createPaperOrder(noTrade);

assert(
  noTradeAuthorization.authorized === false,
  'NO TRADE is never authorized'
);

assert(
  noTradeAuthorization.executable === false,
  'NO TRADE is non-executable'
);

assert(
  noTradeAuthorization.orderStatus === 'BLOCKED',
  'NO TRADE is blocked at paper execution boundary'
);

assert(
  noTradeAuthorization.rejectionReasons.includes('RISK_GATES_FAILED'),
  'NO TRADE retains risk-gate rejection reason'
);

assert(
  noTradeOrder.realOrderPlaced === false &&
  noTradeOrder.brokerOrderId === null,
  'NO TRADE cannot create a real order'
);


// ============================================================
// TEST 4 — LOW OPPORTUNITY SCORE
// ============================================================

const lowScore = makeDecision({
  tradeSetup: makeTradeSetup({
    opportunityScore: 49.99
  })
});

const lowScoreAuthorization = authorizePaperExecution(lowScore);

assert(
  lowScoreAuthorization.authorized === false,
  'Low opportunity score is blocked'
);

assert(
  lowScoreAuthorization.rejectionReasons.includes(
    'OPPORTUNITY_SCORE_BELOW_MINIMUM'
  ),
  'Low score rejection is preserved'
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

const invalidSizingAuthorization =
  authorizePaperExecution(invalidSizing);

assert(
  invalidSizingAuthorization.authorized === false,
  'Invalid position sizing is blocked'
);

assert(
  invalidSizingAuthorization.rejectionReasons.includes(
    'INVALID_QUANTITY'
  ) &&
  invalidSizingAuthorization.rejectionReasons.includes(
    'INVALID_POSITION_VALUE'
  ),
  'Invalid sizing reasons are preserved'
);


// ============================================================
// TEST 6 — INVALID RISK/REWARD
// ============================================================

const lowRiskReward = makeDecision({
  tradeSetup: makeTradeSetup({
    riskRewardRatio: 1.99
  })
});

const lowRiskRewardAuthorization =
  authorizePaperExecution(lowRiskReward);

assert(
  lowRiskRewardAuthorization.authorized === false,
  'Risk/reward below 2.0 is blocked'
);

assert(
  lowRiskRewardAuthorization.rejectionReasons.includes(
    'RISK_REWARD_BELOW_MINIMUM'
  ),
  'Risk/reward rejection is preserved'
);


// ============================================================
// TEST 7 — ACTION / DIRECTION MISMATCH
// ============================================================

const mismatchedAction = makeDecision();
mismatchedAction.action = 'SHORT';

const mismatchAuthorization =
  authorizePaperExecution(mismatchedAction);

assert(
  mismatchAuthorization.authorized === false,
  'Action/direction mismatch is blocked'
);

assert(
  mismatchAuthorization.rejectionReasons.includes(
    'ACTION_DIRECTION_MISMATCH'
  ),
  'Action/direction mismatch is recorded'
);


// ============================================================
// TEST 8 — CAPITAL NOT AVAILABLE
// ============================================================

const unavailableCapital = makeDecision({
  positionSizing: makePositionSizing({
    capitalAvailable: false
  })
});

const capitalAuthorization =
  authorizePaperExecution(unavailableCapital);

assert(
  capitalAuthorization.authorized === false,
  'Unavailable capital blocks paper execution'
);

assert(
  capitalAuthorization.rejectionReasons.includes(
    'CAPITAL_NOT_AVAILABLE'
  ),
  'Capital failure is recorded'
);


// ============================================================
// TEST 9 — EXECUTION INVARIANT
// ============================================================

const unsafeDecisions = [
  noTrade,
  lowScore,
  invalidSizing,
  lowRiskReward,
  mismatchedAction,
  unavailableCapital
];

const unsafeResults = unsafeDecisions.map(
  decision => authorizePaperExecution(decision)
);

assert(
  unsafeResults.every(
    result =>
      result.authorized === false &&
      result.executable === false &&
      result.orderStatus === 'BLOCKED' &&
      result.realOrderPlaced === false &&
      result.brokerOrderId === null
  ),
  'Every unsafe scenario remains blocked and paper-only'
);


// ============================================================
// SUMMARY
// ============================================================

console.log('============================================================');
console.log('STEP 2L PAPER EXECUTION SUMMARY');
console.log('============================================================');

console.table({
  SafeBUYAuthorized: safeBuyAuthorization.authorized,
  SafeBUYAction: safeBuyAuthorization.action,
  SafeBUYOrderStatus: safeBuyOrder.orderStatus,
  SafeBUYRealOrderPlaced: safeBuyOrder.realOrderPlaced,
  SafeSELLAuthorized: safeSellAuthorization.authorized,
  SafeSELLAction: safeSellAuthorization.action,
  SafeSELLOrderStatus: safeSellOrder.orderStatus,
  SafeSELLRealOrderPlaced: safeSellOrder.realOrderPlaced,
  NoTradeAuthorized: noTradeAuthorization.authorized,
  NoTradeOrderStatus: noTradeOrder.orderStatus,
  NoTradeRealOrderPlaced: noTradeOrder.realOrderPlaced
});

console.log('============================================================');
console.log('STEP 2L TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0,
  SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED'
});

if (failed === 0) {
  console.log('✅ STEP 2L TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2L TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2L COMPLETE');
console.log('============================================================');
