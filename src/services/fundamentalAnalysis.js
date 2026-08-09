// ============================================================
// AI TRADE PRO
// Fundamental Analysis Service
// ============================================================
//
// Purpose:
// Evaluate fundamental quality using available company data.
//
// This module does NOT generate a BUY/SELL order.
// It produces a fundamental score and supporting metrics.
//
// ============================================================

const SCORE_MIN = 0;
const SCORE_MAX = 100;


// ============================================================
// NUMBER HELPERS
// ============================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function clampScore(value) {
  return Math.max(
    SCORE_MIN,
    Math.min(
      SCORE_MAX,
      Math.round(value * 100) / 100
    )
  );
}


// ============================================================
// INDIVIDUAL FUNDAMENTAL COMPONENTS
// ============================================================

function scoreGrowth(data = {}) {
  const revenueGrowth =
    toNumber(data.revenueGrowth);

  const earningsGrowth =
    toNumber(data.earningsGrowth);

  if (
    revenueGrowth === null &&
    earningsGrowth === null
  ) {
    return {
      score: 50,
      status: 'UNKNOWN'
    };
  }

  const values = [
    revenueGrowth,
    earningsGrowth
  ].filter(value => value !== null);

  const average =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

  let score;

  if (average >= 20) {
    score = 90;
  } else if (average >= 10) {
    score = 75;
  } else if (average >= 5) {
    score = 65;
  } else if (average >= 0) {
    score = 55;
  } else if (average >= -10) {
    score = 40;
  } else {
    score = 25;
  }

  return {
    score,
    status:
      score >= 60
        ? 'POSITIVE'
        : 'WEAK'
  };
}


function scoreProfitability(data = {}) {
  const roe =
    toNumber(data.roe);

  const roa =
    toNumber(data.roa);

  if (
    roe === null &&
    roa === null
  ) {
    return {
      score: 50,
      status: 'UNKNOWN'
    };
  }

  const values = [
    roe,
    roa
  ].filter(value => value !== null);

  const average =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

  let score;

  if (average >= 20) {
    score = 90;
  } else if (average >= 15) {
    score = 80;
  } else if (average >= 10) {
    score = 70;
  } else if (average >= 5) {
    score = 60;
  } else if (average >= 0) {
    score = 50;
  } else {
    score = 30;
  }

  return {
    score,
    status:
      score >= 60
        ? 'POSITIVE'
        : 'WEAK'
  };
}


function scoreValuation(data = {}) {
  const pe =
    toNumber(data.pe);

  const pb =
    toNumber(data.pb);

  if (
    pe === null &&
    pb === null
  ) {
    return {
      score: 50,
      status: 'UNKNOWN'
    };
  }

  let score = 50;

  if (pe !== null) {
    if (pe > 0 && pe <= 15) {
      score += 20;
    } else if (pe <= 25) {
      score += 10;
    } else if (pe > 40) {
      score -= 20;
    }
  }

  if (pb !== null) {
    if (pb > 0 && pb <= 3) {
      score += 10;
    } else if (pb > 6) {
      score -= 10;
    }
  }

  score = clampScore(score);

  return {
    score,
    status:
      score >= 60
        ? 'ATTRACTIVE'
        : score <= 40
          ? 'EXPENSIVE'
          : 'NEUTRAL'
  };
}


function scoreDebt(data = {}) {
  const debtToEquity =
    toNumber(data.debtToEquity);

  if (debtToEquity === null) {
    return {
      score: 50,
      status: 'UNKNOWN'
    };
  }

  let score;

  if (debtToEquity <= 0.25) {
    score = 90;
  } else if (debtToEquity <= 0.5) {
    score = 80;
  } else if (debtToEquity <= 1) {
    score = 65;
  } else if (debtToEquity <= 2) {
    score = 45;
  } else {
    score = 25;
  }

  return {
    score,
    status:
      score >= 60
        ? 'HEALTHY'
        : 'HIGH DEBT'
  };
}


// ============================================================
// FUNDAMENTAL ANALYSIS
// ============================================================

export function analyzeFundamentals(data = {}) {

  const growth =
    scoreGrowth(data);

  const profitability =
    scoreProfitability(data);

  const valuation =
    scoreValuation(data);

  const debt =
    scoreDebt(data);


  const fundamentalScore =
    clampScore(
      (
        growth.score * 0.30
      ) +
      (
        profitability.score * 0.30
      ) +
      (
        valuation.score * 0.20
      ) +
      (
        debt.score * 0.20
      )
    );


  let overallSignal = 'NEUTRAL';

  if (fundamentalScore >= 70) {
    overallSignal = 'BULLISH';
  } else if (fundamentalScore <= 40) {
    overallSignal = 'BEARISH';
  }


  return {

    valid: true,

    fundamentalScore,

    overallSignal,

    growth,

    profitability,

    valuation,

    debt

  };

}


// ============================================================
// TEST / STATUS
// ============================================================

console.log(
  'AI TRADE PRO — fundamental analysis service loaded'
);