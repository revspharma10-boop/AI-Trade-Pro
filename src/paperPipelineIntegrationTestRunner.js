/* AI TRADE PRO — PAPER PIPELINE INTEGRATION TEST
 * Exercises the production paper-trading application bridge end-to-end.
 * No broker/exchange adapter is imported or invoked.
 */

import {
  initializePaperTradingApplication,
  scanPaperCandidates,
  stagePaperCandidate,
  fillPaperOrder,
  markPaperSymbol,
  closePaperSymbol,
  getPaperTradingApplicationState
} from './paperTradingApplicationBridge.js';

export async function runPaperPipelineIntegrationTest() {
  const results = [];
  const test = (name, passed, details = '') => results.push({ name, passed: Boolean(passed), details });

  const initial = initializePaperTradingApplication({ initialCapital: 100000 });
  test('Application initializes safely', initial.safe === true);
  test('Application is paper-only', initial.paperOnly === true && initial.realOrderPlaced === false);

  const candidates = [{
    symbol: 'PAPERTEST', recommendation: 'BUY', opportunityScore: 85,
    riskRewardRatio: 2, riskQualityScore: 90, riskGatesPassed: true,
    quantity: 10, price: 100, entryPrice: 100, stopLoss: 95, targetPrice: 120
  }];

  const cycle = scanPaperCandidates(candidates);
  test('Scanner produces executable candidate', cycle.executable === 1 && cycle.candidates?.[0]?.symbol === 'PAPERTEST');
  test('Scanner output remains paper-only', cycle.paperOnly === true && cycle.realOrderPlaced === false);

  const staged = stagePaperCandidate(candidates[0]);
  test('Candidate stages as paper order', staged.status === 'PAPER_QUEUED' && staged.paperOnly === true && staged.realOrderPlaced === false);
  test('Staged order has an order id', typeof staged.id === 'string' && staged.id.length > 0);

  const filled = fillPaperOrder(staged.id, 100);
  test('Paper order fills into a paper position', filled.position?.status === 'OPEN' && filled.realOrderPlaced === false);

  const marked = markPaperSymbol('PAPERTEST', 110);
  test('Paper position marks to market', marked.openPositions === 1 && marked.unrealizedPnL === 100);

  const closed = closePaperSymbol('PAPERTEST', 120);
  test('Paper position closes', closed.valid === true && closed.status === 'CLOSED');
  test('Realized P&L is 200', closed.realizedPnL === 200);

  const finalState = getPaperTradingApplicationState();
  const snapshot = finalState.state?.snapshot || {};
  test('Portfolio has no open positions', snapshot.openPositions === 0 && snapshot.closedPositions === 1);
  test('Journal contains the closed paper trade', snapshot.journalTrades === 1);
  test('Final realized P&L is 200', snapshot.realizedPnL === 200 && snapshot.dailyRealizedPnL === 200);
  test('Final application remains safe', finalState.safe === true);
  test('No real order was placed', finalState.realOrderPlaced === false);
  test('Paper-only mode remains enforced', finalState.paperOnly === true);

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const report = Object.freeze({
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    initialCapital: 100000,
    finalRealizedPnL: snapshot.realizedPnL,
    openPositions: snapshot.openPositions,
    journalTrades: snapshot.journalTrades,
    paperOnly: true,
    realOrderPlaced: false,
    results: [...results]
  });

  console.table(report);
  console.log(`PAPER PIPELINE INTEGRATION: ${report.suiteStatus}`);
  return report;
}

console.log('AI TRADE PRO — paper pipeline integration runner loaded');
