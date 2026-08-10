// AI TRADE PRO — EXTENDED PAPER OBSERVATION VALIDATION
import { createExtendedPaperObservation, assertExtendedPaperSafety } from './extendedPaperObservationEngine.js';

const tests = [];
const check = (name, condition) => { tests.push({ name, passed: Boolean(condition) }); if (!condition) console.error('❌', name); else console.log('✅', name); };

export function runExtendedPaperObservationValidation() {
  const o = createExtendedPaperObservation({ initialCapital: 100000 });
  o.start();
  let s = o.snapshot();
  check('Observation starts active', s.observationStatus === 'ACTIVE');
  check('Observation is paper-only', s.paperOnly === true);
  check('No real order is placed', s.realOrderPlaced === false);
  check('Production real trading is disabled', s.productionRealTradingEnabled === false);

  o.recordMarketTick({ symbol: 'RELIANCE', price: 2500 });
  o.recordMarketTick({ symbol: 'TCS', price: 3500, stale: true });
  o.recordMarketTick({ symbol: '', price: 0 });
  s = o.snapshot();
  check('Market ticks are observed', s.ticks === 3);
  check('Stale market data is tracked', s.staleTicks === 1);
  check('Invalid market data is tracked', s.dataErrors === 1);

  o.recordSignal({ symbol: 'RELIANCE', action: 'BUY', score: 92, accepted: true, riskPassed: true });
  o.recordSignal({ symbol: 'TCS', action: 'BUY', score: 40, accepted: false, riskPassed: false });
  o.recordSignal({ symbol: 'RELIANCE', action: 'BUY', score: 92, accepted: false, riskPassed: true, duplicate: true });
  s = o.snapshot();
  check('Signals are counted', s.signals === 3);
  check('Accepted signal is counted', s.acceptedSignals === 1);
  check('Rejected signals are counted', s.rejectedSignals === 2);
  check('Risk blocks are counted', s.riskBlocks === 1);
  check('Duplicate signals are counted', s.duplicateSignals === 1);

  o.recordPaperExecution({ symbol: 'RELIANCE', action: 'BUY', quantity: 10, price: 2500 });
  o.recordExit({ symbol: 'RELIANCE', pnl: 500 });
  o.recordExit({ symbol: 'TCS', pnl: -200 });
  o.updateEquity(100300);
  s = o.snapshot();
  check('Paper execution is recorded', s.paperExecutions === 1);
  check('Exits are recorded', s.exits === 2);
  check('Wins are counted', s.wins === 1);
  check('Losses are counted', s.losses === 1);
  check('Realized P&L is calculated', s.realizedPnL === 300);
  check('Win rate is calculated', s.winRate === 50);
  check('Drawdown tracking is available', Number.isFinite(s.maxDrawdown));
  check('Final safety assertion passes', assertExtendedPaperSafety(s));

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: s.paperOnly, realOrderPlaced: s.realOrderPlaced, productionRealTradingEnabled: s.productionRealTradingEnabled, results: tests };
  console.table(summary);
  console.log(`EXTENDED PAPER OBSERVATION VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runExtendedPaperObservationValidation = runExtendedPaperObservationValidation;
