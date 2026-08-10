// AI TRADE PRO — PHASE 8: INTEGRATION & HARDENING
// Final runtime gate for the paper-only development line.

const required = ['controlCenter','dashboard','persistence','monitoring','strategyScanner'];
export function runPaperIntegrationGate(input = {}) {
  const components = input.components || {};
  const missing = required.filter(name => components[name] !== true);
  const unsafe = input.paperOnly !== true || input.realOrderPlaced === true || input.productionRealTradingEnabled === true;
  const status = missing.length || unsafe ? 'BLOCKED' : 'READY_FOR_TESTING';
  return Object.freeze({ status, readyForTesting: status === 'READY_FOR_TESTING', missingComponents: missing, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, checkedAt: new Date().toISOString() });
}

export function createReleaseSafetySnapshot(input = {}) {
  const gate = runPaperIntegrationGate(input);
  return Object.freeze({ ...gate, releaseChannel: 'PAPER', liveTradingEnabled: false, brokerOrderSubmissionEnabled: false, testMode: true });
}

export function assertFinalPaperSafety(snapshot) {
  return Boolean(snapshot?.readyForTesting === true && snapshot?.paperOnly === true && snapshot?.realOrderPlaced === false && snapshot?.productionRealTradingEnabled === false && snapshot?.liveTradingEnabled === false && snapshot?.brokerOrderSubmissionEnabled === false);
}

console.log('AI TRADE PRO — paper integration hardening engine loaded');
