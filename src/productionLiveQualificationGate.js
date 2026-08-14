/* AI TRADE PRO — PRODUCTION LIVE QUALIFICATION GATE
 * This module completes the production-live control plane without silently
 * enabling real orders. Live execution requires explicit external evidence,
 * manual approval, and a broker-specific adapter owned by the deployment.
 */

export const LIVE_GATE_VERSION = '1.0.0';

const REQUIRED_GATES = Object.freeze([
  'fullValidationPassed',
  'paperObservationQualified',
  'strategyPerformanceQualified',
  'riskControlsQualified',
  'marketDataQualified',
  'executionSimulationQualified',
  'recoveryQualified',
  'auditQualified',
  'secretsHardened',
  'brokerSandboxQualified',
  'operationalMonitoringQualified',
  'rollbackQualified'
]);

export function evaluateProductionLiveQualification(input = {}) {
  const blockers = [];
  for (const gate of REQUIRED_GATES) {
    if (input[gate] !== true) blockers.push(gate.toUpperCase());
  }

  if (input.brokerAdapterVerified !== true) blockers.push('BROKER_ADAPTER_NOT_VERIFIED');
  if (input.liveEnvironmentVerified !== true) blockers.push('LIVE_ENVIRONMENT_NOT_VERIFIED');
  if (input.manualLiveApproval !== true) blockers.push('MANUAL_LIVE_APPROVAL_REQUIRED');

  const qualified = blockers.length === 0;

  // Never flip execution on as a side effect of qualification.
  return Object.freeze({
    gateVersion: LIVE_GATE_VERSION,
    qualificationStatus: qualified ? 'QUALIFIED_PENDING_ACTIVATION' : 'BLOCKED',
    qualified,
    blockers,
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false,
    liveActivationRequired: qualified,
    activationIsManual: true
  });
}

export function assertProductionLiveSafety(snapshot = {}) {
  if (snapshot.paperOnly !== true || snapshot.realOrderPlaced !== false || snapshot.productionRealTradingEnabled !== false) {
    throw new Error('AI TRADE PRO safety violation: production qualification must remain paper-only until explicit activation.');
  }
  return true;
}

export const PRODUCTION_LIVE_REQUIRED_GATES = REQUIRED_GATES;

if (typeof window !== 'undefined') {
  window.AITradeProProductionLiveQualification = Object.freeze({
    evaluate: evaluateProductionLiveQualification,
    assertSafety: assertProductionLiveSafety,
    requiredGates: [...REQUIRED_GATES]
  });
}

console.log('AI TRADE PRO — production-live qualification gate loaded (PAPER_ONLY)');
