// ============================================================
// AI TRADE PRO — STEP 2H TEST RUNNER
// ============================================================
// Run from browser console after the app is loaded:
//
//   import('/src/step2hTestRunner.js?run=' + Date.now())
//
// The tests validate contracts. They do NOT force a BUY/SELL.
// ============================================================

import {
  calculateRiskQualityScore,
  calculateOpportunityScore,
  evaluateRiskGates,
  calculateRiskReward
} from './services/recommendationEngine.js';

import {
  buildTradeDecision
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


console.clear();
console.log('============================================================');
console.log('AI TRADE PRO — STEP 2H TEST RUNNER');
console.log('============================================================');


// ------------------------------------------------------------
// TEST 1 — RISK QUALITY SCORE
// ------------------------------------------------------------

const allTrueGates = {
  dataValid: true,
  liquidityAcceptable: true,
  technicalConfirmation: true,
  stopLossValid: true,
  volatilityAcceptable: true,
  marketRegimeAcceptable: true,
  riskRewardAcceptable: true
};

const currentGates = {
  ...allTrueGates,
  marketRegimeAcceptable: false
};

const allTrueRiskQuality =
  calculateRiskQualityScore(allTrueGates, 2);

const currentRiskQuality =
  calculateRiskQualityScore(currentGates, 2);

assert(
  'Risk Quality — all gates true = 100',
  allTrueRiskQuality === 100,
  allTrueRiskQuality
);

assert(
  'Risk Quality — only market regime false = 90',
  currentRiskQuality === 90,
  currentRiskQuality
);


// ------------------------------------------------------------
// TEST 2 — OPPORTUNITY SCORE
// ------------------------------------------------------------

const opportunity =
  calculateOpportunityScore({
    technicalScore: 30,
    fundamentalScore: 68.5,
    marketRegimeScore: 31,
    riskQualityScore: 90
  });

assert(
  'Opportunity Score reconstruction = 47.65',
  opportunity === 47.65,
  opportunity
);


// ------------------------------------------------------------
// TEST 3 — RISK GATE CONTRACT
// ------------------------------------------------------------

const gateResult =
  evaluateRiskGates({
    ...currentGates,
    riskRewardRatio: 2
  });

assert(
  'Risk gates fail when market regime is false',
  gateResult.passed === false,
  gateResult
);

assert(
  'Risk/reward gate passes at 2.0',
  gateResult.gates.riskRewardAcceptable === true,
  gateResult.gates
);


// ------------------------------------------------------------
// TEST 4 — RISK/REWARD CONTRACT
// ------------------------------------------------------------

const rr =
  calculateRiskReward({
    entry: 100,
    stopLoss: 95,
    target: 110
  });

assert(
  'Risk/reward calculation valid',
  rr.valid === true
);

assert(
  'Risk/reward ratio = 2',
  rr.ratio === 2,
  rr
);


// ------------------------------------------------------------
// TEST 5 — DECISION ENGINE MUST NOT FORCE TRADE
// ------------------------------------------------------------

const rejectedDecision =
  buildTradeDecision({
    tradeSetup: {
      symbol: 'INFY:NSE',
      direction: 'BULLISH',
      entryPrice: 1175.1,
      stopLoss: 1160,
      targetPrice: 1205,
      riskRewardRatio: 2,
      opportunityScore: 47.65
    },
    positionSizing: {
      valid: true,
      quantity: 100,
      positionValue: 117510,
      actualRiskAmount: 1510
    },
    riskGatesPassed: false
  });

assert(
  'Failed risk gates produce NO TRADE',
  rejectedDecision.decision === 'NO TRADE',
  rejectedDecision
);

assert(
  'Failed risk gates produce non-executable decision',
  rejectedDecision.executable === false,
  rejectedDecision
);


// ------------------------------------------------------------
// TEST 6 — VALID TRADE DECISION CONTRACT
// ------------------------------------------------------------

const executableDecision =
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
    riskGatesPassed: true
  });

assert(
  'All valid gates + score produce BUY',
  executableDecision.decision === 'BUY',
  executableDecision
);

assert(
  'BUY produces LONG action',
  executableDecision.action === 'LONG',
  executableDecision
);

assert(
  'Valid BUY is executable',
  executableDecision.executable === true,
  executableDecision
);


// ------------------------------------------------------------
// TEST 7 — LIVE APPLICATION CONTRACT
// ------------------------------------------------------------

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
    'Live pipeline returns analysisExecuted=true',
    live.analysisExecuted === true,
    live
  );

  assert(
    'Live pipeline returns recommendation',
    live.recommendationGenerated === true,
    live
  );

  assert(
    'Live pipeline returns trade decision object',
    Boolean(live.tradeDecision) &&
      typeof live.tradeDecision === 'object',
    live
  );

  assert(
    'Live pipeline decision is safe',
    live.tradeDecision.decision === 'BUY' ||
      live.tradeDecision.decision === 'SELL' ||
      live.tradeDecision.decision === 'NO TRADE',
    live.tradeDecision
  );

  console.log('===== LIVE PIPELINE SUMMARY =====');
  console.table({
    symbol: live.pipeline.symbol,
    technicalScore: live.pipeline.technicalScore,
    fundamentalScore: live.pipeline.fundamentalScore,
    marketRegimeScore: live.pipeline.marketRegimeScore,
    riskQualityScore: live.pipeline.riskQualityScore,
    opportunityScore: live.pipeline.opportunityScore,
    riskRewardRatio: live.pipeline.riskRewardRatio,
    riskGatesPassed: live.pipeline.riskGatesPassed,
    recommendation:
      live.pipeline.recommendation?.recommendation,
    decision: live.tradeDecision.decision,
    action: live.tradeDecision.action,
    executable: live.tradeDecision.executable
  });

} catch (error) {
  failed += 1;
  console.error(
    '❌ Live application pipeline test could not execute',
    error
  );
}


// ------------------------------------------------------------
// FINAL RESULT
// ------------------------------------------------------------

console.log('============================================================');
console.log('STEP 2H TEST RESULT');
console.log('============================================================');
console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0
});

if (failed === 0) {
  console.log('✅ STEP 2H TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2H TEST SUITE FAILED');
}

export default {
  passed,
  failed,
  allPassed: failed === 0
};
