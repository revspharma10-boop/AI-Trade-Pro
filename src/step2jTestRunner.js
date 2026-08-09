// ============================================================
// AI TRADE PRO — STEP 2J TEST RUNNER
// APPLICATION / UI INTEGRATION CONTRACT
// ============================================================
//
// Purpose:
// - Validate the application-level result contract.
// - Validate the CURRENT mounted UI against the SAME result.
// - Use the production renderer directly instead of clicking the
//   analysis button a second time.
// - Preserve STEP 2H / STEP 2I behavior as a regression boundary.
// - Distinguish application failures from external market-data 429s.
//
// IMPORTANT:
// The previous STEP 2J runner executed live analysis and then clicked
// the real UI button, causing another quote + time-series request.
// That could trigger Twelve Data HTTP 429 rate limiting and obscure
// the UI contract result.
//
// Run from the browser console:
// import('/src/step2jTestRunner.js?run=' + Date.now())
// ============================================================

import {
  runApplicationAnalysis
} from './services/applicationAnalysis.js';

import {
  renderApplicationResult
} from './applicationBridgeUI.js';


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
let liveBlocked = false;
let liveBlockReason = '';

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
  return text
    .toUpperCase()
    .includes(String(value).toUpperCase());
}

function isRateLimitError(error) {
  const message = String(error?.message || error || '').toUpperCase();

  return (
    message.includes('HTTP 429') ||
    message.includes('TOO MANY REQUESTS') ||
    message.includes('RATE LIMIT')
  );
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
  if (isRateLimitError(error)) {
    liveBlocked = true;
    liveBlockReason = String(error?.message || error);

    console.warn(
      '⚠️ LIVE APPLICATION TEST BLOCKED BY EXTERNAL MARKET-DATA RATE LIMIT',
      error
    );
  } else {
    failed += 1;
    console.error(
      '❌ Live application execution failed',
      error
    );
  }
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
    decision?.rejectionReasons?.join(', ') ?? '',
  liveBlockedByRateLimit: liveBlocked
});


// ============================================================
// APPLICATION UI CONTRACT TEST
// ============================================================

console.log('============================================================');
console.log('STEP 2J APPLICATION UI CONTRACT');
console.log('============================================================');

assert(
  textFromDocument().length > 0,
  'Application UI contains rendered text'
);

assert(
  Boolean(document?.body),
  'Application document body is mounted'
);

const analysisButton =
  document.querySelector('#run-analysis-btn');

assert(
  Boolean(analysisButton),
  'Application analysis button exists'
);


// ============================================================
// UI CONTRACT RESULT SOURCE
// ============================================================
//
// If live analysis succeeded, use the exact live result.
//
// If Twelve Data returned HTTP 429, do NOT click the button again.
// Instead use a deterministic fixture matching the last known valid
// STEP 2I application contract. This validates rendering without
// making another provider request.
//
// This fixture is NOT used for trading decisions and does NOT change
// production application behavior.
// ============================================================

if (!applicationResult && liveBlocked) {
  applicationResult = {
    analysisExecuted: true,
    recommendationGenerated: true,
    pipeline: {
      symbol: TEST_SYMBOL,
      technicalScore: 30,
      fundamentalScore: 68.5,
      marketRegimeScore: 31,
      riskQualityScore: 90,
      opportunityScore: 47.65,
      riskRewardRatio: 2,
      riskGatesPassed: false,
      recommendation: {
        recommendation: 'NO TRADE'
      },
      tradeSetup: {
        opportunityScore: 47.65
      }
    },
    tradeDecision: {
      symbol: TEST_SYMBOL,
      decision: 'NO TRADE',
      action: 'NONE',
      executable: false,
      riskGatesPassed: false,
      opportunityScore: 47.65,
      riskRewardRatio: 2,
      quantity: 0,
      positionValue: 0,
      actualRiskAmount: 0,
      rejectionReasons: [
        'OPPORTUNITY_SCORE_BELOW_MINIMUM',
        'RISK_GATES_FAILED'
      ],
      reason:
        'Opportunity score below minimum and risk gates failed.'
    }
  };

  pipeline = applicationResult.pipeline;
  decision = applicationResult.tradeDecision;

  console.warn(
    '⚠️ STEP 2J UI CONTRACT USING DETERMINISTIC FIXTURE BECAUSE LIVE MARKET DATA IS RATE-LIMITED.'
  );
}


try {
  const renderResult =
    renderApplicationResult(applicationResult);

  assert(
    renderResult?.rendered === true,
    'Production UI renderer rendered the application result',
    renderResult
  );
} catch (error) {
  failed += 1;
  console.error(
    '❌ Production UI renderer failed',
    error
  );
}


const uiText = textFromDocument();

if (decision?.decision === 'NO TRADE') {
  const hasNoTrade =
    hasText(uiText, 'NO TRADE');

  assert(
    hasNoTrade,
    'UI displays NO TRADE for non-executable decision',
    {
      decision,
      uiText: uiText.slice(-1500)
    }
  );

  const hasExecutableBuy =
    /\bBUY\b/i.test(uiText) &&
    /\bLONG\b/i.test(uiText);

  const hasExecutableSell =
    /\bSELL\b/i.test(uiText) &&
    /\bSHORT\b/i.test(uiText);

  assert(
    !(hasExecutableBuy || hasExecutableSell),
    'UI does not expose an executable BUY/SELL state when decision is NO TRADE',
    {
      hasExecutableBuy,
      hasExecutableSell
    }
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
  LiveMarketDataBlocked: liveBlocked,
  AllAssertionsPassed: failed === 0,
  SuiteStatus:
    failed > 0
      ? 'FAILED'
      : liveBlocked
        ? 'PASSED_WITH_EXTERNAL_RATE_LIMIT_WARNING'
        : 'PASSED'
});

if (failed === 0 && !liveBlocked) {
  console.log('✅ STEP 2J TEST SUITE PASSED');
} else if (failed === 0 && liveBlocked) {
  console.warn(
    '⚠️ STEP 2J UI CONTRACT PASSED, BUT LIVE MARKET-DATA TEST WAS BLOCKED BY HTTP 429.'
  );
  console.warn(
    'Retry live testing after the Twelve Data rate limit resets.'
  );
} else {
  console.error('❌ STEP 2J TEST SUITE FAILED');
}

if (liveBlocked) {
  console.warn(
    'External dependency reason:',
    liveBlockReason
  );
}

console.log('============================================================');
console.log('STEP 2J COMPLETE');
console.log('============================================================');

export default {
  passed,
  failed,
  liveBlocked,
  liveBlockReason,
  allAssertionsPassed: failed === 0
};
