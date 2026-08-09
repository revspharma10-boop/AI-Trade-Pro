// ============================================================
// AI TRADE PRO
// Application Analysis Orchestrator
// STEP 2H — REAL PIPELINE BRIDGE
// ============================================================
//
// This module is the single application-level bridge between:
//
//   Analysis Pipeline
//          ↓
//   Recommendation
//          ↓
//   Trade Setup
//          ↓
//   Position Sizing
//          ↓
//   Trade Decision
//
// It intentionally does NOT bypass risk gates and does NOT
// manufacture a BUY/SELL result for testing.
// ============================================================

import {
  runAnalysisPipeline
} from './analysisPipeline.js';

import {
  buildTradeDecision
} from './tradeDecisionEngine.js';


export async function runApplicationAnalysis(
  symbol,
  options = {}
) {
  const pipeline =
    await runAnalysisPipeline(
      symbol,
      options
    );

  if (!pipeline || typeof pipeline !== 'object') {
    throw new Error(
      'Analysis pipeline returned an invalid result.'
    );
  }

  const tradeDecision =
    buildTradeDecision({
      tradeSetup:
        pipeline.tradeSetup,
      positionSizing:
        pipeline.positionSizing,
      riskGatesPassed:
        pipeline.riskGatesPassed
    });

  return {
    analysisExecuted: true,
    recommendationGenerated:
      Boolean(pipeline.recommendation),
    pipeline,
    tradeDecision
  };
}


console.log(
  'AI TRADE PRO — application analysis orchestrator loaded'
);
