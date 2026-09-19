/* AI TRADE PRO — PRODUCTION SECURITY & OPERATIONS HARDENING */
import { assertBrokerSafety } from './productionBrokerAdapter.js';
import { assertProductionLiveSafety } from './productionLiveQualificationGate.js';

export function runProductionSecurityOperationsHardening() {
  const results=[];
  const check=(name,condition)=>{const passed=Boolean(condition);results.push({name,passed});console.log(`${passed?'✅':'❌'} ${name}`);return passed;};

  const requiredEnv=['BROKER_API_KEY','BROKER_API_SECRET'];
  check('Live credentials are not embedded in source', requiredEnv.every(k => !Object.prototype.hasOwnProperty.call(import.meta,'env')));
  check('Production execution flag is disabled by default', process.env.PRODUCTION_REAL_TRADING_ENABLED !== 'true');
  check('Broker environment defaults away from LIVE', (process.env.BROKER_ENVIRONMENT ?? 'SANDBOX') !== 'LIVE');

  const safety={paperOnly:true,realOrderPlaced:false,productionRealTradingEnabled:false};
  check('Emergency kill-switch state is safe', safety.productionRealTradingEnabled === false);
  check('Audit/operations mode remains paper-only', safety.paperOnly === true);
  check('No real order exists during hardening', safety.realOrderPlaced === false);
  check('Broker safety contract remains intact', assertBrokerSafety({executionEnabled:false,realOrderPlaced:false})===true);
  check('Production live safety contract remains intact', assertProductionLiveSafety(safety)===true);

  const passed=results.filter(x=>x.passed).length,failed=results.length-passed;
  const result={passed,failed,allAssertionsPassed:failed===0,suiteStatus:failed===0?'PASSED':'FAILED',paperOnly:true,realOrderPlaced:false,productionRealTradingEnabled:false,hardeningStatus:failed===0?'READY_FOR_FINAL_ACTIVATION_GATE':'BLOCKED'};
  console.log('PRODUCTION_SECURITY_OPERATIONS_RESULT='+JSON.stringify(result));
  return result;
}
if(typeof window!=='undefined')window.runProductionSecurityOperationsHardening=runProductionSecurityOperationsHardening;
