import { buildStockAnalysisDecision,assertStockAnalysisDecisionSafe } from './services/stockAnalysisDecisionEngine.js';
const tech=v=>Object.fromEntries(['trend','momentum','adx','supertrend','volume','candlestick','chartPattern','supportResistance','vwap','atr'].map(k=>[k,v]));
const fund=v=>Object.fromEntries(['revenueGrowth','profitGrowth','profitability','roeRoce','debt','cashFlow','valuation','earningsConsistency','businessSector','riskFlags'].map(k=>[k,v]));
const base={symbol:'TEST',marketDataFresh:true,technicalScores:tech(90),fundamentalScores:fund(90),marketRegimeScore:85,entryZone:{low:100,high:101},stopLoss:96,targets:[108,111],riskRewardRatio:2,riskGates:{liquidityAcceptable:true,technicalConfirmation:true,stopLossValid:true,volatilityAcceptable:true,marketRegimeAcceptable:true}};
const cases=[
 ['bullish complete evidence qualifies',base,r=>['BUY','STRONG BUY'].includes(r.recommendation)&&r.paperEligible],
 ['weak fundamentals does not qualify',{...base,fundamentalScores:fund(20)},r=>r.recommendation==='WAIT'&&!r.paperEligible],
 ['risk-off market blocks trade',{...base,marketRegimeScore:25,riskGates:{...base.riskGates,marketRegimeAcceptable:false}},r=>r.recommendation==='WAIT'&&!r.paperEligible],
 ['failed RR blocks trade',{...base,riskRewardRatio:1.2},r=>r.recommendation==='WAIT'&&!r.paperEligible],
 ['stale data fails closed',{...base,marketDataFresh:false},r=>r.recommendation==='WAIT'&&!r.paperEligible],
 ['missing fundamentals fails closed',{...base,fundamentalScores:null},r=>r.recommendation==='WAIT'&&!r.paperEligible]
];
let failed=0;
for(const [name,input,test] of cases){const result=buildStockAnalysisDecision(input);const ok=test(result)&&assertStockAnalysisDecisionSafe(result);console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failed++;}
console.log('STAGE_C_DECISION_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('PAPER_ONLY=true');console.log('REAL_ORDER_PLACED=false');
process.exit(failed?1:0);
