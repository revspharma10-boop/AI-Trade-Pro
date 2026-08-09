// AI TRADE PRO
// Analysis Pipeline
//
// STEP 2H
// Trade Setup + Position Sizing Integration
//
// CONTRACT FIX:
// - calculateRiskQualityScore receives ONE object argument.
// - Risk/reward fields are normalized from calculateRiskReward().
// - Risk gates remain hard safety gates.
// - Market regime threshold is intentionally NOT weakened.
// ============================================================

import {
  getQuote,
  getTimeSeries
} from './marketData.js';

import {
  analyzeTechnicalData
} from './technicalAnalysis.js';

import {
  getFundamentalData
} from './fundamentalDataService.js';

import {
  analyzeFundamentals
} from './fundamentalAnalysis.js';

import {
  analyzeMarketRegime
} from './marketRegimeEngine.js';

import {
  evaluateLiquidity
} from './liquidityEngine.js';

import {
  evaluateTechnicalConfirmation
} from './technicalConfirmationEngine.js';

import {
  buildRecommendation,
  evaluateRiskGates,
  calculateRiskQualityScore,
  calculateOpportunityScore,
  calculateRiskReward
} from './recommendationEngine.js';

import {
  buildTradeSetup,
  calculatePositionSize
} from './positionSizingEngine.js';


// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

const DEFAULT_INTERVAL = '1day';
const DEFAULT_OUTPUT_SIZE = 60;

const DEFAULT_ACCOUNT_CAPITAL = 1000000;
const DEFAULT_MAX_RISK_PERCENT = 1;

const DEFAULT_ATR_MULTIPLIER = 1.5;
const DEFAULT_REWARD_MULTIPLIER = 2;


// ============================================================
// VALIDATION
// ============================================================

function validateSymbol(symbol) {

  if (
    typeof symbol !== 'string' ||
    symbol.trim() === ''
  ) {

    throw new Error(
      'A valid market symbol is required.'
    );

  }

}


// ============================================================
// SAFE NUMBER HELPER
// ============================================================

function safeNumber(
  value,
  fallback = 0
) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;

}


// ============================================================
// MARKET DATA
// ============================================================

export async function loadMarketData(
  symbol,
  interval = DEFAULT_INTERVAL,
  outputSize = DEFAULT_OUTPUT_SIZE
) {

  validateSymbol(symbol);

  const [
    quote,
    timeSeries
  ] = await Promise.all([

    getQuote(symbol),

    getTimeSeries(
      symbol,
      interval,
      outputSize
    )

  ]);

  if (
    !timeSeries ||
    !Array.isArray(timeSeries.values)
  ) {

    throw new Error(
      'Market data time series is unavailable.'
    );

  }

  return {

    quote,

    timeSeries

  };

}


// ============================================================
// TECHNICAL ANALYSIS
// ============================================================

export function runTechnicalAnalysis(
  timeSeries
) {

  if (
    !timeSeries ||
    !Array.isArray(timeSeries.values)
  ) {

    throw new Error(
      'Valid time-series data is required.'
    );

  }

  const analysis =
    analyzeTechnicalData(
      timeSeries.values
    );

  if (
    !analysis ||
    !analysis.valid
  ) {

    throw new Error(
      analysis?.reason ||
      'Technical analysis failed.'
    );

  }

  return analysis;

}


// ============================================================
// TECHNICAL SCORE
// ============================================================

function calculateTechnicalScore(
  analysis
) {

  const signal =
    analysis
      ?.signalSummary
      ?.overallSignal;

  if (
    signal === 'BULLISH'
  ) {

    return 70;

  }

  if (
    signal === 'BEARISH'
  ) {

    return 30;

  }

  return 50;

}


// ============================================================
// FUNDAMENTAL ANALYSIS
// ============================================================

async function runFundamentalAnalysis(
  symbol,
  quote
) {

  const currentPrice =
    Number(
      quote?.close ??
      quote?.price
    );

  const marketCurrency =
    quote?.currency ||
    'INR';

  const fundamentalData =
    await getFundamentalData(

      symbol,

      Number.isFinite(currentPrice)
        ? currentPrice
        : null,

      {
        marketCurrency,

        fundamentalCurrency:
          'USD'
      }

    );

  if (
    !fundamentalData ||
    !fundamentalData.valid
  ) {

    return {

      valid: false,

      fundamentalScore: 0,

      overallSignal: 'UNKNOWN',

      data:
        fundamentalData,

      reason:
        fundamentalData?.reason ||
        'Fundamental data unavailable.'

    };

  }

  const analysis =
    analyzeFundamentals(
      fundamentalData
    );

  if (
    !analysis ||
    !analysis.valid
  ) {

    return {

      valid: false,

      fundamentalScore: 0,

      overallSignal: 'UNKNOWN',

      data:
        fundamentalData,

      reason:
        analysis?.reason ||
        'Fundamental analysis failed.'

    };

  }

  return {

    ...analysis,

    data:
      fundamentalData

  };

}


// ============================================================
// INITIAL RISK GATES
// ============================================================

function buildInitialRiskGates({

  technicalAnalysis,

  marketRegimeScore,

  liquidityAcceptable,

  technicalConfirmation,

  stopLossValid

}) {

  return {

    dataValid:
      Boolean(
        technicalAnalysis?.valid
      ),

    liquidityAcceptable:
      Boolean(
        liquidityAcceptable
      ),

    technicalConfirmation:
      Boolean(
        technicalConfirmation
      ),

    stopLossValid:
      Boolean(
        stopLossValid
      ),

    volatilityAcceptable:
      technicalAnalysis
        ?.volatility
        ?.level === 'NORMAL',

    // IMPORTANT:
    // Keep the hard market-regime safety threshold.
    //
    // Do NOT lower this merely to make a test BUY pass.
    //
    // Current diagnostics showed:
    // marketRegimeScore = 31
    // therefore this gate correctly fails.

    marketRegimeAcceptable:
      Number(
        marketRegimeScore
      ) >= 45

  };

}


// ============================================================
// STOP LOSS + TARGET CALCULATION
// ============================================================

function calculateTradeLevels({

  direction,

  entryPrice,

  atr,

  atrMultiplier =
    DEFAULT_ATR_MULTIPLIER,

  rewardMultiplier =
    DEFAULT_REWARD_MULTIPLIER

}) {

  const entry =
    Number(entryPrice);

  const atrValue =
    Number(atr);

  const multiplier =
    Number(atrMultiplier);

  const rewardFactor =
    Number(rewardMultiplier);


  if (
    !Number.isFinite(entry) ||
    entry <= 0
  ) {

    return {

      valid: false,

      reason:
        'Entry price must be greater than zero.'

    };

  }


  if (
    !Number.isFinite(atrValue) ||
    atrValue <= 0
  ) {

    return {

      valid: false,

      reason:
        'ATR must be greater than zero.'

    };

  }


  if (
    !Number.isFinite(multiplier) ||
    multiplier <= 0
  ) {

    return {

      valid: false,

      reason:
        'ATR multiplier must be greater than zero.'

    };

  }


  if (
    !Number.isFinite(rewardFactor) ||
    rewardFactor <= 0
  ) {

    return {

      valid: false,

      reason:
        'Reward multiplier must be greater than zero.'

    };

  }


  if (
    direction !== 'BULLISH' &&
    direction !== 'BEARISH'
  ) {

    return {

      valid: false,

      reason:
        'Trade direction must be BULLISH or BEARISH.'

    };

  }


  const riskDistance =
    atrValue *
    multiplier;


  let stopLoss;

  let target;


  if (
    direction === 'BULLISH'
  ) {

    stopLoss =
      entry -
      riskDistance;

    target =
      entry +
      (
        riskDistance *
        rewardFactor
      );

  } else {

    stopLoss =
      entry +
      riskDistance;

    target =
      entry -
      (
        riskDistance *
        rewardFactor
      );

  }


  if (
    stopLoss <= 0 ||
    target <= 0
  ) {

    return {

      valid: false,

      reason:
        'Calculated stop-loss or target is invalid.'

    };

  }


  return {

    valid: true,

    direction,

    entryPrice:
      Number(
        entry.toFixed(4)
      ),

    stopLoss:
      Number(
        stopLoss.toFixed(4)
      ),

    target:
      Number(
        target.toFixed(4)
      ),

    atr:
      Number(
        atrValue.toFixed(4)
      ),

    atrMultiplier:
      multiplier,

    rewardMultiplier:
      rewardFactor

  };

}


// ============================================================
// FULL ANALYSIS PIPELINE
// ============================================================

export async function runAnalysisPipeline(
  symbol,
  options = {}
) {

  validateSymbol(symbol);


  // ==========================================================
  // CONFIGURATION
  // ==========================================================

  const interval =
    options.interval ||
    DEFAULT_INTERVAL;

  const outputSize =
    options.outputSize ||
    DEFAULT_OUTPUT_SIZE;

  const accountCapital =
    safeNumber(
      options.accountCapital,
      DEFAULT_ACCOUNT_CAPITAL
    );

  const maxRiskPercent =
    safeNumber(
      options.maxRiskPercent,
      DEFAULT_MAX_RISK_PERCENT
    );

  const atrMultiplier =
    safeNumber(
      options.atrMultiplier,
      DEFAULT_ATR_MULTIPLIER
    );

  const rewardMultiplier =
    safeNumber(
      options.rewardMultiplier,
      DEFAULT_REWARD_MULTIPLIER
    );


  // ==========================================================
  // 1. MARKET DATA
  // ==========================================================

  const marketData =
    await loadMarketData(
      symbol,
      interval,
      outputSize
    );


  // ==========================================================
  // 2. TECHNICAL ANALYSIS
  // ==========================================================

  const technicalAnalysis =
    runTechnicalAnalysis(
      marketData.timeSeries
    );

  const technicalScore =
    calculateTechnicalScore(
      technicalAnalysis
    );


  // ==========================================================
  // 3. MARKET REGIME
  // ==========================================================

  const marketRegime =
    analyzeMarketRegime(
      technicalAnalysis
    );

  if (
    !marketRegime ||
    !marketRegime.valid
  ) {

    throw new Error(
      marketRegime?.reason ||
      'Market regime analysis failed.'
    );

  }


  const marketRegimeScore =
    safeNumber(
      marketRegime.score
    );


  // ==========================================================
  // 4. LIQUIDITY
  // ==========================================================

  const liquidity =
    evaluateLiquidity({

      quote:
        marketData.quote,

      technicalAnalysis

    });


  if (
    !liquidity ||
    !liquidity.valid
  ) {

    throw new Error(
      'Liquidity analysis failed.'
    );

  }


  // ==========================================================
  // 5. FUNDAMENTAL ANALYSIS
  // ==========================================================

  const fundamentalAnalysis =
    await runFundamentalAnalysis(
      symbol,
      marketData.quote
    );


  const fundamentalScore =
    Number.isFinite(
      fundamentalAnalysis
        ?.fundamentalScore
    )

      ? fundamentalAnalysis
          .fundamentalScore

      : 0;


  // ==========================================================
  // 6. TECHNICAL CONFIRMATION
  // ==========================================================

  const technicalConfirmation =
    evaluateTechnicalConfirmation(
      technicalAnalysis
    );


  if (
    !technicalConfirmation ||
    !technicalConfirmation.valid
  ) {

    throw new Error(
      technicalConfirmation?.reason ||
      'Technical confirmation analysis failed.'
    );

  }


  // ==========================================================
  // 7. TRADE DIRECTION
  // ==========================================================

  const direction =
    technicalConfirmation.direction;


  // ==========================================================
  // 8. ENTRY PRICE
  // ==========================================================

  const entryPrice =
    safeNumber(
      marketData.quote?.close ??
      marketData.quote?.price
    );


  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {

    throw new Error(
      'Valid entry price is required.'
    );

  }


  // ==========================================================
  // 9. ATR
  // ==========================================================

  const atr =
    safeNumber(
      technicalAnalysis
        ?.volatility
        ?.atr
    );


  if (
    !Number.isFinite(atr) ||
    atr <= 0
  ) {

    throw new Error(
      'Valid ATR is required for risk-reward calculation.'
    );

  }


  // ==========================================================
  // 10. STOP LOSS + TARGET
  // ==========================================================

  const tradeLevels =
    calculateTradeLevels({

      direction,

      entryPrice,

      atr,

      atrMultiplier,

      rewardMultiplier

    });


  if (
    !tradeLevels ||
    !tradeLevels.valid
  ) {

    throw new Error(
      tradeLevels?.reason ||
      'Trade level calculation failed.'
    );

  }


  // ==========================================================
  // 11. RISK REWARD
  // ==========================================================

  const riskReward =
    calculateRiskReward({

      entry:
        tradeLevels.entryPrice,

      stopLoss:
        tradeLevels.stopLoss,

      target:
        tradeLevels.target

    });


  if (
    !riskReward ||
    !riskReward.valid
  ) {

    throw new Error(
      riskReward?.reason ||
      'Risk-reward calculation failed.'
    );

  }


  // ==========================================================
  // 12. NORMALIZE RISK REWARD
  // ==========================================================

  const riskRewardRatio =
    safeNumber(
      riskReward.ratio ??
      riskReward.riskRewardRatio
    );


  const riskPerShare =
    safeNumber(
      riskReward.risk ??
      riskReward.riskPerShare
    );


  const rewardPerShare =
    safeNumber(
      riskReward.reward ??
      riskReward.rewardPerShare
    );


  // ==========================================================
  // 13. INITIAL RISK GATES
  // ==========================================================

  const riskGates =
    buildInitialRiskGates({

      technicalAnalysis,

      marketRegimeScore,

      liquidityAcceptable:
        liquidity.acceptable,

      technicalConfirmation:
        technicalConfirmation.confirmed,

      stopLossValid:
        riskReward.valid

    });


  // ==========================================================
  // 14. RISK QUALITY SCORE
  //
  // CRITICAL CONTRACT FIX
  //
  // calculateRiskQualityScore() expects ONE OBJECT:
  //
  // {
  //   dataValid,
  //   liquidityAcceptable,
  //   technicalConfirmation,
  //   stopLossValid,
  //   volatilityAcceptable,
  //   marketRegimeAcceptable,
  //   riskRewardAcceptable
  // }
  //
  // Previous implementation incorrectly passed:
  //
  // calculateRiskQualityScore(
  //   riskGates,
  //   riskRewardRatio
  // );
  //
  // Because the second argument was ignored and the first
  // argument was not passed in the expected contract shape,
  // the engine returned 0.
  //
  // We now explicitly provide the expected fields.
  // ==========================================================

  const riskQualityScore =
    calculateRiskQualityScore({

      dataValid:
        riskGates.dataValid,

      liquidityAcceptable:
        riskGates.liquidityAcceptable,

      technicalConfirmation:
        riskGates.technicalConfirmation,

      stopLossValid:
        riskGates.stopLossValid,

      volatilityAcceptable:
        riskGates.volatilityAcceptable,

      marketRegimeAcceptable:
        riskGates.marketRegimeAcceptable,

      riskRewardAcceptable:
        riskReward.riskRewardAcceptable ??
        (
          riskRewardRatio >= 1.5
        )

    });


  // ==========================================================
  // 15. FINAL RISK GATE EVALUATION
  // ==========================================================

  const evaluatedRisk =
    evaluateRiskGates({

      ...riskGates,

      riskRewardRatio

    });


  // ==========================================================
  // 16. OPPORTUNITY SCORE
  // ==========================================================

  const opportunityScore =
    calculateOpportunityScore({

      technicalScore,

      fundamentalScore,

      marketRegimeScore,

      riskQualityScore

    });


  // ==========================================================
  // 17. RECOMMENDATION
  // ==========================================================

  const recommendation =
    buildRecommendation({

      symbol,

      technicalScore,

      fundamentalScore,

      marketRegimeScore,

      riskQualityScore,

      riskRewardRatio,

      riskGates:
        evaluatedRisk.gates

    });


  // ==========================================================
  // 18. TRADE SETUP
  // ==========================================================

  const tradeSetup =
    buildTradeSetup({

      symbol,

      direction,

      entryPrice:
        tradeLevels.entryPrice,

      stopLoss:
        tradeLevels.stopLoss,

      targetPrice:
        tradeLevels.target,

      atr:
        tradeLevels.atr,

      atrMultiplier:
        tradeLevels.atrMultiplier,

      riskPerShare,

      rewardPerShare,

      riskRewardRatio,

      technicalScore,

      fundamentalScore,

      marketRegimeScore,

      riskQualityScore,

      opportunityScore,

      riskGatesPassed:
        evaluatedRisk.passed,

      recommendation:
        recommendation.recommendation,

      // --------------------------------------------------------
      // POSITION SIZING INPUTS
      // --------------------------------------------------------

      accountCapital,

      maxRiskPercent

    });


  if (
    !tradeSetup ||
    !tradeSetup.valid
  ) {

    throw new Error(
      tradeSetup?.reason ||
      'Trade setup construction failed.'
    );

  }


  // ==========================================================
  // 19. POSITION SIZING
  // ==========================================================

  const positionSizing =
    calculatePositionSize({

      accountCapital,

      maxRiskPercent,

      entryPrice:
        tradeSetup.entryPrice,

      stopLoss:
        tradeSetup.stopLoss,

      riskPerShare:
        tradeSetup.riskPerShare

    });


  if (
    !positionSizing ||
    !positionSizing.valid
  ) {

    throw new Error(
      positionSizing?.reason ||
      'Position sizing calculation failed.'
    );

  }


  // ==========================================================
  // 20. COMPLETE RESULT
  // ==========================================================

  return {

    // --------------------------------------------------------
    // Identity
    // --------------------------------------------------------

    symbol,


    // --------------------------------------------------------
    // Market data
    // --------------------------------------------------------

    quote:
      marketData.quote,

    timeSeries:
      marketData.timeSeries,


    // --------------------------------------------------------
    // Technical analysis
    // --------------------------------------------------------

    technicalAnalysis,

    technicalScore,


    // --------------------------------------------------------
    // Market regime
    // --------------------------------------------------------

    marketRegime,

    marketRegimeScore,


    // --------------------------------------------------------
    // Liquidity
    // --------------------------------------------------------

    liquidity,


    // --------------------------------------------------------
    // Fundamental analysis
    // --------------------------------------------------------

    fundamentalAnalysis,

    fundamentalScore,


    // --------------------------------------------------------
    // Technical confirmation
    // --------------------------------------------------------

    technicalConfirmation,


    // --------------------------------------------------------
    // Trade levels
    // --------------------------------------------------------

    tradeLevels,


    // --------------------------------------------------------
    // Risk reward
    // --------------------------------------------------------

    riskReward,

    riskRewardRatio,

    riskPerShare,

    rewardPerShare,


    // --------------------------------------------------------
    // Risk quality
    // --------------------------------------------------------

    riskQualityScore,


    // --------------------------------------------------------
    // Opportunity
    // --------------------------------------------------------

    opportunityScore,


    // --------------------------------------------------------
    // Risk gates
    // --------------------------------------------------------

    riskGates:
      evaluatedRisk.gates,

    riskGatesPassed:
      evaluatedRisk.passed,


    // --------------------------------------------------------
    // Recommendation
    // --------------------------------------------------------

    recommendation,


    // --------------------------------------------------------
    // Trade setup
    // --------------------------------------------------------

    tradeSetup,


    // --------------------------------------------------------
    // Position sizing
    // --------------------------------------------------------

    positionSizing,

    accountCapital,

    maxRiskPercent,


    // --------------------------------------------------------
    // Convenience fields
    // --------------------------------------------------------

    quantity:
      positionSizing.quantity,

    positionValue:
      positionSizing.positionValue,

    actualRiskAmount:
      positionSizing.actualRiskAmount,

    actualRiskPercent:
      positionSizing.actualRiskPercent

  };

}


// ============================================================
// SERVICE STATUS
// ============================================================

console.log(
  'AI TRADE PRO — analysis pipeline loaded'
);