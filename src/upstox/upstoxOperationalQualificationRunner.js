import { evaluateExecutionSafety } from './upstoxExecutionSafety.js';
import { createUpstoxMarketDataProcessor } from './upstoxMarketData.js';

const checks = [];
function check(name, condition) { checks.push({ name, passed: Boolean(condition) }); }

const blockedCases = [
  evaluateExecutionSafety(),
  evaluateExecutionSafety({marketDataFresh:true,riskApproved:true,killSwitchActive:true,authenticated:true,reconciled:true}),
  evaluateExecutionSafety({marketDataFresh:false,riskApproved:true,killSwitchActive:false,authenticated:true,reconciled:true}),
  evaluateExecutionSafety({marketDataFresh:true,riskApproved:false,killSwitchActive:false,authenticated:true,reconciled:true}),
  evaluateExecutionSafety({marketDataFresh:true,riskApproved:true,killSwitchActive:false,authenticated:false,reconciled:true}),
  evaluateExecutionSafety({marketDataFresh:true,riskApproved:true,killSwitchActive:false,authenticated:true,reconciled:false}),
  evaluateExecutionSafety({marketDataFresh:true,riskApproved:true,killSwitchActive:false,authenticated:true,reconciled:true,duplicateOrder:true})
];
check('all unsafe execution states fail closed', blockedCases.every(x => !x.allowed && x.action === 'NO_ORDER'));

const now = 200000;
const processor = createUpstoxMarketDataProcessor({clock:()=>now,maxAgeMs:3000});
check('fresh market data accepted', processor.normalize({instrumentToken:'NSE_INDEX|Nifty 50',timestamp:now,price:25000}).price === 25000);
let staleBlocked=false; try { processor.normalize({instrumentToken:'NSE_INDEX|Nifty Bank',timestamp:now-4000,price:55000}); } catch(e){ staleBlocked=e.message==='OUT_OF_ORDER_TICK'||e.message==='STALE_TICK'; }
check('stale/out-of-order market data blocked', staleBlocked);

check('production trading flag remains false', process.env.PRODUCTION_REAL_TRADING_ENABLED !== 'true');
check('real order flag remains false', process.env.REAL_ORDER_PLACED !== 'true');

for (const x of checks) console.log((x.passed?'PASS ':'FAIL ')+x.name);
const failed=checks.filter(x=>!x.passed).length;
console.log('UPSTOX_OPERATIONAL_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('order_submission_allowed=false');
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
process.exit(failed?1:0);
