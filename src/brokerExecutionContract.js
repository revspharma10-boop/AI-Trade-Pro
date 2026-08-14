/* AI TRADE PRO — BROKER EXECUTION CONTRACT
 * Broker-specific implementations must live outside the browser and use a
 * server-side secret manager. This browser-safe contract contains no secrets
 * and provides no default live-order implementation.
 */

export const BROKER_EXECUTION_CONTRACT_VERSION = '1.0.0';

export function createBrokerExecutionContract(adapter = {}) {
  const required = ['connect', 'getAccount', 'getPositions', 'placeOrder', 'cancelOrder', 'getOrder'];
  const missing = required.filter((name) => typeof adapter[name] !== 'function');

  return Object.freeze({
    valid: missing.length === 0,
    missing,
    environment: adapter.environment || 'UNCONFIGURED',
    serverSideOnly: true,
    browserLiveOrdersAllowed: false,
    adapter
  });
}

export function assertBrokerExecutionSafety(contract = {}) {
  if (contract.serverSideOnly !== true || contract.browserLiveOrdersAllowed !== false) {
    throw new Error('Broker execution safety contract failed.');
  }
  return true;
}
