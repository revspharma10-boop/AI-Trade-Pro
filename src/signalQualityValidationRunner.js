// AI TRADE PRO — SIGNAL QUALITY VALIDATION
import { createSignalQualityEngine, assertSignalQualitySafety } from './signalQualityEngine.js';
const tests=[]; const check=(name,c)=>{tests.push({name,passed:Boolean(c)});console.log(c?'✅':'❌',name);};
export function runSignalQualityValidation(){
 const q=createSignalQualityEngine();
 check('Engine is paper-only',q.snapshot().paperOnly===true);
 check('No real order capability is exposed',q.snapshot().realOrderPlaced===false && q.snapshot().productionRealTradingEnabled===false);
 q.observe({id:'b1',symbol:'RELIANCE',action:'BUY',score:90,strategy:'TREND',timestamp:1,price:2500,accepted:true,riskPassed:true});
 q.observe({id:'s1',symbol:'TCS',action:'SELL',score:75,strategy:'MEAN_REVERSION',timestamp:2,price:3500,accepted:true,riskPassed:true});
 q.observe({id:'h1',symbol:'INFY',action:'HOLD',score:55,strategy:'TREND',timestamp:3,price:1500,accepted:true,riskPassed:true});
 q.observe({id:'r1',symbol:'HDFC',action:'BUY',score:40,strategy:'RISK',accepted:false,riskPassed:true});
 q.observe({id:'k1',symbol:'ITC',action:'BUY',score:80,strategy:'RISK',accepted:true,riskPassed:false});
 q.observe({id:'b1',symbol:'RELIANCE',action:'BUY',score:90,strategy:'TREND',timestamp:1,price:2500,accepted:true,riskPassed:true});
 let s=q.snapshot();
 check('Signal frequency is counted',s.total===6);
 check('BUY/SELL/HOLD distribution is tracked',s.byAction.BUY===3 && s.byAction.SELL===1 && s.byAction.HOLD===1);
 check('Accepted signals are tracked',s.accepted===3);
 check('Rejected signals are tracked',s.rejected===3);
 check('Risk-blocked signals are tracked',s.riskBlocked===1);
 check('Duplicate signals are tracked',s.duplicates===1);
 check('Score distribution is tracked',s.scoreStats.count===5 && s.scoreStats.min===40 && s.scoreStats.max===90);
 check('Acceptance rate is calculated',s.acceptanceRate===50);
 check('Strategy-level tracking is available',s.byStrategy.TREND.total===3 && s.byStrategy.RISK.riskBlocked===1);
 q.recordOutcome({strategy:'TREND',pnl:500}); q.recordOutcome({strategy:'MEAN_REVERSION',pnl:-200}); q.recordOutcome({strategy:'TREND',pnl:0,falseSignal:true});
 s=q.snapshot();
 check('Outcomes are tracked',s.outcomes.wins===1 && s.outcomes.losses===1 && s.outcomes.flat===1);
 check('False signals are tracked',s.falseSignals===1);
 check('Signal P&L is tracked',s.pnl===300);
 check('Win rate is calculated',s.winRate===50);
 check('Safety assertion passes',assertSignalQualitySafety(s));
 const passed=tests.filter(x=>x.passed).length, failed=tests.length-passed;
 const summary={passed,failed,allAssertionsPassed:failed===0,suiteStatus:failed===0?'PASSED':'FAILED',paperOnly:s.paperOnly,realOrderPlaced:s.realOrderPlaced,productionRealTradingEnabled:s.productionRealTradingEnabled,results:tests};
 console.table(summary); console.log(`SIGNAL QUALITY EVALUATION VALIDATION: ${summary.suiteStatus}`); return summary;
}
if(typeof window!=='undefined') window.runSignalQualityValidation=runSignalQualityValidation;
