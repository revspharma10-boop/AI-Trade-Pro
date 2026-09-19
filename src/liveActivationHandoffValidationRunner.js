import { prepareLiveActivationHandoff } from './liveActivationHandoff.js';

const result = prepareLiveActivationHandoff({
  brokerAdapterVerified: false,
  liveEnvironmentVerified: false,
  manualLiveApproval: false
});

console.log('LIVE_ACTIVATION_HANDOFF=' + JSON.stringify(result));
if (result.productionRealTradingEnabled !== false || result.realOrderPlaced !== false || result.paperOnly !== true) {
  throw new Error('Safety violation: activation handoff must remain paper-only.');
}
console.log('LIVE_ACTIVATION_HANDOFF_STATUS=BLOCKED_UNTIL_MANUAL_APPROVAL_AND_ENVIRONMENT_VERIFICATION');
