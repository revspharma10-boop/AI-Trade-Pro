/* AI TRADE PRO — UPSTOX PRODUCTION DEPLOYMENT CONFIGURATION
 * Configuration/readiness metadata only.
 * This module does not contain credentials, create network transports, or enable orders.
 */

export const UPSTOX_PRODUCTION_DEPLOYMENT = Object.freeze({
  broker: 'UPSTOX',
  targetEnvironment: 'LIVE',
  apiBaseUrl: 'https://api.upstox.com',
  orderBaseUrl: 'https://api-hft.upstox.com',
  credentialsSource: 'SERVER_SIDE_SECRET_MANAGER',
  browserCredentialsAllowed: false,
  browserLiveOrdersAllowed: false,
  productionConnectivityVerified: false,
  manualLiveApprovalRecorded: false,
  liveExecutionEnabled: false,
  canaryEnabled: false,
  PAPER_ONLY: true,
  REAL_ORDER_PLACED: false,
  PRODUCTION_REAL_TRADING_ENABLED: false
});

export function getUpstoxProductionDeploymentConfig() {
  return UPSTOX_PRODUCTION_DEPLOYMENT;
}

export function assertUpstoxProductionDeploymentSafe(config = UPSTOX_PRODUCTION_DEPLOYMENT) {
  if (config.credentialsSource !== 'SERVER_SIDE_SECRET_MANAGER') throw new Error('PRODUCTION_CREDENTIAL_SOURCE_UNSAFE');
  if (config.browserCredentialsAllowed !== false) throw new Error('BROWSER_CREDENTIALS_FORBIDDEN');
  if (config.browserLiveOrdersAllowed !== false) throw new Error('BROWSER_LIVE_ORDERS_FORBIDDEN');
  if (config.liveExecutionEnabled !== false) throw new Error('LIVE_EXECUTION_MUST_REMAIN_DISABLED');
  if (config.canaryEnabled !== false) throw new Error('CANARY_REQUIRES_SEPARATE_APPROVAL');
  if (config.PAPER_ONLY !== true || config.REAL_ORDER_PLACED !== false || config.PRODUCTION_REAL_TRADING_ENABLED !== false) {
    throw new Error('PAPER_SAFETY_INVARIANT_VIOLATION');
  }
  return true;
}
