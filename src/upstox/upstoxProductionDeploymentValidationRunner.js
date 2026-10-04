import {
  getUpstoxProductionDeploymentConfig,
  assertUpstoxProductionDeploymentSafe
} from './upstoxProductionDeploymentConfig.js';

const checks = [];
function check(name, condition) {
  const passed = condition === true;
  checks.push({ name, passed });
  console.log((passed ? 'PASS ' : 'FAIL ') + name);
}

export function runUpstoxProductionDeploymentValidation() {
  checks.length = 0;
  const config = getUpstoxProductionDeploymentConfig();

  check('broker is Upstox', config.broker === 'UPSTOX');
  check('target metadata is LIVE', config.targetEnvironment === 'LIVE');
  check('credentials require server-side secret manager', config.credentialsSource === 'SERVER_SIDE_SECRET_MANAGER');
  check('browser credentials are forbidden', config.browserCredentialsAllowed === false);
  check('browser live orders are forbidden', config.browserLiveOrdersAllowed === false);
  check('production connectivity is not pre-claimed', config.productionConnectivityVerified === false);
  check('manual live approval is not pre-claimed', config.manualLiveApprovalRecorded === false);
  check('live execution remains disabled', config.liveExecutionEnabled === false);
  check('canary remains disabled', config.canaryEnabled === false);
  check('paper-only invariant remains active', config.PAPER_ONLY === true);
  check('no real order has been placed', config.REAL_ORDER_PLACED === false);
  check('production real trading remains disabled', config.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('deployment safety assertion passes', assertUpstoxProductionDeploymentSafe(config) === true);

  const result = Object.freeze({
    passed: checks.filter(x => x.passed).length,
    failed: checks.filter(x => !x.passed).length,
    allAssertionsPassed: checks.every(x => x.passed),
    safety: {
      PAPER_ONLY: true,
      REAL_ORDER_PLACED: false,
      PRODUCTION_REAL_TRADING_ENABLED: false
    }
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  const result = runUpstoxProductionDeploymentValidation();
  process.exit(result.allAssertionsPassed ? 0 : 1);
}
