/* AI TRADE PRO — PRODUCTION BROKER ADAPTER INTERFACE
 * Provider-neutral server-side contract.
 * Intentionally non-executable until a specific broker adapter is implemented,
 * reviewed, and validated against that broker's production API.
 */

export const PRODUCTION_BROKER_ADAPTER_STATUS = 'NOT_IMPLEMENTED';

export function createProductionBrokerAdapter(config = {}) {
  const broker = config.broker ?? '';
  const environment = config.environment ?? 'SANDBOX';

  return Object.freeze({
    broker,
    environment,
    connected: false,
    executionEnabled: false,
    paperOnly: true,
    realOrderPlaced: false,
    status: PRODUCTION_BROKER_ADAPTER_STATUS,
    reason: 'BROKER_SPECIFIC_PRODUCTION_ADAPTER_REQUIRED'
  });
}

export function assertProductionBrokerAdapterReady(snapshot = {}) {
  if (snapshot.status !== 'VERIFIED') {
    throw new Error('Production broker adapter is not verified.');
  }
  if (snapshot.executionEnabled !== true) {
    throw new Error('Production broker adapter execution is not explicitly enabled.');
  }
  if (snapshot.realOrderPlaced === true) {
    throw new Error('Adapter readiness validation must not place a real order.');
  }
  return true;
}
