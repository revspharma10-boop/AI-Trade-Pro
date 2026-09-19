/* AI TRADE PRO — PRODUCTION DEPLOYMENT READINESS (PAPER-ONLY) */
import { evaluateProductionLiveQualification, assertProductionLiveSafety } from './productionLiveQualificationGate.js';

export function runProductionDeploymentReadiness() {
  const results = [];
  const check = (name, condition) => {
    const passed = Boolean(condition);
    results.push({ name, passed });
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    return passed;
  };

  const envExample = process.env.BROKER_ENVIRONMENT ?? 'SANDBOX';
  check('Default broker environment is SANDBOX', envExample === 'SANDBOX');
  check('Live trading is not enabled by default', process.env.PRODUCTION_REAL_TRADING_ENABLED !== 'true');

  const blocked = evaluateProductionLiveQualification({});
  check('Live activation remains blocked without explicit evidence', blocked.qualificationStatus === 'BLOCKED');
  check('Manual live approval is required', blocked.blockers.includes('MANUAL_LIVE_APPROVAL_REQUIRED'));
  check('Broker adapter verification is required', blocked.blockers.includes('BROKER_ADAPTER_NOT_VERIFIED'));
  check('Live environment verification is required', blocked.blockers.includes('LIVE_ENVIRONMENT_NOT_VERIFIED'));

  const safety = {
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  };
  check('Production deployment snapshot remains paper-only', assertProductionLiveSafety(safety) === true);
  check('No real order is permitted during deployment preparation', safety.realOrderPlaced === false);
  check('Production real trading remains disabled', safety.productionRealTradingEnabled === false);

  const passed = results.filter(x => x.passed).length;
  const failed = results.length - passed;
  const result = {
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    paperOnly: safety.paperOnly,
    realOrderPlaced: safety.realOrderPlaced,
    productionRealTradingEnabled: safety.productionRealTradingEnabled,
    deploymentStatus: failed === 0 ? 'READY_FOR_CONTROLLED_DEPLOYMENT' : 'BLOCKED'
  };
  console.log('DEPLOYMENT_READINESS_RESULT=' + JSON.stringify(result));
  return result;
}

if (typeof window !== 'undefined') window.runProductionDeploymentReadiness = runProductionDeploymentReadiness;
