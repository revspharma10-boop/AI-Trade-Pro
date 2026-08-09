// ============================================================
// AI TRADE PRO — STEPS 2AA–2AD BULK TEST RUNNER
// Portfolio Risk → Paper Session → Journal → Safety Contract
// ============================================================

import { calculatePortfolioRisk, authorizePaperTrade } from './services/portfolioRiskEngine.js';
import { createPaperTradingSession, submitPaperTrade, updatePaperTrade, closePaperTrade, getPaperSessionSnapshot } from './services/paperTradingSessionEngine.js';
import { createTradeJournal, recordTradeJournal, summarizeTradeJournal } from './services/tradeJournalEngine.js';

const results = [];
function assert(name, condition) {
  const passed = Boolean(condition);
  results.push({ name, passed });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}`);
}

console.log('='.repeat(60));
console.log('AI TRADE PRO — STEPS 2AA–2AD BULK TEST RUNNER');
console.log('='.repeat(60));

const session = createPaperTradingSession({
  initialCapital: 100000,
  riskConfig: { maxDrawdownPercent: 10, maxOpenPositions: 3, maxCapitalPerTradePercent: 20 }
});

assert('Session is valid', session.valid === true);
assert('Session is paper-only', session.paperOnly === true);
assert('Session reports no real order', session.realOrderPlaced === false);

const initialRisk = calculatePortfolioRisk(session.portfolio, session.riskConfig);
assert('Initial capital risk state is valid', initialRisk.valid === true);
assert('Initial drawdown is zero', initialRisk.drawdownPercent === 0);
assert('Initial exposure is zero', initialRisk.exposure === 0);

// IMPORTANT: 20 shares × ₹1,000 = ₹20,000 = exactly 20% of ₹100,000.
// This deliberately stays inside the configured maxCapitalPerTradePercent gate.
const safeOrder = {
  symbol: 'INFY:NSE', side: 'BUY', action: 'LONG', quantity: 20,
  entryPrice: 1000, stopLoss: 970, targetPrice: 1060, paperOnly: true
};

const authorization = authorizePaperTrade({ portfolio: session.portfolio, order: safeOrder, config: session.riskConfig });
assert('Safe order is authorized', authorization.authorized === true);
assert('Safe order remains paper-only', authorization.realOrderPlaced === false);

const opened = submitPaperTrade(session, safeOrder);
assert('Safe paper trade opens position', opened.executed === true);
assert('Safe paper trade places no real order', opened.realOrderPlaced === false);
assert('One paper position exists', session.portfolio.positions.length === 1);

const marked = updatePaperTrade(session, 'INFY:NSE', 1025);
assert('Open position can be marked to market', marked.updated === true);
assert('Unrealized P&L becomes positive', session.portfolio.unrealizedPnL > 0);

const closed = closePaperTrade(session, 'INFY:NSE', 1060, 'TARGET_HIT');
assert('Paper position closes', closed.closed === true);
assert('Realized P&L is positive', closed.realizedPnL > 0);
assert('No real order was placed on close', closed.realOrderPlaced === false);
assert('No open positions remain', session.portfolio.positions.length === 0);

const oversized = authorizePaperTrade({
  portfolio: session.portfolio,
  order: { ...safeOrder, symbol: 'TCS:NSE', quantity: 1000 },
  config: session.riskConfig
});
assert('Oversized trade is rejected', oversized.authorized === false);
assert('Oversized trade remains paper-only', oversized.realOrderPlaced === false);

const journal = createTradeJournal();
recordTradeJournal(journal, {
  symbol: 'INFY:NSE', decision: 'BUY', action: 'LONG', entryPrice: 1000,
  exitPrice: 1060, quantity: 20, realizedPnL: closed.realizedPnL
});
recordTradeJournal(journal, { symbol: 'BAD:NSE', decision: 'NO TRADE', action: 'NONE', realizedPnL: 0 });

const journalSummary = summarizeTradeJournal(journal);
assert('Journal summary is valid', journalSummary.valid === true);
assert('Journal remains paper-only', journalSummary.paperOnly === true);
assert('Journal counts one executable trade', journalSummary.totalTrades === 1);
assert('Journal records one winner', journalSummary.winningTrades === 1);
assert('Journal ignores NO TRADE as an executed trade', journalSummary.totalTrades !== 2);

const snapshot = getPaperSessionSnapshot(session);
assert('Session snapshot is valid', snapshot.valid === true);
assert('Session snapshot remains paper-only', snapshot.paperOnly === true);
assert('Session snapshot reports no real order', snapshot.realOrderPlaced === false);
assert('Final portfolio has no open positions', snapshot.portfolio.openPositions === 0);
assert('Final portfolio realized P&L is positive', snapshot.portfolio.realizedPnL > 0);

console.log('='.repeat(60));
console.log('STEP 2AA–2AD SUMMARY');
console.table({
  InitialCapital: session.initialCapital,
  FinalEquity: snapshot.portfolio.equity,
  RealizedPnL: snapshot.portfolio.realizedPnL,
  OpenPositions: snapshot.portfolio.openPositions,
  ClosedPositions: snapshot.portfolio.closedPositions,
  JournalTrades: journalSummary.totalTrades,
  JournalWinRate: journalSummary.winRatePercent,
  PaperOnly: snapshot.paperOnly,
  RealOrderPlaced: snapshot.realOrderPlaced
});

const passed = results.filter(item => item.passed).length;
const failed = results.length - passed;
const allAssertionsPassed = failed === 0;

console.log('='.repeat(60));
console.log('STEP 2AA–2AD TEST RESULT');
console.log('='.repeat(60));
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: allAssertionsPassed, SuiteStatus: allAssertionsPassed ? 'PASSED' : 'FAILED' });

if (allAssertionsPassed) console.log('✅ STEP 2AA–2AD BULK TEST SUITE PASSED');
else console.error('❌ STEP 2AA–2AD BULK TEST SUITE FAILED');

export { results, allAssertionsPassed, snapshot, journalSummary };
