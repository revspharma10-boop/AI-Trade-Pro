/* AI TRADE PRO — BROKER/LIVE ENVIRONMENT VERIFICATION */
import { createBrokerAdapter, assertBrokerSafety } from './productionBrokerAdapter.js';
import { evaluateProductionLiveQualification } from './productionLiveQualificationGate.js';

export function runBrokerLiveEnvironmentVerification() {
  const results=[];
  const check=(name,condition)=>{const passed=Boolean(condition);results.push({name,passed});console.log(`${passed?'✅':'❌'} ${name}`);return passed;};

  const sandbox=createBrokerAdapter({environment:'SANDBOX'});
  check('Sandbox environment is isolated',sandbox.environment==='SANDBOX' && sandbox.connected===true);
  check('Sandbox execution remains disabled',sandbox.executionEnabled===false);
  check('Sandbox adapter is paper-only',sandbox.paperOnly===true && sandbox.realOrderPlaced===false);
  check('Broker safety contract passes',assertBrokerSafety(sandbox)===true);

  const liveWithoutApproval=createBrokerAdapter({environment:'LIVE',productionRealTradingEnabled:false});
  check('Live environment cannot activate implicitly',liveWithoutApproval.executionEnabled===false);
  check('Live activation requires explicit enablement',liveWithoutApproval.reason==='LIVE_ENVIRONMENT_REQUIRES_EXPLICIT_ACTIVATION');

  const gate=evaluateProductionLiveQualification({
    fullValidationPassed:true,
    paperObservationQualified:true,
    strategyPerformanceQualified:true,
    riskControlsQualified:true,
    marketDataQualified:true,
    executionSimulationQualified:true,
    recoveryQualified:true,
    auditQualified:true,
    secretsHardened:true,
    brokerSandboxQualified:true,
    operationalMonitoringQualified:true,
    rollbackQualified:true,
    brokerAdapterVerified:false,
    liveEnvironmentVerified:false,
    manualLiveApproval:false
  });
  check('Production gate still blocks unverified live activation',gate.qualified===false);
  check('Broker adapter verification is a blocker',gate.blockers.includes('BROKER_ADAPTER_NOT_VERIFIED'));
  check('Live environment verification is a blocker',gate.blockers.includes('LIVE_ENVIRONMENT_NOT_VERIFIED'));
  check('Manual approval remains a blocker',gate.blockers.includes('MANUAL_LIVE_APPROVAL_REQUIRED'));

  const passed=results.filter(x=>x.passed).length,failed=results.length-passed;
  const result={passed,failed,allAssertionsPassed:failed===0,suiteStatus:failed===0?'PASSED':'FAILED',paperOnly:true,realOrderPlaced:false,productionRealTradingEnabled:false};
  console.log('BROKER_LIVE_VERIFICATION_RESULT='+JSON.stringify(result));
  return result;
}
if(typeof window!=='undefined')window.runBrokerLiveEnvironmentVerification=runBrokerLiveEnvironmentVerification;
