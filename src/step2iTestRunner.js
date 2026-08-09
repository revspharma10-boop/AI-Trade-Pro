// ============================================================
// AI TRADE PRO — STEP 2I TEST RUNNER
// ============================================================
//
// STEP 2I — TRADE DECISION ENGINE INTEGRATION + SAFETY CONTRACT
//
// Run from the browser console after StackBlitz/Vite is loaded:
//
//   import('/src/step2iTestRunner.js?run=' + Date.now())
//
// IMPORTANT:
// - This suite does NOT force a live BUY or SELL.
// - It verifies that valid trades can execute when all hard gates pass.
// - It verifies that invalid / unsafe trades are rejected.
// - It preserves the STEP 2H regression contract.
// ============================================================

import {
  calculateRiskQualityScore,
  calculateOpportunityScore,
  evaluateRiskGates,
  calculateRiskReward
} from './services/recommendationEngine.js';

import {
  buildTradeDecision,
  validateTradeDecisionInput
} from './services/tradeDecisionEngine.js';

import {
  runApplicationAnalysis
} from './services/applicationAnalysis.js';


let passed = 0;
let failed = 0;

function assert(name, condition, details = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${name}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}`, details);
  }
}

function section(title) {
  console.log('');
  console.log('============================================================');
  console.log(title);
  console.log('============================================================');
}


console.clear();
section('AI TRADE PRO — STEP 2I TEST RUNNER');
console.log('TRADE DECISION ENGINE INTEGRATION + SAFETY CONTRACT');


// ============================================================
// TEST 1 — STEP 2H REGRESSION: RISK QUALITY
// ============================================================

section('TEST 1 — STEP 2H REGRESSION CONTRACT');

const allTrueGates = {
  dataValid: true,
  liquidityAcceptable: true,
  technicalConfirmation: true,
  stopLossValid: true,
  volatilityAcceptable: true,
  marketRegimeAcceptable: true,
  riskRewardAcceptable: true
};

const regimeFailedGates = {
  ...allTrueGates,
  marketRegimeAcceptable: false
};

const allTrueRiskQuality =
  calculateRiskQualityScore(allTrueGates);

const regimeFailedRiskQuality =
  calculateRiskQualityScore(regimeFailedGates);

assert(
  'Risk Quality all gates true = 100',
  allTrueRiskQuality === 100,
  allTrueRiskQuality
);

assert(
  'Risk Quality only market regime false = 90',
  regimeFailedRiskQuality === 90,
  regimeFailedRiskQuality
);


// ============================================================
// TEST 2 — STEP 2H REGRESSION: OPPORTUNITY SCORE
// ============================================================

const opportunityScore =
  calculateOpportunityScore({
    technicalScore: 30,
    fundamentalScore: 68.5,
    marketRegimeScore: 31,
    riskQualityScore: 90
  });

assert(
  'Opportunity Score reconstruction = 47.65',
  opportunityScore === 47.65,
  opportunityScore
);


// ============================================================
// TEST 3 — STEP 2H REGRESSION: RISK GATES
// ============================================================

const failedGateResult =
  evaluateRiskGates({
    ...regimeFailedGates,
    riskRewardRatio: 2
  });

assert(
  'Market regime failure blocks risk gates',
  failedGateResult.passed === false,
  failedGateResult
);

assert(
  'Risk/reward gate passes at 2.0',
  failedGateResult.gates.riskRewardAcceptable === true,
  failedGateResult.gates
);


// ============================================================
// TEST 4 — RISK / REWARD CONTRACT
// ============================================================

const riskReward =
  calculateRiskReward({
    entry: 100,
    stopLoss: 95,
    target: 110
  });

assert(
  'Risk/reward calculation is valid',
  riskReward.valid === true,
  riskReward
);

assert(
  'Risk/reward ratio = 2',
  riskReward.ratio === 2,
  riskReward
);


// ============================================================
// TEST 5 — VALIDATION CONTRACT
// ============================================================

const validValidation =
  validateTradeDecisionInput({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    }
  });

assert(
  'Valid trade decision input passes validation',
  Object.values(validValidation).every(Boolean),
  validValidation
);


// ============================================================
// TEST 6 — BULLISH BUY -> LONG
// ============================================================

const bullishDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500,
      actualRiskPercent: 0.5,
      capitalAvailable: true
    },
    riskGatesPassed: true
  });

assert(
  'Valid BULLISH trade produces BUY',
  bullishDecision.decision === 'BUY',
  bullishDecision
);

assert(
  'BUY maps to LONG',
  bullishDecision.action === 'LONG',
  bullishDecision
);

assert(
  'Valid BUY is executable',
  bullishDecision.executable === true,
  bullishDecision
);

assert(
  'Valid BUY result is marked valid',
  bullishDecision.valid === true,
  bullishDecision
);

assert(
  'Valid BUY has no rejection reasons',
  bullishDecision.rejectionReasons.length === 0,
  bullishDecision.rejectionReasons
);


// ============================================================
// TEST 7 — BEARISH SELL -> SHORT
// ============================================================

const bearishDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BEARISH',
      entryPrice: 100,
      stopLoss: 105,
      targetPrice: 90,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500,
      actualRiskPercent: 0.5,
      capitalAvailable: true
    },
    riskGatesPassed: true
  });

assert(
  'Valid BEARISH trade produces SELL',
  bearishDecision.decision === 'SELL',
  bearishDecision
);

assert(
  'SELL maps to SHORT',
  bearishDecision.action === 'SHORT',
  bearishDecision
);

assert(
  'Valid SELL is executable',
  bearishDecision.executable === true,
  bearishDecision
);


// ============================================================
// TEST 8 — FAILED RISK GATES MUST BLOCK EXECUTION
// ============================================================

const riskRejectedDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    },
    riskGatesPassed: false
  });

assert(
  'Failed risk gates produce NO TRADE',
  riskRejectedDecision.decision === 'NO TRADE',
  riskRejectedDecision
);

assert(
  'Failed risk gates produce NONE action',
  riskRejectedDecision.action === 'NONE',
  riskRejectedDecision
);

assert(
  'Failed risk gates are non-executable',
  riskRejectedDecision.executable === false,
  riskRejectedDecision
);

assert(
  'Failed risk gates include RISK_GATES_FAILED reason',
  riskRejectedDecision.rejectionReasons.includes('RISK_GATES_FAILED'),
  riskRejectedDecision.rejectionReasons
);


// ============================================================
// TEST 9 — LOW OPPORTUNITY SCORE MUST BLOCK EXECUTION
// ============================================================

const lowScoreDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 49.99
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    },
    riskGatesPassed: true
  });

assert(
  'Low opportunity score produces NO TRADE',
  lowScoreDecision.decision === 'NO TRADE',
  lowScoreDecision
);

assert(
  'Low opportunity score is non-executable',
  lowScoreDecision.executable === false,
  lowScoreDecision
);

assert(
  'Low opportunity score is explicitly rejected',
  lowScoreDecision.rejectionReasons.includes(
    'OPPORTUNITY_SCORE_BELOW_MINIMUM'
  ),
  lowScoreDecision.rejectionReasons
);


// ============================================================
// TEST 10 — INVALID POSITION SIZING MUST BLOCK EXECUTION
// ============================================================

const invalidSizingDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: false,
      quantity: 0,
      positionValue: 0,
      actualRiskAmount: 0
    },
    riskGatesPassed: true
  });

assert(
  'Invalid position sizing produces NO TRADE',
  invalidSizingDecision.decision === 'NO TRADE',
  invalidSizingDecision
);

assert(
  'Invalid position sizing is non-executable',
  invalidSizingDecision.executable === false,
  invalidSizingDecision
);

assert(
  'Invalid position sizing is explicitly rejected',
  invalidSizingDecision.rejectionReasons.includes(
    'POSITION_SIZING_INVALID'
  ),
  invalidSizingDecision.rejectionReasons
);


// ============================================================
// TEST 11 — INVALID DIRECTION MUST BLOCK EXECUTION
// ============================================================

const invalidDirectionDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'SIDEWAYS',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    },
    riskGatesPassed: true
  });

assert(
  'Invalid direction produces NO TRADE',
  invalidDirectionDecision.decision === 'NO TRADE',
  invalidDirectionDecision
);

assert(
  'Invalid direction is non-executable',
  invalidDirectionDecision.executable === false,
  invalidDirectionDecision
);

assert(
  'Invalid direction is explicitly rejected',
  invalidDirectionDecision.rejectionReasons.includes(
    'INVALID_DIRECTION'
  ),
  invalidDirectionDecision.rejectionReasons
);


// ============================================================
// TEST 12 — RISK/REWARD BELOW MINIMUM MUST BLOCK EXECUTION
// ============================================================

const lowRiskRewardDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 95,
      targetPrice: 106,
      riskRewardRatio: 1.2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    },
    riskGatesPassed: true
  });

assert(
  'Risk/reward below minimum produces NO TRADE',
  lowRiskRewardDecision.decision === 'NO TRADE',
  lowRiskRewardDecision
);

assert(
  'Risk/reward below minimum is non-executable',
  lowRiskRewardDecision.executable === false,
  lowRiskRewardDecision
);

assert(
  'Low risk/reward is explicitly rejected',
  lowRiskRewardDecision.rejectionReasons.includes(
    'RISK_REWARD_BELOW_MINIMUM'
  ),
  lowRiskRewardDecision.rejectionReasons
);


// ============================================================
// TEST 13 — INVALID PRICE MUST BLOCK EXECUTION
// ============================================================

const invalidPriceDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'TEST:NSE',
      direction: 'BULLISH',
      entryPrice: 0,
      stopLoss: 95,
      targetPrice: 110,
      riskRewardRatio: 2,
      opportunityScore: 80
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 10000,
      actualRiskAmount: 500
    },
    riskGatesPassed: true
  });

assert(
  'Invalid entry price produces NO TRADE',
  invalidPriceDecision.decision === 'NO TRADE',
  invalidPriceDecision
);

assert(
  'Invalid entry price is non-executable',
  invalidPriceDecision.executable === false,
  invalidPriceDecision
);

assert(
  'Invalid entry price is explicitly rejected',
  invalidPriceDecision.rejectionReasons.includes(
    'INVALID_ENTRY_PRICE'
  ),
  invalidPriceDecision.rejectionReasons
);


// ============================================================
// TEST 14 — LIVE APPLICATION INTEGRATION
// ============================================================

section('TEST 14 — LIVE APPLICATION INTEGRATION');

try {
  const live =
    await runApplicationAnalysis(
      'INFY:NSE',
      {
        interval: '1day',
        outputSize: 60,
        accountCapital: 1000000,
        maxRiskPercent: 1
      }
    );

  assert(
    'Live application analysis executed',
    live.analysisExecuted === true,
    live
  );

  assert(
    'Live recommendation was generated',
    live.recommendationGenerated === true,
    live
  );

  assert(
    'Live pipeline object exists',
    Boolean(live.pipeline) &&
      typeof live.pipeline === 'object',
    live
  );

  assert(
    'Live trade decision object exists',
    Boolean(live.tradeDecision) &&
      typeof live.tradeDecision === 'object',
    live
  );

  assert(
    'Live decision is BUY, SELL or NO TRADE',
    ['BUY', 'SELL', 'NO TRADE'].includes(
      live.tradeDecision.decision
    ),
    live.tradeDecision
  );

  assert(
    'Live executable flag matches BUY/SELL',
    live.tradeDecision.executable ===
      (
        live.tradeDecision.decision === 'BUY' ||
        live.tradeDecision.decision === 'SELL'
      ),
    live.tradeDecision
  );

  console.log('');
  console.log('===== STEP 2I LIVE PIPELINE SUMMARY =====');
  console.table({
    symbol:
      live.pipeline.symbol,
    technicalScore:
      live.pipeline.technicalScore,
    fundamentalScore:
      live.pipeline.fundamentalScore,
    marketRegimeScore:
      live.pipeline.marketRegimeScore,
    riskQualityScore:
      live.pipeline.riskQualityScore,
    opportunityScore:
      live.pipeline.opportunityScore,
    riskRewardRatio:
      live.pipeline.riskRewardRatio,
    riskGatesPassed:
      live.pipeline.riskGatesPassed,
    recommendation:
      live.pipeline.recommendation?.recommendation,
    decision:
      live.tradeDecision.decision,
    action:
      live.tradeDecision.action,
    executable:
      live.tradeDecision.executable,
    rejectionReasons:
      live.tradeDecision.rejectionReasons.join(', ')
  });

} catch (error) {
  failed += 1;
  console.error(
    '❌ Live application integration test could not execute',
    error
  );
}


// ============================================================
// FINAL RESULT
// ============================================================

section('STEP 2I TEST RESULT');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0
});

if (failed === 0) {
  console.log('✅ STEP 2I TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2I TEST SUITE FAILED');
}

export default {
  passed,
  failed,
  allPassed: failed === 0
};
