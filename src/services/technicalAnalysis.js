// ============================================================
// AI TRADE PRO
// Technical Analysis Service
// ============================================================
//
// Purpose:
// - Calculate technical indicators from OHLCV market data.
// - Produce normalized technical-analysis signals.
// - Provide the foundation for the approved Technical Score.
//
// Approved Technical Score components:
// - Trend / Moving Average structure       20
// - Momentum — RSI / MACD                  15
// - ADX / Trend strength                   10
// - Supertrend / directional confirmation  10
// - Volume confirmation                    10
// - Candlestick confirmation               10
// - Chart pattern / breakout               10
// - Support / Resistance + Fibonacci        5
// - VWAP                                     5
// - ATR / volatility suitability             5
//
// IMPORTANT:
// This file calculates indicators only.
// It does NOT generate BUY/SELL recommendations.
// The recommendation engine remains separate.
// ============================================================


// ============================================================
// GENERAL HELPERS
// ============================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}


function round(value, decimals = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  const multiplier = 10 ** decimals;

  return Math.round(number * multiplier) / multiplier;
}


function clamp(value, minimum = 0, maximum = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(maximum, number)
  );
}


function average(values) {
  const validValues = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce(
    (sum, value) => sum + value,
    0
  ) / validValues.length;
}


function sum(values) {
  const validValues = values
    .map(toNumber)
    .filter((value) => value !== null);

  return validValues.reduce(
    (total, value) => total + value,
    0
  );
}


function standardDeviation(values) {
  const validValues = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (validValues.length < 2) {
    return null;
  }

  const mean = average(validValues);

  const variance =
    validValues.reduce(
      (total, value) =>
        total + ((value - mean) ** 2),
      0
    ) / validValues.length;

  return Math.sqrt(variance);
}


// ============================================================
// DATA NORMALIZATION
// ============================================================

function normalizeValues(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => {

      if (!item || typeof item !== 'object') {
        return null;
      }

      const open = toNumber(item.open);
      const high = toNumber(item.high);
      const low = toNumber(item.low);
      const close = toNumber(item.close);
      const volume = toNumber(item.volume);

      if (
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return null;
      }

      return {
        datetime: item.datetime ?? null,
        open,
        high,
        low,
        close,
        volume: volume ?? 0
      };
    })
    .filter(Boolean);
}


function validateOHLCV(values) {
  if (!Array.isArray(values)) {
    return {
      valid: false,
      reason: 'OHLCV data must be an array.'
    };
  }

  if (values.length === 0) {
    return {
      valid: false,
      reason: 'OHLCV data is empty.'
    };
  }

  return {
    valid: true,
    reason: null
  };
}


// ============================================================
// SIMPLE MOVING AVERAGE
// ============================================================

export function calculateSMA(values = [], period = 20) {
  const numbers = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (
    numbers.length < period ||
    period <= 0
  ) {
    return null;
  }

  return round(
    average(
      numbers.slice(numbers.length - period)
    )
  );
}


// ============================================================
// EXPONENTIAL MOVING AVERAGE
// ============================================================

export function calculateEMA(values = [], period = 20) {
  const numbers = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (
    numbers.length < period ||
    period <= 0
  ) {
    return null;
  }

  const multiplier =
    2 / (period + 1);

  let ema =
    average(numbers.slice(0, period));

  for (
    let index = period;
    index < numbers.length;
    index += 1
  ) {
    ema =
      ((numbers[index] - ema) * multiplier) +
      ema;
  }

  return round(ema);
}


// ============================================================
// TRUE RANGE
// ============================================================

export function calculateTrueRanges(values = []) {
  const data = normalizeValues(values);

  if (data.length === 0) {
    return [];
  }

  const ranges = [];

  for (let index = 0; index < data.length; index += 1) {

    const current = data[index];

    if (index === 0) {

      ranges.push(
        current.high - current.low
      );

      continue;
    }

    const previousClose =
      data[index - 1].close;

    const range = Math.max(
      current.high - current.low,
      Math.abs(
        current.high - previousClose
      ),
      Math.abs(
        current.low - previousClose
      )
    );

    ranges.push(range);
  }

  return ranges;
}


// ============================================================
// ATR
// ============================================================

export function calculateATR(values = [], period = 14) {
  const trueRanges =
    calculateTrueRanges(values);

  if (
    trueRanges.length < period ||
    period <= 0
  ) {
    return null;
  }

  const initialATR =
    average(
      trueRanges.slice(0, period)
    );

  let atr = initialATR;

  for (
    let index = period;
    index < trueRanges.length;
    index += 1
  ) {

    atr =
      (
        (atr * (period - 1)) +
        trueRanges[index]
      ) / period;
  }

  return round(atr);
}


// ============================================================
// RSI
// ============================================================

export function calculateRSI(values = [], period = 14) {
  const prices = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (
    prices.length <= period ||
    period <= 0
  ) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (
    let index = 1;
    index <= period;
    index += 1
  ) {

    const change =
      prices[index] - prices[index - 1];

    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain =
    gains / period;

  let averageLoss =
    losses / period;

  for (
    let index = period + 1;
    index < prices.length;
    index += 1
  ) {

    const change =
      prices[index] - prices[index - 1];

    const gain =
      change > 0 ? change : 0;

    const loss =
      change < 0 ? Math.abs(change) : 0;

    averageGain =
      (
        (averageGain * (period - 1)) +
        gain
      ) / period;

    averageLoss =
      (
        (averageLoss * (period - 1)) +
        loss
      ) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength =
    averageGain / averageLoss;

  const rsi =
    100 -
    (100 / (1 + relativeStrength));

  return round(rsi, 2);
}


// ============================================================
// MACD
// ============================================================

export function calculateMACD(
  values = [],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {

  const prices = values
    .map(toNumber)
    .filter((value) => value !== null);

  if (
    prices.length < slowPeriod + signalPeriod
  ) {
    return {
      macd: null,
      signal: null,
      histogram: null
    };
  }

  const fastMultiplier =
    2 / (fastPeriod + 1);

  const slowMultiplier =
    2 / (slowPeriod + 1);

  let fastEMA =
    average(
      prices.slice(0, fastPeriod)
    );

  let slowEMA =
    average(
      prices.slice(0, slowPeriod)
    );

  const macdValues = [];

  for (
    let index = fastPeriod;
    index < prices.length;
    index += 1
  ) {

    fastEMA =
      (
        (prices[index] - fastEMA) *
        fastMultiplier
      ) + fastEMA;

    if (index >= slowPeriod) {

      slowEMA =
        (
          (prices[index] - slowEMA) *
          slowMultiplier
        ) + slowEMA;

      macdValues.push(
        fastEMA - slowEMA
      );
    }
  }

  if (macdValues.length < signalPeriod) {
    return {
      macd: null,
      signal: null,
      histogram: null
    };
  }

  let signal =
    average(
      macdValues.slice(0, signalPeriod)
    );

  const signalMultiplier =
    2 / (signalPeriod + 1);

  for (
    let index = signalPeriod;
    index < macdValues.length;
    index += 1
  ) {

    signal =
      (
        (macdValues[index] - signal) *
        signalMultiplier
      ) + signal;
  }

  const macd =
    macdValues[macdValues.length - 1];

  const histogram =
    macd - signal;

  return {
    macd: round(macd),
    signal: round(signal),
    histogram: round(histogram)
  };
}


// ============================================================
// ADX
// ============================================================

export function calculateADX(values = [], period = 14) {
  const data = normalizeValues(values);

  if (
    data.length < period * 2
  ) {
    return null;
  }

  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];

  for (let index = 1; index < data.length; index += 1) {

    const current = data[index];
    const previous = data[index - 1];

    const upMove =
      current.high - previous.high;

    const downMove =
      previous.low - current.low;

    const positiveDM =
      (
        upMove > downMove &&
        upMove > 0
      )
        ? upMove
        : 0;

    const negativeDM =
      (
        downMove > upMove &&
        downMove > 0
      )
        ? downMove
        : 0;

    const trueRange =
      Math.max(
        current.high - current.low,
        Math.abs(
          current.high - previous.close
        ),
        Math.abs(
          current.low - previous.close
        )
      );

    trueRanges.push(trueRange);
    plusDM.push(positiveDM);
    minusDM.push(negativeDM);
  }

  if (trueRanges.length < period) {
    return null;
  }

  let smoothedTR =
    sum(trueRanges.slice(0, period));

  let smoothedPlusDM =
    sum(plusDM.slice(0, period));

  let smoothedMinusDM =
    sum(minusDM.slice(0, period));

  const dxValues = [];

  for (
    let index = period;
    index <= trueRanges.length;
    index += 1
  ) {

    if (index > period) {

      smoothedTR =
        smoothedTR -
        (smoothedTR / period) +
        trueRanges[index - 1];

      smoothedPlusDM =
        smoothedPlusDM -
        (smoothedPlusDM / period) +
        plusDM[index - 1];

      smoothedMinusDM =
        smoothedMinusDM -
        (smoothedMinusDM / period) +
        minusDM[index - 1];
    }

    if (smoothedTR === 0) {
      continue;
    }

    const plusDI =
      100 *
      (smoothedPlusDM / smoothedTR);

    const minusDI =
      100 *
      (smoothedMinusDM / smoothedTR);

    const denominator =
      plusDI + minusDI;

    if (denominator === 0) {
      continue;
    }

    const dx =
      100 *
      Math.abs(
        plusDI - minusDI
      ) /
      denominator;

    dxValues.push(dx);
  }

  if (dxValues.length < period) {
    return null;
  }

  const adx =
    average(
      dxValues.slice(
        dxValues.length - period
      )
    );

  return round(adx, 2);
}


// ============================================================
// SUPERTREND
// ============================================================

export function calculateSupertrend(
  values = [],
  period = 10,
  multiplier = 3
) {

  const data = normalizeValues(values);

  if (
    data.length < period + 1
  ) {
    return {
      value: null,
      direction: null
    };
  }

  const atrValues = [];

  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {

    const subset =
      data.slice(
        0,
        index + 1
      );

    atrValues.push(
      calculateATR(
        subset,
        period
      )
    );
  }

  let finalUpperBand = null;
  let finalLowerBand = null;
  let supertrend = null;
  let direction = null;

  for (
    let index = period;
    index < data.length;
    index += 1
  ) {

    const current = data[index];

    const atr =
      atrValues[index];

    if (atr === null) {
      continue;
    }

    const basicUpperBand =
      (
        (current.high + current.low) / 2
      ) +
      (multiplier * atr);

    const basicLowerBand =
      (
        (current.high + current.low) / 2
      ) -
      (multiplier * atr);

    if (
      finalUpperBand === null ||
      basicUpperBand < finalUpperBand ||
      data[index - 1].close > finalUpperBand
    ) {

      finalUpperBand =
        basicUpperBand;

    }

    if (
      finalLowerBand === null ||
      basicLowerBand > finalLowerBand ||
      data[index - 1].close < finalLowerBand
    ) {

      finalLowerBand =
        basicLowerBand;

    }

    if (supertrend === null) {

      if (
        current.close <= finalUpperBand
      ) {

        supertrend =
          finalUpperBand;

        direction =
          'BEARISH';

      } else {

        supertrend =
          finalLowerBand;

        direction =
          'BULLISH';

      }

      continue;
    }

    if (
      supertrend === finalUpperBand
    ) {

      if (
        current.close <= finalUpperBand
      ) {

        supertrend =
          finalUpperBand;

        direction =
          'BEARISH';

      } else {

        supertrend =
          finalLowerBand;

        direction =
          'BULLISH';

      }

    } else {

      if (
        current.close >= finalLowerBand
      ) {

        supertrend =
          finalLowerBand;

        direction =
          'BULLISH';

      } else {

        supertrend =
          finalUpperBand;

        direction =
          'BEARISH';

      }

    }
  }

  return {
    value: round(supertrend),
    direction
  };
}


// ============================================================
// VOLUME ANALYSIS
// ============================================================

export function calculateVolumeAnalysis(
  values = [],
  period = 20
) {

  const data = normalizeValues(values);

  if (
    data.length < period
  ) {
    return {
      currentVolume: null,
      averageVolume: null,
      ratio: null,
      confirmation: 'UNKNOWN'
    };
  }

  const currentVolume =
    data[data.length - 1].volume;

  const previousVolumes =
    data
      .slice(
        Math.max(
          0,
          data.length - period - 1
        ),
        data.length - 1
      )
      .map((item) => item.volume);

  const averageVolume =
    average(previousVolumes);

  if (
    averageVolume === null ||
    averageVolume === 0
  ) {
    return {
      currentVolume: round(currentVolume),
      averageVolume: null,
      ratio: null,
      confirmation: 'UNKNOWN'
    };
  }

  const ratio =
    currentVolume / averageVolume;

  let confirmation =
    'NORMAL';

  if (ratio >= 1.5) {
    confirmation =
      'STRONG';
  } else if (ratio < 0.7) {
    confirmation =
      'WEAK';
  }

  return {
    currentVolume: round(currentVolume),
    averageVolume: round(averageVolume),
    ratio: round(ratio, 2),
    confirmation
  };
}


// ============================================================
// VWAP
// ============================================================

export function calculateVWAP(values = []) {
  const data = normalizeValues(values);

  if (data.length === 0) {
    return null;
  }

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  data.forEach((item) => {

    const typicalPrice =
      (
        item.high +
        item.low +
        item.close
      ) / 3;

    const volume =
      item.volume ?? 0;

    cumulativePriceVolume +=
      typicalPrice * volume;

    cumulativeVolume +=
      volume;

  });

  if (cumulativeVolume === 0) {
    return null;
  }

  return round(
    cumulativePriceVolume /
    cumulativeVolume
  );
}


// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

export function calculateSupportResistance(
  values = [],
  lookback = 20
) {

  const data = normalizeValues(values);

  if (
    data.length < lookback
  ) {
    return {
      support: null,
      resistance: null
    };
  }

  const recent =
    data.slice(
      data.length - lookback
    );

  const lows =
    recent.map((item) => item.low);

  const highs =
    recent.map((item) => item.high);

  return {
    support: round(Math.min(...lows)),
    resistance: round(Math.max(...highs))
  };
}


// ============================================================
// FIBONACCI LEVELS
// ============================================================

export function calculateFibonacciLevels(
  values = [],
  lookback = 50
) {

  const data = normalizeValues(values);

  if (
    data.length < 2
  ) {
    return {
      high: null,
      low: null,
      levels: {}
    };
  }

  const recent =
    data.slice(
      Math.max(
        0,
        data.length - lookback
      )
    );

  const high =
    Math.max(
      ...recent.map((item) => item.high)
    );

  const low =
    Math.min(
      ...recent.map((item) => item.low)
    );

  const range =
    high - low;

  if (range <= 0) {
    return {
      high: round(high),
      low: round(low),
      levels: {}
    };
  }

  return {
    high: round(high),
    low: round(low),

    levels: {
      level236: round(
        high - (range * 0.236)
      ),

      level382: round(
        high - (range * 0.382)
      ),

      level500: round(
        high - (range * 0.500)
      ),

      level618: round(
        high - (range * 0.618)
      ),

      level786: round(
        high - (range * 0.786)
      )
    }
  };
}


// ============================================================
// CANDLESTICK ANALYSIS
// ============================================================

export function analyzeCandlestick(values = []) {
  const data = normalizeValues(values);

  if (data.length === 0) {
    return {
      pattern: 'UNKNOWN',
      signal: 'NEUTRAL'
    };
  }

  const current =
    data[data.length - 1];

  const body =
    Math.abs(
      current.close -
      current.open
    );

  const candleRange =
    current.high -
    current.low;

  if (candleRange <= 0) {
    return {
      pattern: 'UNDEFINED',
      signal: 'NEUTRAL'
    };
  }

  const upperWick =
    current.high -
    Math.max(
      current.open,
      current.close
    );

  const lowerWick =
    Math.min(
      current.open,
      current.close
    ) -
    current.low;

  const bodyRatio =
    body / candleRange;


  // Doji

  if (bodyRatio <= 0.1) {

    return {
      pattern: 'DOJI',
      signal: 'NEUTRAL'
    };

  }


  // Bullish hammer

  if (
    lowerWick >= body * 2 &&
    upperWick <= body
  ) {

    return {
      pattern: 'HAMMER',
      signal: 'BULLISH'
    };

  }


  // Bearish shooting star

  if (
    upperWick >= body * 2 &&
    lowerWick <= body
  ) {

    return {
      pattern: 'SHOOTING STAR',
      signal: 'BEARISH'
    };

  }


  if (current.close > current.open) {

    return {
      pattern: 'BULLISH CANDLE',
      signal: 'BULLISH'
    };

  }


  if (current.close < current.open) {

    return {
      pattern: 'BEARISH CANDLE',
      signal: 'BEARISH'
    };

  }


  return {
    pattern: 'NEUTRAL CANDLE',
    signal: 'NEUTRAL'
  };
}


// ============================================================
// BREAKOUT ANALYSIS
// ============================================================

export function analyzeBreakout(
  values = [],
  lookback = 20
) {

  const data = normalizeValues(values);

  if (
    data.length <= lookback
  ) {
    return {
      breakout: false,
      direction: 'NONE'
    };
  }

  const current =
    data[data.length - 1];

  const previous =
    data.slice(
      data.length - lookback - 1,
      data.length - 1
    );

  const previousHigh =
    Math.max(
      ...previous.map((item) => item.high)
    );

  const previousLow =
    Math.min(
      ...previous.map((item) => item.low)
    );


  if (
    current.close > previousHigh
  ) {

    return {
      breakout: true,
      direction: 'BULLISH',
      level: round(previousHigh)
    };

  }


  if (
    current.close < previousLow
  ) {

    return {
      breakout: true,
      direction: 'BEARISH',
      level: round(previousLow)
    };

  }


  return {
    breakout: false,
    direction: 'NONE',
    level: null
  };
}


// ============================================================
// TREND ANALYSIS
// ============================================================

export function analyzeTrend(values = []) {
  const data = normalizeValues(values);

  if (data.length < 50) {
    return {
      direction: 'UNKNOWN',
      strength: 0,
      sma20: null,
      sma50: null,
      ema20: null
    };
  }

  const closes =
    data.map((item) => item.close);

  const currentClose =
    closes[closes.length - 1];

  const sma20 =
    calculateSMA(closes, 20);

  const sma50 =
    calculateSMA(closes, 50);

  const ema20 =
    calculateEMA(closes, 20);


  let direction =
    'SIDEWAYS';

  let strength =
    0;


  if (
    sma20 !== null &&
    sma50 !== null
  ) {

    if (
      currentClose > sma20 &&
      sma20 > sma50
    ) {

      direction =
        'BULLISH';

      strength =
        100;

    } else if (
      currentClose < sma20 &&
      sma20 < sma50
    ) {

      direction =
        'BEARISH';

      strength =
        100;

    } else if (
      currentClose > sma20
    ) {

      direction =
        'MILDLY BULLISH';

      strength =
        60;

    } else if (
      currentClose < sma20
    ) {

      direction =
        'MILDLY BEARISH';

      strength =
        60;

    }

  }


  return {
    direction,
    strength,
    currentClose: round(currentClose),
    sma20,
    sma50,
    ema20
  };
}


// ============================================================
// MOMENTUM ANALYSIS
// ============================================================

export function analyzeMomentum(values = []) {
  const closes =
    normalizeValues(values)
      .map((item) => item.close);

  const rsi =
    calculateRSI(closes, 14);

  const macd =
    calculateMACD(closes, 12, 26, 9);


  let direction =
    'NEUTRAL';

  if (
    rsi !== null &&
    macd.macd !== null &&
    macd.signal !== null
  ) {

    if (
      rsi >= 50 &&
      macd.macd > macd.signal
    ) {

      direction =
        'BULLISH';

    } else if (
      rsi < 50 &&
      macd.macd < macd.signal
    ) {

      direction =
        'BEARISH';

    }

  }


  return {
    direction,
    rsi,
    macd
  };
}


// ============================================================
// VOLATILITY ANALYSIS
// ============================================================

export function analyzeVolatility(
  values = [],
  period = 14
) {

  const data =
    normalizeValues(values);

  if (data.length === 0) {
    return {
      atr: null,
      atrPercent: null,
      level: 'UNKNOWN'
    };
  }

  const atr =
    calculateATR(data, period);

  const currentClose =
    data[data.length - 1].close;

  if (
    atr === null ||
    currentClose <= 0
  ) {

    return {
      atr,
      atrPercent: null,
      level: 'UNKNOWN'
    };

  }

  const atrPercent =
    (atr / currentClose) * 100;


  let level =
    'NORMAL';

  if (atrPercent >= 5) {

    level =
      'HIGH';

  } else if (atrPercent <= 1) {

    level =
      'LOW';

  }


  return {
    atr,
    atrPercent: round(atrPercent, 2),
    level
  };
}


// ============================================================
// TECHNICAL ANALYSIS SNAPSHOT
// ============================================================

export function analyzeTechnicalData(values = []) {

  const validation =
    validateOHLCV(values);

  if (!validation.valid) {

    return {
      valid: false,
      reason: validation.reason
    };

  }


  const data =
    normalizeValues(values);


  if (data.length === 0) {

    return {
      valid: false,
      reason: 'No valid OHLCV records found.'
    };

  }


  const closes =
    data.map((item) => item.close);


  const trend =
    analyzeTrend(data);

  const momentum =
    analyzeMomentum(data);

  const adx =
    calculateADX(data, 14);

  const supertrend =
    calculateSupertrend(data, 10, 3);

  const volume =
    calculateVolumeAnalysis(data, 20);

  const candlestick =
    analyzeCandlestick(data);

  const breakout =
    analyzeBreakout(data, 20);

  const supportResistance =
    calculateSupportResistance(data, 20);

  const fibonacci =
    calculateFibonacciLevels(data, 50);

  const vwap =
    calculateVWAP(data);

  const volatility =
    analyzeVolatility(data, 14);


  const currentClose =
    closes[closes.length - 1];


  // ==========================================================
  // TECHNICAL SIGNAL SUMMARY
  // ==========================================================

  let bullishSignals = 0;
  let bearishSignals = 0;


  if (
    trend.direction === 'BULLISH' ||
    trend.direction === 'MILDLY BULLISH'
  ) {

    bullishSignals += 1;

  } else if (
    trend.direction === 'BEARISH' ||
    trend.direction === 'MILDLY BEARISH'
  ) {

    bearishSignals += 1;

  }


  if (momentum.direction === 'BULLISH') {

    bullishSignals += 1;

  } else if (
    momentum.direction === 'BEARISH'
  ) {

    bearishSignals += 1;

  }


  if (
    supertrend.direction === 'BULLISH'
  ) {

    bullishSignals += 1;

  } else if (
    supertrend.direction === 'BEARISH'
  ) {

    bearishSignals += 1;

  }


  if (
    candlestick.signal === 'BULLISH'
  ) {

    bullishSignals += 1;

  } else if (
    candlestick.signal === 'BEARISH'
  ) {

    bearishSignals += 1;

  }


  if (
    breakout.direction === 'BULLISH'
  ) {

    bullishSignals += 1;

  } else if (
    breakout.direction === 'BEARISH'
  ) {

    bearishSignals += 1;

  }


  let overallSignal =
    'NEUTRAL';

  if (
    bullishSignals > bearishSignals
  ) {

    overallSignal =
      'BULLISH';

  } else if (
    bearishSignals > bullishSignals
  ) {

    overallSignal =
      'BEARISH';

  }


  return {

    valid: true,

    dataPoints: data.length,

    currentPrice:
      round(currentClose),

    trend,

    momentum,

    adx,

    supertrend,

    volume,

    candlestick,

    breakout,

    supportResistance,

    fibonacci,

    vwap,

    volatility,

    signalSummary: {

      bullishSignals,

      bearishSignals,

      overallSignal

    }

  };
}


// ============================================================
// TECHNICAL SCORE INPUT PREPARATION
// ============================================================
//
// This function converts indicator observations into normalized
// 0–100 component scores for the recommendation engine.
//
// It does NOT calculate the final Technical Score itself.
// That responsibility remains in recommendationEngine.js.
// ============================================================

export function prepareTechnicalScoreInputs(
  analysis = {}
) {

  if (!analysis.valid) {

    return {

      trend: 0,
      momentum: 0,
      adx: 0,
      supertrend: 0,
      volume: 0,
      candlestick: 0,
      chartPattern: 0,
      supportResistance: 0,
      vwap: 0,
      atr: 0

    };

  }


  // ----------------------------------------------------------
  // Trend
  // ----------------------------------------------------------

  let trendScore = 50;

  if (
    analysis.trend?.direction === 'BULLISH'
  ) {

    trendScore = 100;

  } else if (
    analysis.trend?.direction === 'MILDLY BULLISH'
  ) {

    trendScore = 70;

  } else if (
    analysis.trend?.direction === 'BEARISH'
  ) {

    trendScore = 0;

  } else if (
    analysis.trend?.direction === 'MILDLY BEARISH'
  ) {

    trendScore = 30;

  }


  // ----------------------------------------------------------
  // Momentum
  // ----------------------------------------------------------

  let momentumScore = 50;

  const rsi =
    analysis.momentum?.rsi;

  const macd =
    analysis.momentum?.macd;


  if (
    rsi !== null &&
    rsi !== undefined
  ) {

    if (
      rsi >= 50 &&
      rsi <= 70
    ) {

      momentumScore += 20;

    } else if (
      rsi > 70
    ) {

      momentumScore += 5;

    } else if (
      rsi < 30
    ) {

      momentumScore -= 5;

    } else if (
      rsi < 50
    ) {

      momentumScore -= 20;

    }

  }


  if (
    macd?.macd !== null &&
    macd?.signal !== null
  ) {

    if (
      macd.macd > macd.signal
    ) {

      momentumScore += 15;

    } else {

      momentumScore -= 15;

    }

  }


  momentumScore =
    clamp(momentumScore);


  // ----------------------------------------------------------
  // ADX
  // ----------------------------------------------------------

  let adxScore = 50;

  if (
    analysis.adx !== null &&
    analysis.adx !== undefined
  ) {

    if (analysis.adx >= 25) {

      adxScore = 100;

    } else if (analysis.adx >= 20) {

      adxScore = 70;

    } else {

      adxScore = 40;

    }

  }


  // ----------------------------------------------------------
  // Supertrend
  // ----------------------------------------------------------

  let supertrendScore = 50;

  if (
    analysis.supertrend?.direction === 'BULLISH'
  ) {

    supertrendScore = 100;

  } else if (
    analysis.supertrend?.direction === 'BEARISH'
  ) {

    supertrendScore = 0;

  }


  // ----------------------------------------------------------
  // Volume
  // ----------------------------------------------------------

  let volumeScore = 50;

  const volumeRatio =
    analysis.volume?.ratio;

  if (
    volumeRatio !== null &&
    volumeRatio !== undefined
  ) {

    if (volumeRatio >= 1.5) {

      volumeScore = 100;

    } else if (volumeRatio >= 1.0) {

      volumeScore = 75;

    } else if (volumeRatio >= 0.7) {

      volumeScore = 50;

    } else {

      volumeScore = 25;

    }

  }


  // ----------------------------------------------------------
  // Candlestick
  // ----------------------------------------------------------

  let candlestickScore = 50;

  if (
    analysis.candlestick?.signal === 'BULLISH'
  ) {

    candlestickScore = 100;

  } else if (
    analysis.candlestick?.signal === 'BEARISH'
  ) {

    candlestickScore = 0;

  }


  // ----------------------------------------------------------
  // Chart Pattern / Breakout
  // ----------------------------------------------------------

  let chartPatternScore = 50;

  if (
    analysis.breakout?.direction === 'BULLISH'
  ) {

    chartPatternScore = 100;

  } else if (
    analysis.breakout?.direction === 'BEARISH'
  ) {

    chartPatternScore = 0;

  }


  // ----------------------------------------------------------
  // Support / Resistance
  // ----------------------------------------------------------

  let supportResistanceScore = 50;

  const support =
    analysis.supportResistance?.support;

  const resistance =
    analysis.supportResistance?.resistance;

  const price =
    analysis.currentPrice;


  if (
    price !== null &&
    support !== null &&
    resistance !== null &&
    resistance > support
  ) {

    const range =
      resistance - support;

    const position =
      (price - support) / range;


    if (position >= 0.4 && position <= 0.7) {

      supportResistanceScore = 80;

    } else if (position < 0.4) {

      supportResistanceScore = 70;

    } else {

      supportResistanceScore = 40;

    }

  }


  // ----------------------------------------------------------
  // VWAP
  // ----------------------------------------------------------

  let vwapScore = 50;

  if (
    analysis.vwap !== null &&
    analysis.vwap !== undefined &&
    price !== null
  ) {

    if (price > analysis.vwap) {

      vwapScore = 100;

    } else if (price < analysis.vwap) {

      vwapScore = 0;

    }

  }


  // ----------------------------------------------------------
  // ATR / Volatility Suitability
  // ----------------------------------------------------------

  let atrScore = 50;

  if (
    analysis.volatility?.level === 'NORMAL'
  ) {

    atrScore = 100;

  } else if (
    analysis.volatility?.level === 'LOW'
  ) {

    atrScore = 75;

  } else if (
    analysis.volatility?.level === 'HIGH'
  ) {

    atrScore = 25;

  }


  return {

    trend:
      clamp(trendScore),

    momentum:
      clamp(momentumScore),

    adx:
      clamp(adxScore),

    supertrend:
      clamp(supertrendScore),

    volume:
      clamp(volumeScore),

    candlestick:
      clamp(candlestickScore),

    chartPattern:
      clamp(chartPatternScore),

    supportResistance:
      clamp(supportResistanceScore),

    vwap:
      clamp(vwapScore),

    atr:
      clamp(atrScore)

  };
}


// ============================================================
// SERVICE STATUS
// ============================================================

console.log(
  'AI TRADE PRO — technical analysis service loaded'
);