// AI TRADE PRO
// Market Regime Engine
//
// Converts existing technical-analysis output into a
// normalized 0–100 market regime score.
//
// Approved weighting:
// Trend       25
// Momentum    20
// Supertrend  20
// ADX         15
// Volume      10
// Volatility  10

const REGIME_CONFIG = Object.freeze({
  trendWeight: 25,
  momentumWeight: 20,
  supertrendWeight: 20,
  adxWeight: 15,
  volumeWeight: 10,
  volatilityWeight: 10,

  strongBullishMinimum: 80,
  bullishMinimum: 65,
  neutralMinimum: 45,
  bearishMinimum: 30
});


function clampScore(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, numericValue)
  );
}


function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}


// ============================================================
// COMPONENT SCORING
// ============================================================

function scoreTrend(trend = {}) {
  const direction =
    normalizeText(trend.direction);

  const strength =
    clampScore(trend.strength);

  if (direction.includes('STRONGLY BULLISH')) {
    return 100;
  }

  if (direction.includes('BULLISH')) {
    return Math.min(
      95,
      65 + strength * 0.30
    );
  }

  if (direction.includes('STRONGLY BEARISH')) {
    return 0;
  }

  if (direction.includes('BEARISH')) {
    return Math.max(
      5,
      35 - strength * 0.30
    );
  }

  return 50;
}


function scoreMomentum(momentum = {}) {
  const direction =
    normalizeText(momentum.direction);

  const rsi =
    Number(momentum.rsi);

  if (direction === 'BULLISH') {
    if (Number.isFinite(rsi)) {
      if (rsi >= 50 && rsi <= 70) {
        return 85;
      }

      if (rsi > 70) {
        return 70;
      }
    }

    return 75;
  }

  if (direction === 'BEARISH') {
    if (Number.isFinite(rsi)) {
      if (rsi >= 30 && rsi < 50) {
        return 25;
      }

      if (rsi < 30) {
        return 35;
      }
    }

    return 25;
  }

  return 50;
}


function scoreSupertrend(supertrend = {}) {
  const direction =
    normalizeText(supertrend.direction);

  if (direction === 'BULLISH') {
    return 90;
  }

  if (direction === 'BEARISH') {
    return 10;
  }

  return 50;
}


function scoreADX(adxValue) {
  const adx =
    Number(adxValue);

  if (!Number.isFinite(adx)) {
    return 50;
  }

  // ADX measures trend strength, not direction.
  // Therefore it should amplify the directional
  // components rather than independently decide
  // bullish/bearish direction.
  //
  // For the standalone component score:
  // weak trend    -> neutral
  // moderate      -> moderately directional-neutral
  // strong trend  -> strong directional-neutral

  if (adx < 20) {
    return 50;
  }

  if (adx < 25) {
    return 55;
  }

  if (adx < 40) {
    return 70;
  }

  return 85;
}


function scoreVolume(volume = {}) {
  const confirmation =
    normalizeText(volume.confirmation);

  const ratio =
    Number(volume.ratio);

  if (
    confirmation.includes('BULLISH') ||
    confirmation.includes('POSITIVE')
  ) {
    return 80;
  }

  if (
    confirmation.includes('BEARISH') ||
    confirmation.includes('NEGATIVE')
  ) {
    return 20;
  }

  if (Number.isFinite(ratio)) {
    if (ratio >= 1.5) {
      return 75;
    }

    if (ratio >= 1.0) {
      return 55;
    }

    if (ratio < 0.75) {
      return 45;
    }
  }

  return 50;
}


function scoreVolatility(volatility = {}) {
  const level =
    normalizeText(volatility.level);

  if (level === 'NORMAL') {
    return 60;
  }

  if (level === 'LOW') {
    return 55;
  }

  if (level === 'HIGH') {
    return 40;
  }

  if (level === 'EXTREME') {
    return 20;
  }

  return 50;
}


// ============================================================
// REGIME CLASSIFICATION
// ============================================================

function classifyRegime(score) {
  const normalizedScore =
    clampScore(score);

  if (
    normalizedScore >=
    REGIME_CONFIG.strongBullishMinimum
  ) {
    return 'STRONG BULLISH';
  }

  if (
    normalizedScore >=
    REGIME_CONFIG.bullishMinimum
  ) {
    return 'BULLISH';
  }

  if (
    normalizedScore >=
    REGIME_CONFIG.neutralMinimum
  ) {
    return 'NEUTRAL';
  }

  if (
    normalizedScore >=
    REGIME_CONFIG.bearishMinimum
  ) {
    return 'BEARISH';
  }

  return 'STRONG BEARISH';
}


// ============================================================
// MAIN ENGINE
// ============================================================

export function analyzeMarketRegime(
  technicalAnalysis = {}
) {
  if (
    !technicalAnalysis ||
    typeof technicalAnalysis !== 'object'
  ) {
    return {
      valid: false,
      score: 0,
      regime: 'UNKNOWN',
      reason:
        'Technical analysis data is required.'
    };
  }

  const trendScore =
    scoreTrend(
      technicalAnalysis.trend
    );

  const momentumScore =
    scoreMomentum(
      technicalAnalysis.momentum
    );

  const supertrendScore =
    scoreSupertrend(
      technicalAnalysis.supertrend
    );

  const adxScore =
    scoreADX(
      technicalAnalysis.adx
    );

  const volumeScore =
    scoreVolume(
      technicalAnalysis.volume
    );

  const volatilityScore =
    scoreVolatility(
      technicalAnalysis.volatility
    );


  const weightedScore =
    (
      trendScore *
      REGIME_CONFIG.trendWeight +

      momentumScore *
      REGIME_CONFIG.momentumWeight +

      supertrendScore *
      REGIME_CONFIG.supertrendWeight +

      adxScore *
      REGIME_CONFIG.adxWeight +

      volumeScore *
      REGIME_CONFIG.volumeWeight +

      volatilityScore *
      REGIME_CONFIG.volatilityWeight
    ) / 100;


  const score =
    Number(
      clampScore(
        weightedScore
      ).toFixed(2)
    );


  return {
    valid: true,

    score,

    regime:
      classifyRegime(score),

    components: {
      trend: {
        score:
          Number(
            trendScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.trendWeight
      },

      momentum: {
        score:
          Number(
            momentumScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.momentumWeight
      },

      supertrend: {
        score:
          Number(
            supertrendScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.supertrendWeight
      },

      adx: {
        score:
          Number(
            adxScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.adxWeight
      },

      volume: {
        score:
          Number(
            volumeScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.volumeWeight
      },

      volatility: {
        score:
          Number(
            volatilityScore.toFixed(2)
          ),
        weight:
          REGIME_CONFIG.volatilityWeight
      }
    }
  };
}


export function getMarketRegimeConfig() {
  return {
    ...REGIME_CONFIG
  };
}


console.log(
  'AI TRADE PRO — market regime engine loaded'
);