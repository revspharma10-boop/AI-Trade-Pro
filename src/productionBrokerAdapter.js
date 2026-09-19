/* AI TRADE PRO — BROKER ADAPTER SAFETY CONTRACT
 * Qualification-only adapter. No network calls and no live orders.
 */
export const BROKER_ADAPTER_VERSION = '1.0.0';

export function createBrokerAdapter(config = {}) {
  const environment = config.environment ?? 'SANDBOX';
  const liveEnabled = config.productionRealTradingEnabled === true;

  if (environment === 'LIVE' && !liveEnabled) {
    return Object.freeze({
      environment,
      connected: false,
      executionEnabled: false,
      reason: 'LIVE_ENVIRONMENT_REQUIRES_EXPLICIT_ACTIVATION'
    });
  }

  if (environment !== 'SANDBOX') {
    return Object.freeze({
      environment,
      connected: false,
      executionEnabled: false,
      reason: 'UNVERIFIED_BROKER_ENVIRONMENT'
    });
  }

  return Object.freeze({
    environment: 'SANDBOX',
    connected: true,
    executionEnabled: false,
    paperOnly: true,
    realOrderPlaced: false
  });
}

export function assertBrokerSafety(snapshot = {}) {
  if (snapshot.executionEnabled === true || snapshot.realOrderPlaced === true) {
    throw new Error('Broker adapter safety violation: execution must remain disabled during qualification.');
  }
  return true;
}
