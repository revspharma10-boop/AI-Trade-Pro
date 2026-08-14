/* AI TRADE PRO — PHASE 3 CONSOLIDATED VALIDATION */
import { createPhase3ProductionQualificationEngine, PHASE3_ACTIVITIES } from './phase3ProductionQualificationEngine.js';

export async function runPhase3ProductionQualificationValidation() {
  const e = createPhase3ProductionQualificationEngine();
  const results = [];
  const check = (name, condition) => { const passed = Boolean(condition); results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); return passed; };
  const s = e.getSafety();

  check('10 Phase 3 activities are registered', PHASE3_ACTIVITIES.length === 10);
  check('Phase 3 IDs are contiguous 66–75', PHASE3_ACTIVITIES.every((p, i) => p.id === 66 + i));
  check('Paper-only safety is enabled', s.PAPER_ONLY === true);
  check('No real order is placed', s.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', s.PRODUCTION_REAL_TRADING_ENABLED === false);

  const connection = await e.connect();
  check('Broker sandbox connects safely', connection.connected === true && connection.environment === 'SANDBOX_SIMULATION');
  check('Broker contract is server-side-only', connection.contractSafe === true && connection.browserLiveOrdersAllowed === false);
  const auth = await e.authenticate();
  check('Authentication/session handling is safe', auth.authenticated === true && auth.browserSecrets === false);

  const t = Date.now();
  check('Fresh market data is accepted', e.observe({ symbol: 'NIFTY', price: 25000, timestamp: t, volume: 1000 }).accepted === true);
  check('Duplicate market data is rejected', e.observe({ symbol: 'NIFTY', price: 25000, timestamp: t }).reason === 'DUPLICATE');
  check('Out-of-order market data is rejected', e.observe({ symbol: 'NIFTY', price: 24999, timestamp: t - 1 }).reason === 'OUT_OF_ORDER');
  check('End-to-end signal is quality-gated', e.evaluateSignal({ symbol: 'NIFTY', action: 'BUY', score: 88 }).accepted === true);
  check('Risk allows compliant paper intent', e.riskCheck({ quantity: 1, exposure: 25000 }).allowed === true);
  check('Risk blocks excessive exposure', e.riskCheck({ quantity: 1, exposure: 100001 }).allowed === false);
  const order = e.paperOrder({ symbol: 'NIFTY', side: 'BUY', quantity: 1, price: 25000, exposure: 25000 });
  check('Paper order lifecycle executes as simulation', order.executed === true && order.order.paperOnly === true && order.order.live === false);
  const closed = e.closePosition(0, 25100);
  check('Paper position lifecycle closes safely', closed.closed === true && closed.paperOnly === true && closed.pnl === 100);

  const faultTypes = ['STALE_DATA','DUPLICATE_TICK','OUT_OF_ORDER','NETWORK_INTERRUPTION','INVALID_DATA'];
  const faults = faultTypes.map(e.injectFault);
  check('Realtime resilience is fail-safe', faults.length === 5 && faults.every(x => x.safeState === true));
  e.setKillSwitch(true);
  check('Kill switch blocks trading', e.riskCheck({ quantity: 1, exposure: 100 }).allowed === false);
  e.setKillSwitch(false);
  const cp = e.checkpoint();
  const restored = e.restore(cp);
  check('Checkpoint recovery is paper-safe', restored.restored === true && restored.paperOnly === true);
  check('Rollback is paper-safe', e.rollback().rolledBack === true);
  check('Operational monitoring is populated', e.getEvents().length > 0);
  check('Incident audit trail is populated', e.getIncidents().length === 5);
  const r = e.readiness();
  check('Production deployment rehearsal remains configuration-only', r.deploymentRehearsal === true && r.safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Final Phase 3 safety boundary remains intact', r.safety.PAPER_ONLY === true && r.safety.REAL_ORDER_PLACED === false && r.safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const passed = results.filter(x => x.passed).length, failed = results.length - passed;
  const result = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: r.safety.PAPER_ONLY, realOrderPlaced: r.safety.REAL_ORDER_PLACED, productionRealTradingEnabled: r.safety.PRODUCTION_REAL_TRADING_ENABLED, activities: PHASE3_ACTIVITIES.map(x => x.id), results, readiness: r };
  console.table(results);
  console.log('============================================================');
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`); console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log(`PaperOnly: ${result.paperOnly}`); console.log(`RealOrderPlaced: ${result.realOrderPlaced}`); console.log(`ProductionRealTradingEnabled: ${result.productionRealTradingEnabled}`);
  console.log('============================================================');
  console.log(`PHASE 3 PRODUCTION QUALIFICATION: ${result.suiteStatus}`);
  console.log('FINAL SAFETY SNAPSHOT:', r.safety);
  return result;
}

if (typeof window !== 'undefined') window.runPhase3ProductionQualificationValidation = runPhase3ProductionQualificationValidation;
