// ============================================================
// AI TRADE PRO
// Position Sizing Engine
// STEP 2G
// Trade Setup + Position Sizing Integration
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_MAX_RISK_PERCENT = 1;

const MIN_RISK_PERCENT = 0.01;

const MAX_RISK_PERCENT = 5;

const DEFAULT_ATR_MULTIPLIER = 1.5;

const DEFAULT_RISK_REWARD_RATIO = 2;


// ============================================================
// NUMBER HELPERS
// ============================================================

function toFiniteNumber(value) {

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;

}


function roundNumber(
  value,
  decimals = 4
) {

  if (!Number.isFinite(Number(value))) {

    return null;

  }

  return Number(
    Number(value).toFixed(decimals)
  );

}


// ============================================================
// CONFIGURATION VALIDATION
// ============================================================

export function validatePositionSizingConfig({

  accountCapital,

  maxRiskPercent

} = {}) {

  const capital =
    toFiniteNumber(
      accountCapital
    );

  const riskPercent =
    toFiniteNumber(
      maxRiskPercent
    );


  const capitalValid =
    capital !== null &&
    capital > 0;


  const riskValid =
    riskPercent !== null &&
    riskPercent >= MIN_RISK_PERCENT &&
    riskPercent <= MAX_RISK_PERCENT;


  return {

    valid:
      capitalValid &&
      riskValid,

    accountCapital:
      capital,

    maxRiskPercent:
      riskPercent,

    capitalValid,

    riskValid,

    reason:
      !capitalValid

        ? 'Account capital must be greater than zero.'

        : !riskValid

          ? `Risk percentage must be between ${MIN_RISK_PERCENT}% and ${MAX_RISK_PERCENT}%.`

          : 'Position sizing configuration is valid.'

  };

}


// ============================================================
// POSITION SIZING
// ============================================================

export function calculatePositionSize({

  accountCapital,

  maxRiskPercent =
    DEFAULT_MAX_RISK_PERCENT,

  entryPrice,

  stopLoss,

  riskPerShare

} = {}) {

  const capital =
    toFiniteNumber(
      accountCapital
    );

  const riskPercent =
    toFiniteNumber(
      maxRiskPercent
    );

  const entry =
    toFiniteNumber(
      entryPrice
    );

  const stop =
    toFiniteNumber(
      stopLoss
    );

  const riskShareInput =
    toFiniteNumber(
      riskPerShare
    );


  // ----------------------------------------------------------
  // CONFIG VALIDATION
  // ----------------------------------------------------------

  const configuration =
    validatePositionSizingConfig({

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent

    });


  if (!configuration.valid) {

    return {

      valid: false,

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent,

      maxRiskAmount: 0,

      entryPrice:
        entry,

      stopLoss:
        stop,

      riskPerShare:
        riskShareInput,

      quantity: 0,

      positionValue: 0,

      actualRiskAmount: 0,

      actualRiskPercent: 0,

      capitalAvailable: false,

      reason:
        configuration.reason

    };

  }


  // ----------------------------------------------------------
  // ENTRY VALIDATION
  // ----------------------------------------------------------

  if (
    entry === null ||
    entry <= 0
  ) {

    return {

      valid: false,

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent,

      maxRiskAmount:
        roundNumber(
          capital *
          riskPercent /
          100,
          4
        ),

      entryPrice:
        entry,

      stopLoss:
        stop,

      riskPerShare:
        riskShareInput,

      quantity: 0,

      positionValue: 0,

      actualRiskAmount: 0,

      actualRiskPercent: 0,

      capitalAvailable: true,

      reason:
        'Entry price must be greater than zero.'

    };

  }


  // ----------------------------------------------------------
  // STOP LOSS VALIDATION
  // ----------------------------------------------------------

  if (
    stop === null ||
    stop <= 0
  ) {

    return {

      valid: false,

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent,

      maxRiskAmount:
        roundNumber(
          capital *
          riskPercent /
          100,
          4
        ),

      entryPrice:
        entry,

      stopLoss:
        stop,

      riskPerShare:
        riskShareInput,

      quantity: 0,

      positionValue: 0,

      actualRiskAmount: 0,

      actualRiskPercent: 0,

      capitalAvailable: true,

      reason:
        'Stop-loss price must be greater than zero.'

    };

  }


  // ----------------------------------------------------------
  // RISK PER SHARE
  // ----------------------------------------------------------

  const calculatedRiskPerShare =
    Math.abs(
      entry -
      stop
    );


  const finalRiskPerShare =
    riskShareInput !== null
      ? riskShareInput
      : calculatedRiskPerShare;


  if (
    !Number.isFinite(
      finalRiskPerShare
    ) ||
    finalRiskPerShare <= 0
  ) {

    return {

      valid: false,

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent,

      maxRiskAmount:
        roundNumber(
          capital *
          riskPercent /
          100,
          4
        ),

      entryPrice:
        entry,

      stopLoss:
        stop,

      riskPerShare:
        finalRiskPerShare,

      quantity: 0,

      positionValue: 0,

      actualRiskAmount: 0,

      actualRiskPercent: 0,

      capitalAvailable: true,

      reason:
        'Risk per share must be greater than zero.'

    };

  }


  // ----------------------------------------------------------
  // MAXIMUM RISK
  // ----------------------------------------------------------

  const maxRiskAmount =
    capital *
    riskPercent /
    100;


  // ----------------------------------------------------------
  // QUANTITY
  // ----------------------------------------------------------

  const quantity =
    Math.floor(
      maxRiskAmount /
      finalRiskPerShare
    );


  if (
    quantity <= 0
  ) {

    return {

      valid: false,

      accountCapital:
        capital,

      maxRiskPercent:
        riskPercent,

      maxRiskAmount:
        roundNumber(
          maxRiskAmount,
          4
        ),

      entryPrice:
        roundNumber(
          entry,
          4
        ),

      stopLoss:
        roundNumber(
          stop,
          4
        ),

      riskPerShare:
        roundNumber(
          finalRiskPerShare,
          4
        ),

      quantity: 0,

      positionValue: 0,

      actualRiskAmount: 0,

      actualRiskPercent: 0,

      capitalAvailable: true,

      reason:
        'Calculated position quantity is zero.'

    };

  }


  // ----------------------------------------------------------
  // POSITION VALUE
  // ----------------------------------------------------------

  const positionValue =
    quantity *
    entry;


  // ----------------------------------------------------------
  // CAPITAL SAFETY
  // ----------------------------------------------------------

  const capitalAvailable =
    positionValue <=
    capital;


  if (
    !capitalAvailable
  ) {

    return {

      valid: false,

      accountCapital:
        roundNumber(
          capital,
          4
        ),

      maxRiskPercent:
        roundNumber(
          riskPercent,
          4
        ),

      maxRiskAmount:
        roundNumber(
          maxRiskAmount,
          4
        ),

      entryPrice:
        roundNumber(
          entry,
          4
        ),

      stopLoss:
        roundNumber(
          stop,
          4
        ),

      riskPerShare:
        roundNumber(
          finalRiskPerShare,
          4
        ),

      quantity,

      positionValue:
        roundNumber(
          positionValue,
          4
        ),

      actualRiskAmount:
        roundNumber(
          quantity *
          finalRiskPerShare,
          4
        ),

      actualRiskPercent:
        roundNumber(

          (
            quantity *
            finalRiskPerShare /
            capital
          ) *
          100,

          6

        ),

      capitalAvailable: false,

      reason:
        'Position value exceeds available account capital.'

    };

  }


  // ----------------------------------------------------------
  // ACTUAL RISK
  // ----------------------------------------------------------

  const actualRiskAmount =
    quantity *
    finalRiskPerShare;


  const actualRiskPercent =
    (
      actualRiskAmount /
      capital
    ) *
    100;


  // ----------------------------------------------------------
  // FINAL RESULT
  // ----------------------------------------------------------

  return {

    valid: true,

    accountCapital:
      roundNumber(
        capital,
        4
      ),

    maxRiskPercent:
      roundNumber(
        riskPercent,
        4
      ),

    maxRiskAmount:
      roundNumber(
        maxRiskAmount,
        4
      ),

    entryPrice:
      roundNumber(
        entry,
        4
      ),

    stopLoss:
      roundNumber(
        stop,
        4
      ),

    riskPerShare:
      roundNumber(
        finalRiskPerShare,
        4
      ),

    quantity,

    positionValue:
      roundNumber(
        positionValue,
        4
      ),

    actualRiskAmount:
      roundNumber(
        actualRiskAmount,
        4
      ),

    actualRiskPercent:
      roundNumber(
        actualRiskPercent,
        6
      ),

    capitalAvailable: true,

    reason:
      'Position size calculated successfully.'

  };

}


// ============================================================
// TRADE SETUP BUILDER
// ============================================================

export function buildTradeSetup({

  symbol,

  direction,

  entryPrice,

  stopLoss,

  targetPrice,

  atr,

  atrMultiplier,

  riskPerShare,

  rewardPerShare,

  riskRewardRatio,

  technicalScore,

  fundamentalScore,

  marketRegimeScore,

  riskQualityScore,

  opportunityScore,

  riskGatesPassed,

  recommendation,

  accountCapital,

  maxRiskPercent

} = {}) {

  // ----------------------------------------------------------
  // NORMALIZE INPUTS
  // ----------------------------------------------------------

  const entry =
    toFiniteNumber(
      entryPrice
    );

  const atrValue =
    toFiniteNumber(
      atr
    );

  const multiplier =
    toFiniteNumber(
      atrMultiplier
    ) ??
    DEFAULT_ATR_MULTIPLIER;

  const requestedRR =
    toFiniteNumber(
      riskRewardRatio
    ) ??
    DEFAULT_RISK_REWARD_RATIO;


  // ----------------------------------------------------------
  // RESOLVE STOP LOSS
  //
  // IMPORTANT:
  // If pipeline does not pass stopLoss correctly,
  // reconstruct it from ENTRY + ATR + DIRECTION.
  // ----------------------------------------------------------

  let resolvedStopLoss =
    toFiniteNumber(
      stopLoss
    );


  if (
    resolvedStopLoss === null &&
    entry !== null &&
    entry > 0 &&
    atrValue !== null &&
    atrValue > 0
  ) {

    const atrRisk =
      atrValue *
      multiplier;


    if (
      direction === 'BEARISH'
    ) {

      resolvedStopLoss =
        entry +
        atrRisk;

    } else if (
      direction === 'BULLISH'
    ) {

      resolvedStopLoss =
        entry -
        atrRisk;

    }

  }


  // ----------------------------------------------------------
  // RESOLVE RISK PER SHARE
  // ----------------------------------------------------------

  let resolvedRiskPerShare =
    toFiniteNumber(
      riskPerShare
    );


  if (
    resolvedRiskPerShare === null &&
    entry !== null &&
    resolvedStopLoss !== null
  ) {

    resolvedRiskPerShare =
      Math.abs(
        entry -
        resolvedStopLoss
      );

  }


  // ----------------------------------------------------------
  // RESOLVE TARGET PRICE
  //
  // If targetPrice is unavailable, derive it from
  // risk/reward ratio.
  // ----------------------------------------------------------

  let resolvedTargetPrice =
    toFiniteNumber(
      targetPrice
    );


  if (
    resolvedTargetPrice === null &&
    entry !== null &&
    resolvedRiskPerShare !== null &&
    resolvedRiskPerShare > 0
  ) {

    const reward =
      resolvedRiskPerShare *
      requestedRR;


    if (
      direction === 'BEARISH'
    ) {

      resolvedTargetPrice =
        entry -
        reward;

    } else if (
      direction === 'BULLISH'
    ) {

      resolvedTargetPrice =
        entry +
        reward;

    }

  }


  // ----------------------------------------------------------
  // RESOLVE REWARD PER SHARE
  // ----------------------------------------------------------

  let resolvedRewardPerShare =
    toFiniteNumber(
      rewardPerShare
    );


  if (
    resolvedRewardPerShare === null &&
    entry !== null &&
    resolvedTargetPrice !== null
  ) {

    resolvedRewardPerShare =
      Math.abs(
        resolvedTargetPrice -
        entry
      );

  }


  // ----------------------------------------------------------
  // RESOLVE RISK REWARD RATIO
  // ----------------------------------------------------------

  let resolvedRiskRewardRatio =
    toFiniteNumber(
      riskRewardRatio
    );


  if (
    resolvedRiskRewardRatio === null &&
    resolvedRiskPerShare !== null &&
    resolvedRiskPerShare > 0 &&
    resolvedRewardPerShare !== null
  ) {

    resolvedRiskRewardRatio =
      resolvedRewardPerShare /
      resolvedRiskPerShare;

  }


  if (
    resolvedRiskRewardRatio === null
  ) {

    resolvedRiskRewardRatio =
      DEFAULT_RISK_REWARD_RATIO;

  }


  // ----------------------------------------------------------
  // POSITION SIZING
  //
  // IMPORTANT:
  // Use RESOLVED stop loss here.
  // ----------------------------------------------------------

  const positionSizing =
    calculatePositionSize({

      accountCapital,

      maxRiskPercent,

      entryPrice:
        entry,

      stopLoss:
        resolvedStopLoss,

      riskPerShare:
        resolvedRiskPerShare

    });


  // ----------------------------------------------------------
  // SETUP VALIDATION
  // ----------------------------------------------------------

  const setupValid =
    Boolean(
      symbol
    ) &&

    (
      direction === 'BULLISH' ||
      direction === 'BEARISH'
    ) &&

    entry !== null &&
    entry > 0 &&

    resolvedStopLoss !== null &&
    resolvedStopLoss > 0 &&

    resolvedTargetPrice !== null &&
    resolvedTargetPrice > 0 &&

    resolvedRiskPerShare !== null &&
    resolvedRiskPerShare > 0 &&

    resolvedRewardPerShare !== null &&
    resolvedRewardPerShare > 0 &&

    resolvedRiskRewardRatio > 0 &&

    positionSizing.valid;


  // ----------------------------------------------------------
  // FINAL TRADE SETUP
  // ----------------------------------------------------------

  return {

    valid:
      setupValid,

    symbol:
      symbol || null,

    direction:
      direction || 'NONE',

    entryPrice:
      roundNumber(
        entry,
        4
      ),

    stopLoss:
      roundNumber(
        resolvedStopLoss,
        4
      ),

    targetPrice:
      roundNumber(
        resolvedTargetPrice,
        4
      ),

    atr:
      roundNumber(
        atrValue,
        4
      ),

    atrMultiplier:
      roundNumber(
        multiplier,
        4
      ),

    riskPerShare:
      roundNumber(
        resolvedRiskPerShare,
        4
      ),

    rewardPerShare:
      roundNumber(
        resolvedRewardPerShare,
        4
      ),

    riskRewardRatio:
      roundNumber(
        resolvedRiskRewardRatio,
        2
      ),

    technicalScore:
      Number(
        technicalScore || 0
      ),

    fundamentalScore:
      Number(
        fundamentalScore || 0
      ),

    marketRegimeScore:
      Number(
        marketRegimeScore || 0
      ),

    riskQualityScore:
      Number(
        riskQualityScore || 0
      ),

    opportunityScore:
      Number(
        opportunityScore || 0
      ),

    riskGatesPassed:
      Boolean(
        riskGatesPassed
      ),

    recommendation:
      recommendation || 'NO TRADE',

    positionSizing

  };

}


// ============================================================
// CONFIG EXPORT
// ============================================================

export function getPositionSizingConfig() {

  return {

    defaultMaxRiskPercent:
      DEFAULT_MAX_RISK_PERCENT,

    minRiskPercent:
      MIN_RISK_PERCENT,

    maxRiskPercent:
      MAX_RISK_PERCENT,

    defaultAtrMultiplier:
      DEFAULT_ATR_MULTIPLIER,

    defaultRiskRewardRatio:
      DEFAULT_RISK_REWARD_RATIO

  };

}


// ============================================================
// SERVICE STATUS
// ============================================================

console.log(
  'AI TRADE PRO — position sizing engine loaded'
);