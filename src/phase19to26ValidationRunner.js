// AI TRADE PRO — PHASE 19–26 CONSOLIDATED VALIDATION RUNNER
// Validation is intentionally paper-only. A PASS here is not authorization for live trading.

import { getPhase19to26Roadmap, getPhase19to26Safety } from './phases19to26DevelopmentPlan.js';
import { createPhase19to26Session } from './phase19to26IntegrationEngine.js';

export function runPhase19to26Validation() {
  const results = [];
  const check = (name, condition) => { const passed = !!condition; results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); return passed; };

  const roadmap = getPhase19to26Roadmap();
  const safety = getPhase19to26Safety();
  const session = createPhase19to26Session({ maxExposure: 100000, maxDailyLoss: 5000 });
  const t0 = Date.now();

  check('8 phases 19–26 are registered', roadmap.length === 8);
  check('Phase IDs are contiguous 19–26', roadmap.map(p => p.phase).join(',') === '19,20,21,22,23,24,25,26');
  check('Paper-only safety is enabled', safety.paperOnly === true);
  check('No real order is placed', safety.realOrderPlaced === false);
  check('Production real trading is disabled', safety.productionRealTradingEnabled === false);

  check('Valid market observation is accepted', session.observeMarket({ timestamp: t0, price: 100 }).accepted === true);
  check('Out-of-order market observation is rejected', session.observeMarket({ timestamp: t0 - 1, price: 101 }).accepted === false);
  check('BUY signal is tracked', session.recordSignal({ action: 'BUY', strategy: 'trend' }).action === 'BUY');
  check('SELL signal is tracked', session.recordSignal({ action: 'SELL', strategy: 'mean-reversion' }).action === 'SELL');
  check('HOLD signal is tracked', session.recordSignal({ action: 'HOLD', strategy: 'trend' }).action === 'HOLD');

  check('Strategy registration works', session.registerStrategy({ id: 'trend', weight: 1 }).id === 'trend');
  check('Risk allows compliant paper intent', session.validateRisk({ exposure: 1000, dailyLoss: 100 }).allowed === true);
  check('Risk blocks excessive exposure', session.validateRisk({ exposure: 200000, dailyLoss: 100 }).allowed === false);
  check('Risk blocks kill switch', session.validateRisk({ exposure: 100, dailyLoss: 100, killSwitch: true }).allowed === false);
  check('Paper intent executes only in paper mode', session.paperIntent({ side: 'BUY', exposure: 1000, dailyLoss: 100, pnl: 25 }).executed === true);
  check('Blocked paper intent does not execute', session.paperIntent({ side: 'BUY', exposure: 200000, dailyLoss: 100 }).executed === false);

  session.recordBacktest({ walkForward: true, outOfSamplePassed: true });
  check('Walk-forward result is recorded', session.snapshot().backtest.walkForwardRuns === 1);
  check('Out-of-sample result is recorded', session.snapshot().backtest.outOfSamplePasses === 1);

  check('Heartbeat is observable', session.heartbeat().healthy === true);
  session.alert('QUALITY_DEGRADED', 'WARN');
  session.incident('FEED_INTERRUPTION');
  check('Alerts and incidents are recorded', session.snapshot().monitoring.alerts === 1 && session.snapshot().monitoring.incidents === 1);

  const cp = session.checkpoint();
  check('Checkpoint is created', cp.checkpointId === 1);
  check('Recovery restore is paper-safe', session.restore().liveOrders === false);
  check('Rollback is paper-safe', session.rollback().liveOrders === false);

  const snapshot = session.snapshot();
  check('Audit trail is populated', snapshot.auditCount >= 10);

  // Canonical final safety fields come from the integration engine snapshot.
  // The engine intentionally exposes uppercase safety constants; the roadmap
  // helper uses camelCase fields for its configuration-level safety summary.
  const finalSafety = snapshot.safety || {};
  check(
    'Final snapshot remains paper-only',
    finalSafety.PAPER_ONLY === true &&
    finalSafety.REAL_ORDER_PLACED === false &&
    finalSafety.PRODUCTION_REAL_TRADING_ENABLED === false
  );

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const result = {
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    paperOnly: finalSafety.PAPER_ONLY === true,
    realOrderPlaced: finalSafety.REAL_ORDER_PLACED === true,
    productionRealTradingEnabled: finalSafety.PRODUCTION_REAL_TRADING_ENABLED === true,
    results,
    snapshot
  };
  console.table(results);
  console.log('FINAL SAFETY SNAPSHOT:', finalSafety);
  console.log('============================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log(`PaperOnly: ${result.paperOnly}`);
  console.log(`RealOrderPlaced: ${result.realOrderPlaced}`);
  console.log(`ProductionRealTradingEnabled: ${result.productionRealTradingEnabled}`);
  console.log('============================================================');
  console.log(`PHASES 19–26 VALIDATION: ${result.suiteStatus}`);
  return result;
}

if (typeof window !== 'undefined') window.runPhase19to26Validation = runPhase19to26Validation;
