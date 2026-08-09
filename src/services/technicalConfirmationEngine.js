// AI TRADE PRO
// Technical Confirmation Engine

const TECHNICAL_CONFIRMATION_CONFIG = Object.freeze({
  minimumBullishSignals: 4,
  minimumBearishSignals: 4,

  minimumBullishScore: 70,
  maximumBearishScore: 30
});

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function getDirectionalScore(
  technicalAnalysis = {}
) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  const signals = [];

  // TREND
  const trend =
    normalizeText(
      technicalAnalysis?.trend?.direction
    );

  if (trend.includes('BULLISH')) {
    bullish++;
    signals.push({
      name: 'TREND',
      direction: 'BULLISH'
    });
  } else if (trend.includes('BEARISH')) {
    bearish++;
    signals.push({
      name: 'TREND',
      direction: 'BEARISH'
    });
  } else {
    neutral++;
    signals.push({
      name: 'TREND',
      direction: 'NEUTRAL'
    });
  }

  // MOMENTUM
  const momentum =
    normalizeText(
      technicalAnalysis?.momentum?.direction
    );

  if (momentum === 'BULLISH') {
    bullish++;
    signals.push({
      name: 'MOMENTUM',
      direction: 'BULLISH'
    });
  } else if (momentum === 'BEARISH') {
    bearish++;
    signals.push({
      name: 'MOMENTUM',
      direction: 'BEARISH'
    });
  } else {
    neutral++;
    signals.push({
      name: 'MOMENTUM',
      direction: 'NEUTRAL'
    });
  }

  // SUPERTREND
  const supertrend =
    normalizeText(
      technicalAnalysis?.supertrend?.direction
    );

  if (supertrend === 'BULLISH') {
    bullish++;
    signals.push({
      name: 'SUPERTREND',
      direction: 'BULLISH'
    });
  } else if (supertrend === 'BEARISH') {
    bearish++;
    signals.push({
      name: 'SUPERTREND',
      direction: 'BEARISH'
    });
  } else {
    neutral++;
    signals.push({
      name: 'SUPERTREND',
      direction: 'NEUTRAL'
    });
  }

  // CANDLESTICK
  const candle =
    normalizeText(
      technicalAnalysis?.candlestick?.signal
    );

  if (candle === 'BULLISH') {
    bullish++;
    signals.push({
      name: 'CANDLESTICK',
      direction: 'BULLISH'
    });
  } else if (candle === 'BEARISH') {
    bearish++;
    signals.push({
      name: 'CANDLESTICK',
      direction: 'BEARISH'
    });
  } else {
    neutral++;
    signals.push({
      name: 'CANDLESTICK',
      direction: 'NEUTRAL'
    });
  }

  // BREAKOUT
  const breakout =
    technicalAnalysis?.breakout || {};

  const breakoutDirection =
    normalizeText(
      breakout.direction
    );

  if (
    breakout.breakout === true &&
    breakoutDirection === 'BULLISH'
  ) {
    bullish++;
    signals.push({
      name: 'BREAKOUT',
      direction: 'BULLISH'
    });
  } else if (
    breakout.breakout === true &&
    breakoutDirection === 'BEARISH'
  ) {
    bearish++;
    signals.push({
      name: 'BREAKOUT',
      direction: 'BEARISH'
    });
  } else {
    neutral++;
    signals.push({
      name: 'BREAKOUT',
      direction: 'NEUTRAL'
    });
  }

  // VWAP
  const currentPrice =
    Number(
      technicalAnalysis?.currentPrice
    );

  const vwap =
    Number(
      technicalAnalysis?.vwap
    );

  if (
    Number.isFinite(currentPrice) &&
    Number.isFinite(vwap)
  ) {
    if (currentPrice > vwap) {
      bullish++;
      signals.push({
        name: 'VWAP',
        direction: 'BULLISH'
      });
    } else if (currentPrice < vwap) {
      bearish++;
      signals.push({
        name: 'VWAP',
        direction: 'BEARISH'
      });
    } else {
      neutral++;
      signals.push({
        name: 'VWAP',
        direction: 'NEUTRAL'
      });
    }
  } else {
    neutral++;
    signals.push({
      name: 'VWAP',
      direction: 'NEUTRAL'
    });
  }

  const totalSignals =
    bullish +
    bearish +
    neutral;

  const score =
    totalSignals > 0
      ? Number(
          (
            50 +
            (
              (bullish - bearish) /
              totalSignals
            ) * 50
          ).toFixed(2)
        )
      : 50;

  return {
    bullish,
    bearish,
    neutral,
    totalSignals,
    score,
    signals
  };
}


// ============================================================
// MAIN CONFIRMATION ENGINE
// ============================================================

export function evaluateTechnicalConfirmation(
  technicalAnalysis = {}
) {
  if (
    !technicalAnalysis ||
    typeof technicalAnalysis !== 'object'
  ) {
    return {
      valid: false,
      confirmed: false,
      direction: 'NONE',
      score: 0,
      reason:
        'Technical analysis data is required.'
    };
  }

  const result =
    getDirectionalScore(
      technicalAnalysis
    );

  const bullishConfirmed =
    result.bullish >=
      TECHNICAL_CONFIRMATION_CONFIG
        .minimumBullishSignals &&
    result.score >=
      TECHNICAL_CONFIRMATION_CONFIG
        .minimumBullishScore;

  const bearishConfirmed =
    result.bearish >=
      TECHNICAL_CONFIRMATION_CONFIG
        .minimumBearishSignals &&
    result.score <=
      TECHNICAL_CONFIRMATION_CONFIG
        .maximumBearishScore;

  let direction = 'NONE';
  let confirmed = false;

  if (bullishConfirmed) {
    direction = 'BULLISH';
    confirmed = true;
  } else if (bearishConfirmed) {
    direction = 'BEARISH';
    confirmed = true;
  }

  return {
    valid: true,

    confirmed,

    direction,

    score:
      result.score,

    bullishSignals:
      result.bullish,

    bearishSignals:
      result.bearish,

    neutralSignals:
      result.neutral,

    signals:
      result.signals
  };
}


export function getTechnicalConfirmationConfig() {
  return {
    ...TECHNICAL_CONFIRMATION_CONFIG
  };
}


console.log(
  'AI TRADE PRO — technical confirmation engine loaded'
);