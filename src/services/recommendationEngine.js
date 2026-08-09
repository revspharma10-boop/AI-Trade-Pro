// ============================================================
// AI TRADE PRO
// Recommendation Engine
// ============================================================
//
// Purpose:
// - Provides the opportunity scoring engine.
// - Keeps Technical, Fundamental, Market Regime and Risk scoring
//   separate before the final recommendation is generated.
// - Provides hard risk gates.
// - Calculates Risk Quality Score from individual risk gates.
// - Calculates Opportunity Score.
// - Builds the final recommendation.
//
// STEP 2H FIX:
// calculateRiskQualityScore() now correctly accepts the
// risk-gate object + risk/reward ratio instead of treating the
// entire object as a numeric score.
//
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

export const RECOMMENDATION_CONFIG = {

  technicalWeight: 0.50,

  fundamentalWeight: 0.30,

  marketRegimeWeight: 0.10,

  riskQualityWeight: 0.10,


  strongBuyMinimum: 85,

  buyMinimum: 75,

  watchMinimum: 65,

  holdMinimum: 50,


  minimumRiskReward: 1.5
};


// ============================================================
// SCORE NORMALIZATION
// ============================================================

function clampScore(value) {

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(numericValue)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      numericValue
    )
  );
}


// ============================================================
// TECHNICAL SCORE
// ============================================================

export function calculateTechnicalScore(
  scores = {}
) {

  const trend =
    clampScore(scores.trend);

  const momentum =
    clampScore(scores.momentum);

  const adx =
    clampScore(scores.adx);

  const supertrend =
    clampScore(scores.supertrend);

  const volume =
    clampScore(scores.volume);

  const candlestick =
    clampScore(scores.candlestick);

  const chartPattern =
    clampScore(scores.chartPattern);

  const supportResistance =
    clampScore(
      scores.supportResistance
    );

  const vwap =
    clampScore(scores.vwap);

  const atr =
    clampScore(scores.atr);


  const total =

    (trend * 20) / 100 +

    (momentum * 15) / 100 +

    (adx * 10) / 100 +

    (supertrend * 10) / 100 +

    (volume * 10) / 100 +

    (candlestick * 10) / 100 +

    (chartPattern * 10) / 100 +

    (supportResistance * 5) / 100 +

    (vwap * 5) / 100 +

    (atr * 5) / 100;


  return Number(
    total.toFixed(2)
  );
}


// ============================================================
// FUNDAMENTAL SCORE
// ============================================================

export function calculateFundamentalScore(
  scores = {}
) {

  const revenueGrowth =
    clampScore(
      scores.revenueGrowth
    );

  const profitGrowth =
    clampScore(
      scores.profitGrowth
    );

  const profitability =
    clampScore(
      scores.profitability
    );

  const roeRoce =
    clampScore(
      scores.roeRoce
    );

  const debt =
    clampScore(
      scores.debt
    );

  const cashFlow =
    clampScore(
      scores.cashFlow
    );

  const valuation =
    clampScore(
      scores.valuation
    );

  const earningsConsistency =
    clampScore(
      scores.earningsConsistency
    );

  const businessSector =
    clampScore(
      scores.businessSector
    );

  const riskFlags =
    clampScore(
      scores.riskFlags
    );


  const total =

    (revenueGrowth * 15) / 100 +

    (profitGrowth * 15) / 100 +

    (profitability * 10) / 100 +

    (roeRoce * 10) / 100 +

    (debt * 10) / 100 +

    (cashFlow * 10) / 100 +

    (valuation * 10) / 100 +

    (earningsConsistency * 10) / 100 +

    (businessSector * 5) / 100 +

    (riskFlags * 5) / 100;


  return Number(
    total.toFixed(2)
  );
}


// ============================================================
// MARKET REGIME SCORE
// ============================================================

export function calculateMarketRegimeScore(
  value = 0
) {

  return clampScore(
    value
  );
}


// ============================================================
// RISK QUALITY SCORE
// ============================================================
//
// STEP 2H FIX
//
// Risk Quality Score is calculated from the seven individual
// risk gates.
//
// Weights:
//
// dataValid                 = 15
// liquidityAcceptable       = 15
// technicalConfirmation    = 20
// stopLossValid             = 15
// volatilityAcceptable      = 10
// marketRegimeAcceptable    = 10
// riskRewardAcceptable      = 15
//
// Total = 100
//
// The function also supports the current pipeline call:
//
// calculateRiskQualityScore(
//   riskGates,
//   riskRewardRatio
// )
//
// ============================================================

export function calculateRiskQualityScore(
  riskGates = {},
  riskRewardRatio = 0
) {

  // ----------------------------------------------------------
  // Normalize input
  // ----------------------------------------------------------

  const gates =
    riskGates &&
    typeof riskGates === 'object'
      ? riskGates
      : {};


  // ----------------------------------------------------------
  // Individual gates
  // ----------------------------------------------------------

  const dataValid =
    Boolean(
      gates.dataValid
    );


  const liquidityAcceptable =
    Boolean(
      gates.liquidityAcceptable
    );


  const technicalConfirmation =
    Boolean(
      gates.technicalConfirmation
    );


  const stopLossValid =
    Boolean(
      gates.stopLossValid
    );


  const volatilityAcceptable =
    Boolean(
      gates.volatilityAcceptable
    );


  const marketRegimeAcceptable =
    Boolean(
      gates.marketRegimeAcceptable
    );


  // ----------------------------------------------------------
  // Risk/reward gate
  // ----------------------------------------------------------
  //
  // If the caller already provides riskRewardAcceptable,
  // respect it.
  //
  // Otherwise derive it from riskRewardRatio.
  //
  // ----------------------------------------------------------

  const riskRewardAcceptable =
    typeof gates.riskRewardAcceptable === 'boolean'

      ? gates.riskRewardAcceptable

      : Number(
          riskRewardRatio
        ) >=
        RECOMMENDATION_CONFIG
          .minimumRiskReward;


  // ----------------------------------------------------------
  // Weighted score
  // ----------------------------------------------------------

  let score = 0;


  if (dataValid) {

    score += 15;

  }


  if (liquidityAcceptable) {

    score += 15;

  }


  if (technicalConfirmation) {

    score += 20;

  }


  if (stopLossValid) {

    score += 15;

  }


  if (volatilityAcceptable) {

    score += 10;

  }


  if (marketRegimeAcceptable) {

    score += 10;

  }


  if (riskRewardAcceptable) {

    score += 15;

  }


  return Number(
    clampScore(score).toFixed(2)
  );
}


// ============================================================
// FINAL OPPORTUNITY SCORE
// ============================================================

export function calculateOpportunityScore({

  technicalScore = 0,

  fundamentalScore = 0,

  marketRegimeScore = 0,

  riskQualityScore = 0

} = {}) {


  const technical =
    clampScore(
      technicalScore
    );


  const fundamental =
    clampScore(
      fundamentalScore
    );


  const marketRegime =
    clampScore(
      marketRegimeScore
    );


  const riskQuality =
    clampScore(
      riskQualityScore
    );


  const total =

    technical *
      RECOMMENDATION_CONFIG
        .technicalWeight +

    fundamental *
      RECOMMENDATION_CONFIG
        .fundamentalWeight +

    marketRegime *
      RECOMMENDATION_CONFIG
        .marketRegimeWeight +

    riskQuality *
      RECOMMENDATION_CONFIG
        .riskQualityWeight;


  return Number(
    total.toFixed(2)
  );
}


// ============================================================
// RISK / REWARD CALCULATION
// ============================================================

export function calculateRiskReward({

  entry = 0,

  stopLoss = 0,

  target = 0

} = {}) {


  const entryPrice =
    Number(entry);


  const stopPrice =
    Number(stopLoss);


  const targetPrice =
    Number(target);


  if (

    !Number.isFinite(
      entryPrice
    ) ||

    !Number.isFinite(
      stopPrice
    ) ||

    !Number.isFinite(
      targetPrice
    ) ||

    entryPrice <= 0

  ) {

    return {

      valid: false,

      ratio: 0

    };

  }


  const risk =
    Math.abs(
      entryPrice -
      stopPrice
    );


  const reward =
    Math.abs(
      targetPrice -
      entryPrice
    );


  if (
    risk <= 0
  ) {

    return {

      valid: false,

      ratio: 0

    };

  }


  const ratio =
    reward /
    risk;


  return {

    valid: true,

    risk:
      Number(
        risk.toFixed(2)
      ),

    reward:
      Number(
        reward.toFixed(2)
      ),

    ratio:
      Number(
        ratio.toFixed(2)
      )

  };
}


// ============================================================
// HARD RISK GATES
// ============================================================

export function evaluateRiskGates({

  dataValid = false,

  liquidityAcceptable = false,

  technicalConfirmation = false,

  stopLossValid = false,

  volatilityAcceptable = false,

  marketRegimeAcceptable = false,

  riskRewardRatio = 0

} = {}) {


  const gates = {

    dataValid:
      Boolean(
        dataValid
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
      Boolean(
        volatilityAcceptable
      ),


    marketRegimeAcceptable:
      Boolean(
        marketRegimeAcceptable
      ),


    riskRewardAcceptable:

      Number(
        riskRewardRatio
      ) >=
      RECOMMENDATION_CONFIG
        .minimumRiskReward

  };


  const passed =
    Object
      .values(gates)
      .every(Boolean);


  return {

    passed,

    gates

  };
}


// ============================================================
// RECOMMENDATION CLASSIFICATION
// ============================================================

export function classifyRecommendation({

  score = 0,

  riskGatesPassed = false

} = {}) {


  const opportunityScore =
    clampScore(
      score
    );


  // ----------------------------------------------------------
  // HARD SAFETY OVERRIDE
  // ----------------------------------------------------------

  if (
    !riskGatesPassed
  ) {

    return 'NO TRADE';

  }


  // ----------------------------------------------------------
  // SCORE CLASSIFICATION
  // ----------------------------------------------------------

  if (
    opportunityScore >=
    RECOMMENDATION_CONFIG
      .strongBuyMinimum
  ) {

    return 'STRONG BUY';

  }


  if (
    opportunityScore >=
    RECOMMENDATION_CONFIG
      .buyMinimum
  ) {

    return 'BUY';

  }


  if (
    opportunityScore >=
    RECOMMENDATION_CONFIG
      .watchMinimum
  ) {

    return 'WATCH / WAIT';

  }


  if (
    opportunityScore >=
    RECOMMENDATION_CONFIG
      .holdMinimum
  ) {

    return 'HOLD / WAIT';

  }


  return 'NO TRADE';
}


// ============================================================
// COMPLETE RECOMMENDATION BUILDER
// ============================================================

export function buildRecommendation({

  symbol = '',

  technicalScore = 0,

  fundamentalScore = 0,

  marketRegimeScore = 0,

  riskQualityScore = 0,

  riskRewardRatio = 0,

  riskGates = {}

} = {}) {


  // ----------------------------------------------------------
  // Opportunity Score
  // ----------------------------------------------------------

  const opportunityScore =
    calculateOpportunityScore({

      technicalScore,

      fundamentalScore,

      marketRegimeScore,

      riskQualityScore

    });


  // ----------------------------------------------------------
  // Risk Gate Evaluation
  // ----------------------------------------------------------

  const gateResult =
    evaluateRiskGates({

      ...riskGates,

      riskRewardRatio

    });


  // ----------------------------------------------------------
  // Recommendation
  // ----------------------------------------------------------

  const recommendation =
    classifyRecommendation({

      score:
        opportunityScore,

      riskGatesPassed:
        gateResult.passed

    });


  // ----------------------------------------------------------
  // Final result
  // ----------------------------------------------------------

  return {

    symbol,


    technicalScore:
      clampScore(
        technicalScore
      ),


    fundamentalScore:
      clampScore(
        fundamentalScore
      ),


    marketRegimeScore:
      clampScore(
        marketRegimeScore
      ),


    riskQualityScore:
      clampScore(
        riskQualityScore
      ),


    opportunityScore,


    riskRewardRatio:
      Number(
        riskRewardRatio
      ) || 0,


    riskGatesPassed:
      gateResult.passed,


    riskGates:
      gateResult.gates,


    recommendation

  };
}


// ============================================================
// SERVICE STATUS
// ============================================================

console.log(
  'AI TRADE PRO — recommendation engine loaded'
);