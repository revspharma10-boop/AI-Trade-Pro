/* AI TRADE PRO — PHASE 61–65 FINAL QUALIFICATION VALIDATION */
import { createPhase61to65Engine, PHASE61_TO_65 } from './phase61to65IntegrationEngine.js';

export function runPhase61to65Validation() {
  const engine = createPhase61to65Engine();
  const results = [];
  const check = (name, condition) => {
    const passed = Boolean(condition); results.push({ name, passed });
    console.log(`${passed ? '✅' : '❌'} ${name}`); return passed;
  };

  const safety = engine.getSafety();
  check('5 phases 61–65 are registered', PHASE61_TO_65.length === 5);
  check('Phase IDs are contiguous 61–65', PHASE61_TO_65.every((p, i) => p.id === 61 + i));
  check('Paper-only safety is enabled', safety.PAPER_ONLY === true);
  check('No real order is placed', safety.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const integration = engine.integrationCheck();
  check('Full-system integration remains paper-safe', integration.ok === true && integration.phase36to60Count === 25);

  const session = engine.startPaperSession('FINAL-PAPER-1');
  check('Long-duration paper session starts safely', session.mode === 'PAPER_ONLY' && session.status === 'RUNNING');
  const t0 = Date.now();
  check('Paper market observation is accepted', engine.recordObservation(session.id, { symbol: 'NIFTY', price: 25000, timestamp: t0, volume: 1000 }).accepted === true);
  check('Out-of-order observation is rejected', engine.recordObservation(session.id, { symbol: 'NIFTY', price: 24999, timestamp: t0 - 1 }).accepted === false);
  check('Paper signal is quality-gated and tracked', engine.recordSignal(session.id, { symbol: 'NIFTY', action: 'BUY', score: 88, strategyId: 'FINAL' }).accepted === true);
  check('Paper session closes safely', engine.closePaperSession(session.id).closed === true);

  const performance = engine.qualifyPerformance({
    trades: [{ pnl: 100 }, { pnl: -50 }, { pnl: 75 }, { pnl: -25 }],
    signals: [{ action: 'BUY' }, { action: 'SELL' }, { action: 'HOLD' }]
  });
  check('Performance metrics are generated', performance.trades === 4 && performance.wins === 2 && performance.losses === 2);
  check('Win rate is calculated', performance.winRate === 0.5);
  check('Profit factor is calculated', performance.profitFactor === 175 / 75);
  check('Signal evidence is included', performance.signals === 3);

  const failureTypes = ['STALE_DATA', 'SOURCE_INTERRUPTION', 'STATE_CORRUPTION', 'RISK_LIMIT_BREACH', 'KILL_SWITCH'];
  const failures = failureTypes.map(engine.injectFailure);
  check('Failure injection remains fail-safe', failures.length === 5 && failures.every(f => f.safeState === true));
  const recovery = engine.recoveryCheck();
  check('Checkpoint recovery is paper-safe', recovery.checkpoint === true && recovery.restored === true);
  check('Rollback is paper-safe', recovery.rolledBack === true && recovery.failSafe === true);
  check('Failure/recovery evidence is recorded', engine.getFailures().length === 5);

  const certification = engine.finalCertification();
  check('Final paper-production certification passes', certification.certified === true);
  check('Final certification confirms paper-only mode', certification.paperOnly === true);
  check('Final certification confirms no live orders', certification.safety.REAL_ORDER_PLACED === false);
  check('Final certification has operational evidence', certification.auditEvents > 0 && certification.evidenceCount > 0);

  const finalSafety = certification.safety;
  check('Final safety boundary remains intact', finalSafety.PAPER_ONLY === true && finalSafety.REAL_ORDER_PLACED === false && finalSafety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const result = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: finalSafety.PAPER_ONLY, realOrderPlaced: finalSafety.REAL_ORDER_PLACED, productionRealTradingEnabled: finalSafety.PRODUCTION_REAL_TRADING_ENABLED, phases: PHASE61_TO_65.map(p => p.id), results, certification, snapshot: engine.getBaseSnapshot() };

  console.table(results);
  console.log('============================================================');
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`); console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log(`PaperOnly: ${result.paperOnly}`); console.log(`RealOrderPlaced: ${result.realOrderPlaced}`); console.log(`ProductionRealTradingEnabled: ${result.productionRealTradingEnabled}`);
  console.log('============================================================');
  console.log(`PHASES 61–65 FINAL QUALIFICATION: ${result.suiteStatus}`);
  console.log('FINAL SAFETY SNAPSHOT:', finalSafety);
  return result;
}

if (typeof window !== 'undefined') window.runPhase61to65Validation = runPhase61to65Validation;
