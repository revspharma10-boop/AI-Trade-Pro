// ============================================================
// AI TRADE PRO — STEP 2J TEST RUNNER
// APPLICATION / UI INTEGRATION CONTRACT
// ============================================================
//
// Purpose:
// - Validate the application-level result contract.
// - Validate the currently mounted UI without changing production logic.
// - Ensure UI state is consistent with the real trade decision.
// - Preserve STEP 2H / STEP 2I behavior as a regression boundary.
//
// Run from the browser console:
// import('/src/step2jTestRunner.js?run=' + Date.now())
// ============================================================

import {
  runApplicationAnalysis
} from './services/applicationAnalysis.js';


const TEST_SYMBOL = 'INFY:NSE';

const TEST_OPTIONS = {
  accountCapital: 1000000,
  maxRiskPercent: 1,
  outputSize: 60
};


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

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function textFromDocument() {
  return String(document?.body?.innerText || '').trim();
}

function hasText(text, value) {
  return text.toUpperCase().includes(String(value).toUpperCase());
}


// ============================================================
// HEADER
// ============================================================

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2J TEST RUNNER');
console.log('APPLICATION / UI INTEGRATION CONTRACT');
console.log('============================================================');


// ============================================================
// LIVE APPLICATION TEST
// ============================================================

let applicationResult = null;
let pipeline = null;
let decision = null;

try {
  applicationResult =
    await runApplicationAnalysis(
      TEST_SYMBOL,
      TEST_OPTIONS
    );

  pipeline = applicationResult?.pipeline;
  decision = applicationResult?.tradeDecision;

  assert(
    applicationResult?.analysisExecuted === true,
    'Application analysis executed'
  );

  assert(
    applicationResult?.recommendationGenerated === true,
    'Application recommendation was generated'
  );

  assert(
    isObject(pipeline),
    'Pipeline object exists'
  );

  assert(
    isObject(decision),
    'Trade decision object exists'
  );

  assert(
    ['BUY', 'SELL', 'NO TRADE'].includes(decision?.decision),
    'Decision is BUY, SELL or NO TRADE',
    decision
  );

  assert(
    ['LONG', 'SHORT', 'NONE'].includes(decision?.action),
    'Action is LONG, SHORT or NONE',
    decision
  );

  assert(
    decision?.executable ===
      (decision?.decision === 'BUY' || decision?.decision === 'SELL'),
    'Executable flag matches BUY/SELL decision',
    decision
  );

  assert(
    decision?.riskGatesPassed ===
      Boolean(pipeline?.riskGatesPassed),
    'Decision risk-gate status matches pipeline',
    {
      pipeline: pipeline?.riskGatesPassed,
      decision: decision?.riskGatesPassed
    }
  );

  assert(
    decision?.opportunityScore ===
      pipeline?.tradeSetup?.opportunityScore,
    'Decision opportunity score matches trade setup',
    {
      decision: decision?.opportunityScore,
      tradeSetup: pipeline?.tradeSetup?.opportunityScore
    }
  );

  assert(
    isFiniteNumber(decision?.riskRewardRatio),
    'Decision risk/reward ratio is numeric'
  );

  assert(
    isFiniteNumber(decision?.quantity),
    'Decision quantity is numeric'
  );

  assert(
    isFiniteNumber(decision?.positionValue),
    'Decision position value is numeric'
  );

  assert(
    isFiniteNumber(decision?.actualRiskAmount),
    'Decision actual risk amount is numeric'
  );

  // ----------------------------------------------------------
  // HARD SAFETY CONTRACT
  // ----------------------------------------------------------

  if (decision?.decision === 'NO TRADE') {
    assert(
      decision?.executable === false,
      'NO TRADE is never executable'
    );

    assert(
      decision?.action === 'NONE',
      'NO TRADE has NONE action'
    );
  }

  if (decision?.decision === 'BUY') {
    assert(
      decision?.action === 'LONG',
      'BUY produces LONG action'
    );

    assert(
      decision?.executable === true,
      'BUY is executable only when all gates pass'
    );
  }

  if (decision?.decision === 'SELL') {
    assert(
      decision?.action === 'SHORT',
      'SELL produces SHORT action'
    );

    assert(
      decision?.executable === true,
      'SELL is executable only when all gates pass'
    );
  }

} catch (error) {
  failed += 1;
  console.error('❌ Live application execution failed', error);
}


// ============================================================
// LIVE PIPELINE SUMMARY
// ============================================================

console.log('============================================================');
console.log('STEP 2J LIVE PIPELINE SUMMARY');
console.log('============================================================');

console.table({
  symbol: pipeline?.symbol ?? null,
  technicalScore: pipeline?.technicalScore ?? null,
  fundamentalScore: pipeline?.fundamentalScore ?? null,
  marketRegimeScore: pipeline?.marketRegimeScore ?? null,
  riskQualityScore: pipeline?.riskQualityScore ?? null,
  opportunityScore: pipeline?.opportunityScore ?? null,
  riskRewardRatio: pipeline?.riskRewardRatio ?? null,
  riskGatesPassed: pipeline?.riskGatesPassed ?? null,
  recommendation:
    pipeline?.recommendation?.recommendation ?? null,
  decision: decision?.decision ?? null,
  action: decision?.action ?? null,
  executable: decision?.executable ?? null,
  rejectionReasons:
    decision?.rejectionReasons?.join(', ') ?? ''
});


// ============================================================
// APPLICATION UI CONTRACT TEST
// ============================================================

console.log('============================================================');
console.log('STEP 2J APPLICATION UI CONTRACT');
console.log('============================================================');

const uiText = textFromDocument();

assert(
  uiText.length > 0,
  'Application UI contains rendered text'
);

assert(
  Boolean(document?.body),
  'Application document body is mounted'
);

// The UI must not display an executable BUY/SELL state when the
// real application decision says NO TRADE.
if (decision?.decision === 'NO TRADE') {
  const hasNoTrade = hasText(uiText, 'NO TRADE');

  assert(
    hasNoTrade,
    'UI displays NO TRADE for non-executable decision'
  );

  const hasExecutableBuy =
    /\bBUY\b/i.test(uiText) &&
    /\bLONG\b/i.test(uiText);

  const hasExecutableSell =
    /\bSELL\b/i.test(uiText) &&
    /\bSHORT\b/i.test(uiText);

  assert(
    !(hasExecutableBuy || hasExecutableSell),
    'UI does not expose an executable BUY/SELL state when decision is NO TRADE'
  );
}

if (decision?.decision === 'BUY') {
  assert(
    hasText(uiText, 'BUY'),
    'UI displays BUY when decision is BUY'
  );

  assert(
    hasText(uiText, 'LONG'),
    'UI displays LONG when decision is BUY'
  );
}

if (decision?.decision === 'SELL') {
  assert(
    hasText(uiText, 'SELL'),
    'UI displays SELL when decision is SELL'
  );

  assert(
    hasText(uiText, 'SHORT'),
    'UI displays SHORT when decision is SELL'
  );
}


// ============================================================
// FINAL RESULT
// ============================================================

console.log('============================================================');
console.log('STEP 2J TEST RESULT');
console.log('============================================================');

console.table({
  Passed: passed,
  Failed: failed,
  AllAssertionsPassed: failed === 0
});

if (failed === 0) {
  console.log('✅ STEP 2J TEST SUITE PASSED');
} else {
  console.error('❌ STEP 2J TEST SUITE FAILED');
}

console.log('============================================================');
console.log('STEP 2J COMPLETE');
console.log('============================================================');

export default {
  passed,
  failed,
  allAssertionsPassed: failed === 0
};
