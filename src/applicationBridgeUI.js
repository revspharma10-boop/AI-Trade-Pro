// ============================================================
// AI TRADE PRO
// Application UI Bridge
// STEP 2H — REAL PIPELINE + TRADE DECISION
// ============================================================

import {
  runApplicationAnalysis
} from './services/applicationAnalysis.js';


function setText(selector, value) {
  const element =
    document.querySelector(selector);

  if (element) {
    element.textContent = String(value);
  }
}


function renderResult(result) {
  const pipeline = result.pipeline;
  const decision = result.tradeDecision;

  const recommendation =
    pipeline.recommendation?.recommendation ||
    'NO TRADE';

  const score =
    pipeline.opportunityScore ?? 0;

  const riskQuality =
    pipeline.riskQualityScore ?? 0;

  const riskReward =
    pipeline.riskRewardRatio ?? 0;

  const gatesPassed =
    pipeline.riskGatesPassed === true;

  const action =
    decision.action || 'NONE';

  const decisionText =
    decision.decision || 'NO TRADE';

  const reason =
    decision.reason ||
    'No decision reason supplied.';

  const panel =
    document.querySelector('.recommendation-panel');

  if (panel) {
    const emptyState =
      panel.querySelector('.empty-state');

    if (emptyState) {
      emptyState.innerHTML = `
        <div class="empty-icon">🎯</div>
        <h4>${decisionText} — ${action}</h4>
        <p>
          Recommendation: ${recommendation}<br>
          Opportunity Score: ${score}<br>
          Risk Quality: ${riskQuality}<br>
          Risk/Reward: ${riskReward}<br>
          Risk Gates: ${gatesPassed ? 'PASSED' : 'FAILED'}
        </p>
        <small>${reason}</small>
        <button class="primary-btn" id="run-analysis-btn">
          Run Market Analysis Again
        </button>
      `;
    }
  }

  console.group('AI TRADE PRO — REAL APPLICATION ANALYSIS');
  console.table({
    AnalysisExecuted: result.analysisExecuted,
    RecommendationGenerated:
      result.recommendationGenerated,
    OpportunityScore: score,
    RiskQualityScore: riskQuality,
    RiskRewardRatio: riskReward,
    RiskGatesPassed: gatesPassed,
    Recommendation: recommendation,
    Decision: decisionText,
    Action: action,
    Executable: decision.executable,
    Symbol: decision.symbol,
    Direction: decision.direction
  });
  console.log('Trade Decision:', decision);
  console.log('Pipeline:', pipeline);
  console.groupEnd();

  attachAnalysisButton();
}


async function runAnalysis() {
  const button =
    document.querySelector('#run-analysis-btn');

  if (button) {
    button.disabled = true;
    button.textContent = 'Analysis Engine Running...';
  }

  try {
    const result =
      await runApplicationAnalysis(
        'INFY:NSE',
        {
          interval: '1day',
          outputSize: 60,
          accountCapital: 1000000,
          maxRiskPercent: 1
        }
      );

    renderResult(result);

  } catch (error) {
    console.error(
      'AI TRADE PRO — REAL APPLICATION ANALYSIS FAILED',
      error
    );

    if (button) {
      button.disabled = false;
      button.textContent = 'Analysis Failed — Try Again';
    }
  }
}


function attachAnalysisButton() {
  const original =
    document.querySelector('#run-analysis-btn');

  if (!original) {
    return;
  }

  // Remove the original main.js listener by replacing the node.
  const replacement =
    original.cloneNode(true);

  original.replaceWith(replacement);

  replacement.addEventListener(
    'click',
    runAnalysis
  );
}


// main.js renders synchronously. Wait one microtask so its DOM is ready.
queueMicrotask(() => {
  attachAnalysisButton();
  console.log(
    'AI TRADE PRO — real application UI bridge loaded'
  );
});
