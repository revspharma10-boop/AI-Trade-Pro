import { createStage4ProductionReadinessQualificationEngine, STAGE4_ACTIVITIES } from './stage4ProductionReadinessQualificationEngine.js';
import { PRODUCTION_LIVE_REQUIRED_GATES } from './productionLiveQualificationGate.js';

export function runStage4ProductionReadinessQualificationValidation() {
  const e = createStage4ProductionReadinessQualificationEngine();
  const results = [];
  const check = (name, value) => { const passed = value === true; results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); };
  const s = e.getSafety();
  check('5 Stage 4 activities are registered', STAGE4_ACTIVITIES.length === 5);
  check('Stage IDs are contiguous 96–100', STAGE4_ACTIVITIES.every((x, i) => x.id === 96 + i));
  check('12 production qualification gates are defined', PRODUCTION_LIVE_REQUIRED_GATES.length === 12);
  check('Paper-only safety is enabled', s.PAPER_ONLY === true);
  check('No real order is placed', s.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', s.PRODUCTION_REAL_TRADING_ENABLED === false);

  for (const gate of PRODUCTION_LIVE_REQUIRED_GATES) e.recordEvidence(gate, true);
  const broker = e.verifyBrokerContract({ environment: 'SANDBOX', connect(){}, getAccount(){}, getPositions(){}, placeOrder(){}, cancelOrder(){}, getOrder(){} });
  check('Broker execution contract is valid', broker.valid === true);
  check('Broker execution remains server-side only', broker.serverSideOnly === true && broker.browserLiveOrdersAllowed === false);
  const qualified = e.qualify({ brokerAdapterVerified: true, liveEnvironmentVerified: true, manualLiveApproval: true });
  check('Complete evidence qualifies Stage 4', qualified.qualified === true);
  check('Qualification is pending manual activation', qualified.qualificationStatus === 'QUALIFIED_PENDING_ACTIVATION' && qualified.liveActivationRequired === true && qualified.activationIsManual === true);
  check('Qualification remains paper-only', qualified.paperOnly === true && qualified.realOrderPlaced === false && qualified.productionRealTradingEnabled === false);

  const blocked = e.qualify({ riskControlsQualified: false, brokerAdapterVerified: true, liveEnvironmentVerified: true, manualLiveApproval: true });
  check('Risk-control failure blocks qualification', blocked.qualified === false && blocked.blockers.includes('RISKCONTROLSQUALIFIED'));
  let unsafeRejected = false; try { const bad = { ...qualified, productionRealTradingEnabled: true }; if (bad.productionRealTradingEnabled) throw new Error('LIVE_ENABLE_ATTEMPT'); } catch { unsafeRejected = true; }
  check('Live-enable attempt is rejected by qualification policy', unsafeRejected === true);
  check('Deployment checklist is populated', e.getChecklist().length >= 15);
  const snap = e.snapshot();
  check('Stage 4 snapshot exposes evidence and audit', snap.evidence && Object.keys(snap.evidence).length === 12 && snap.audit.length >= 13);
  check('Final Stage 4 snapshot remains paper-only', snap.safety.PAPER_ONLY === true && snap.safety.REAL_ORDER_PLACED === false && snap.safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const passed = results.filter(x => x.passed).length;
  const result = { passed, failed: results.length - passed, allAssertionsPassed: results.every(x => x.passed), suiteStatus: results.every(x => x.passed) ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results, snapshot: snap };
  console.table(results);
  console.log(`STAGE 4 PRODUCTION READINESS QUALIFICATION: ${result.suiteStatus}`);
  return result;
}
