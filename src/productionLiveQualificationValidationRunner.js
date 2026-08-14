/* AI TRADE PRO — PRODUCTION LIVE QUALIFICATION VALIDATION
 * Consolidated validation for the final production-readiness control plane.
 * All checks execute with real trading disabled.
 */
import {
  evaluateProductionLiveQualification,
  assertProductionLiveSafety,
  PRODUCTION_LIVE_REQUIRED_GATES
} from './productionLiveQualificationGate.js';
import { createBrokerExecutionContract, assertBrokerExecutionSafety } from './brokerExecutionContract.js';

const checks = [];
function check(name, passed) {
  const ok = passed === true;
  checks.push({ name, passed: ok });
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  return ok;
}

export function runProductionLiveQualificationValidation() {
  checks.length = 0;

  const completeEvidence = Object.fromEntries(PRODUCTION_LIVE_REQUIRED_GATES.map((gate) => [gate, true]));
  const qualified = evaluateProductionLiveQualification({
    ...completeEvidence,
    brokerAdapterVerified: true,
    liveEnvironmentVerified: true,
    manualLiveApproval: true
  });

  check('All required production gates are defined', PRODUCTION_LIVE_REQUIRED_GATES.length === 12);
  check('Qualification succeeds only with complete evidence', qualified.qualified === true);
  check('Qualification remains paper-only', qualified.paperOnly === true);
  check('No real order is placed', qualified.realOrderPlaced === false);
  check('Production real trading remains disabled', qualified.productionRealTradingEnabled === false);
  check('Live activation remains a separate manual step', qualified.liveActivationRequired === true && qualified.activationIsManual === true);

  const blocked = evaluateProductionLiveQualification({ ...completeEvidence, riskControlsQualified: false });
  check('A missing safety gate blocks qualification', blocked.qualified === false && blocked.blockers.includes('RISKCONTROLSQUALIFIED'.toUpperCase()));

  const unsafe = { ...qualified, productionRealTradingEnabled: true };
  let safetyBlocked = false;
  try { assertProductionLiveSafety(unsafe); } catch { safetyBlocked = true; }
  check('Safety assertion rejects live-enabled snapshots during qualification', safetyBlocked);

  const contract = createBrokerExecutionContract({ environment: 'SANDBOX', connect(){}, getAccount(){}, getPositions(){}, placeOrder(){}, cancelOrder(){}, getOrder(){} });
  check('Broker execution contract is structurally valid', contract.valid === true);
  check('Broker contract is server-side only', contract.serverSideOnly === true);
  check('Browser live orders are disabled', contract.browserLiveOrdersAllowed === false);
  check('Broker execution safety assertion passes', assertBrokerExecutionSafety(contract) === true);

  const result = Object.freeze({
    passed: checks.filter((x) => x.passed).length,
    failed: checks.filter((x) => !x.passed).length,
    allAssertionsPassed: checks.every((x) => x.passed),
    suiteStatus: checks.every((x) => x.passed) ? 'PASSED' : 'FAILED',
    qualification: qualified,
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false,
    results: [...checks]
  });

  console.table(checks);
  console.log('============================================================');
  console.log(`Passed: ${result.passed}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log('PaperOnly: true');
  console.log('RealOrderPlaced: false');
  console.log('ProductionRealTradingEnabled: false');
  console.log('============================================================');
  console.log(`PRODUCTION LIVE QUALIFICATION VALIDATION: ${result.suiteStatus}`);
  return result;
}

if (typeof window !== 'undefined') {
  window.AITradeProProductionLiveQualificationValidation = Object.freeze({ run: runProductionLiveQualificationValidation });
}
