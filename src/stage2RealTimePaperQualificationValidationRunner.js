/* AI TRADE PRO — STAGE 2 CONSOLIDATED VALIDATION */
import { createStage2RealTimePaperQualificationEngine, STAGE2_ACTIVITIES } from './stage2RealTimePaperQualificationEngine.js';

export function runStage2RealTimePaperQualificationValidation() {
  const e = createStage2RealTimePaperQualificationEngine();
  const results = [];
  const check = (name, condition) => { const passed = Boolean(condition); results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); return passed; };
  const s = e.getSafety();
  check('10 Stage 2 activities are registered', STAGE2_ACTIVITIES.length === 10);
  check('Stage 2 IDs are contiguous 76–85', STAGE2_ACTIVITIES.every((p, i) => p.id === 76 + i));
  check('Paper-only safety is enabled', s.PAPER_ONLY === true);
  check('No real order is placed', s.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', s.PRODUCTION_REAL_TRADING_ENABLED === false);
  const start = e.start({ symbol: 'NIFTY', session: 'STAGE2-VALIDATION', staleAfterMs: 30000 });
  check('Real-time observation session starts', start.started === true && start.mode === 'PAPER_ONLY');
  const t = Date.now();
  check('Fresh tick is accepted', e.observe({ symbol: 'NIFTY', price: 25000, timestamp: t, volume: 1000 }).accepted === true);
  check('Duplicate tick is rejected', e.observe({ symbol: 'NIFTY', price: 25000, timestamp: t, volume: 1000 }).reason === 'DUPLICATE');
  check('Out-of-order tick is rejected', e.observe({ symbol: 'NIFTY', price: 24999, timestamp: t - 1, volume: 1000 }).reason === 'OUT_OF_ORDER');
  check('Stale tick is rejected', e.observe({ symbol: 'NIFTY', price: 24900, timestamp: t - 60000, volume: 1000 }).reason === 'STALE');
  check('Invalid tick is rejected', e.observe({ symbol: 'NIFTY', price: -1, timestamp: Date.now(), volume: 1000 }).reason === 'INVALID_TICK');
  check('Signal pipeline accepts quality signal', e.evaluateSignal({ action: 'BUY', score: 88 }).accepted === true);
  const entry = e.enter({ id: 'STAGE2-P1', symbol: 'NIFTY', side: 'BUY', quantity: 1, price: 25000 });
  check('Paper entry executes', entry.executed === true && entry.fill.mode === 'PAPER_ONLY' && entry.realOrderPlaced === false);
  const exit = e.exit('STAGE2-P1', 25100);
  check('Paper exit records P&L', exit.closed === true && exit.trade.pnl === 100 && exit.realOrderPlaced === false);
  check('Heartbeat is healthy', e.heartbeatTick().healthy === true);
  check('Source interruption is fail-safe', e.injectInterruption('VALIDATION').safe === true);
  check('Recovery remains gated until fresh tick', e.recover().gatedUntilFreshTick === true);
  check('Recovered source accepts fresh tick', e.observe({ symbol: 'NIFTY', price: 25100, timestamp: Date.now(), volume: 1000 }).accepted === true);
  const snap = e.snapshot();
  check('Quality metrics are exposed', snap.paper.quality && typeof snap.paper.quality.accepted === 'number' && typeof snap.paper.quality.rejected === 'number');
  check('P&L is exposed', snap.paper.realizedPnl === 100);
  check('Journal is populated', snap.paper.journalCount > 0);
  check('Final snapshot remains paper-only', snap.safety.PAPER_ONLY === true && snap.safety.REAL_ORDER_PLACED === false && snap.safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  const stop = e.stop();
  check('Session closes cleanly', stop.stopped === true);
  const passed = results.filter(x => x.passed).length;
  const result = { passed, failed: results.length - passed, allAssertionsPassed: results.every(x => x.passed), suiteStatus: results.every(x => x.passed) ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results, snapshot: snap };
  console.table(results); console.log(`STAGE 2 REAL-TIME PAPER QUALIFICATION: ${result.suiteStatus}`); console.log('FINAL SAFETY SNAPSHOT:', snap.safety); return result;
}
if (typeof window !== 'undefined') window.runStage2RealTimePaperQualificationValidation = runStage2RealTimePaperQualificationValidation;
