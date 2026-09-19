/* AI TRADE PRO — CONTROLLED LIVE ACTIVATION HANDOFF
 * This module prepares the manual activation handoff.
 * It NEVER enables live trading or places an order.
 */
import { evaluateProductionLiveQualification, assertProductionLiveSafety } from './productionLiveQualificationGate.js';

export function prepareLiveActivationHandoff(input = {}) {
  const qualification = evaluateProductionLiveQualification({
    fullValidationPassed: true,
    paperObservationQualified: true,
    strategyPerformanceQualified: true,
    riskControlsQualified: true,
    marketDataQualified: true,
    executionSimulationQualified: true,
    recoveryQualified: true,
    auditQualified: true,
    secretsHardened: true,
    brokerSandboxQualified: true,
    operationalMonitoringQualified: true,
    rollbackQualified: true,
    brokerAdapterVerified: input.brokerAdapterVerified === true,
    liveEnvironmentVerified: input.liveEnvironmentVerified === true,
    manualLiveApproval: input.manualLiveApproval === true
  });

  const safety = {
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  };
  assertProductionLiveSafety(safety);

  return Object.freeze({
    handoffStatus: qualification.qualified ? 'READY_FOR_MANUAL_ACTIVATION' : 'BLOCKED',
    qualification,
    requiredHumanAction: 'EXPLICIT_MANUAL_LIVE_APPROVAL',
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  });
}

if (typeof window !== 'undefined') window.prepareAITradeProLiveActivationHandoff = prepareLiveActivationHandoff;
