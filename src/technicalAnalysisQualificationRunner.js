import { analyzeTechnicalHistory } from './services/technicalAnalysisEngine.js';
const candles=[]; let price=100;
for(let i=0;i<80;i++){price+=0.5; candles.push({datetime:`2026-01-${String(i+1).padStart(3,'0')}`,open:price-.3,high:price+1,low:price-1,close:price,volume:100000+i*1000});}
const checks=[]; const check=(n,p)=>checks.push([n,!!p]);
const short=analyzeTechnicalHistory(candles.slice(0,20));
check('insufficient history fails closed',short.valid===false&&short.levels===null);
const result=analyzeTechnicalHistory(candles);
check('sufficient OHLCV produces analysis',result.valid===true);
check('technical scores bounded',Object.values(result.scores).every(v=>Number.isFinite(v)&&v>=0&&v<=100));
check('entry zone valid',result.levels.entryZone.low>0&&result.levels.entryZone.high>=result.levels.entryZone.low);
check('protective stop below long entry',result.levels.stopLoss>0&&result.levels.stopLoss<result.levels.entryZone.low);
check('targets above entry',result.levels.targets.every(v=>v>result.levels.entryZone.high));
check('risk reward finite',Number.isFinite(result.levels.riskRewardRatio)&&result.levels.riskRewardRatio>0);
for(const [n,p] of checks)console.log((p?'PASS ':'FAIL ')+n);
const failed=checks.filter(x=>!x[1]).length;
console.log('TECHNICAL_ANALYSIS_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('PAPER_ONLY=true'); console.log('REAL_ORDER_PLACED=false');
process.exit(failed?1:0);
