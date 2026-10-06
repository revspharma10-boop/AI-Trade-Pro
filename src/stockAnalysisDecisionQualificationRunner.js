import { buildStockAnalysisDecision, assertStockAnalysisDecisionSafe } from './services/stockAnalysisDecisionEngine.js';

function fullScores(value=80) {
  return {
    trend:value,momentum:value,adx:value,supertrend:value,volume:value,
    candlestick:value,chartPattern:value,supportResistance:value,vwap:value,atr:value
  };
}
function fundamentals(value=80) {
  return {
    revenueGrowth:value,profitGrowth:value,profitability:value,roeRoce:value,debt:value,
    cashFlow:value,valuation:value,earningsConsistency:value,businessSector:value,riskFlags:value
  };
}
const checks=[];
const check=(name,pass)=>checks.push([name,Boolean(pass)]);

const missing=buildStockAnalysisDecision({symbol:'TEST'});
check('missing evidence fails closed to WAIT',missing.recommendation==='WAIT'&&!missing.paperEligible&&missing.status==='INSUFFICIENT_DATA');
check('missing evidence never creates prices',missing.entryZone===null&&missing.stopLoss===null&&missing.targets.length===0);

const qualified=buildStockAnalysisDecision({
  symbol:'TEST',marketDataFresh:true,technicalScores:fullScores(90),fundamentalScores:fundamentals(90),
  marketRegimeScore:90,entryZone:{low:100,high:101},stopLoss:95,targets:[110,115],riskRewardRatio:2,
  riskGates:{liquidityAcceptable:true,technicalConfirmation:true,stopLossValid:true,volatilityAcceptable:true,marketRegimeAcceptable:true},
  technicalEvidence:['trend confirmed'],fundamentalEvidence:['fundamentals confirmed']
});
check('complete evidence can qualify',qualified.paperEligible===true&&['BUY','STRONG BUY'].includes(qualified.recommendation));
check('qualified decision remains paper-only',assertStockAnalysisDecisionSafe(qualified)&&qualified.realOrderPlaced===false);

const blocked=buildStockAnalysisDecision({
  symbol:'TEST',marketDataFresh:true,technicalScores:fullScores(90),fundamentalScores:fundamentals(90),
  marketRegimeScore:90,entryZone:{low:100,high:101},stopLoss:95,targets:[110],riskRewardRatio:2,
  riskGates:{liquidityAcceptable:false,technicalConfirmation:true,stopLossValid:true,volatilityAcceptable:true,marketRegimeAcceptable:true}
});
check('failed risk gate overrides high scores to WAIT',blocked.recommendation==='WAIT'&&!blocked.paperEligible);

for(const [name,pass] of checks) console.log((pass?'PASS ':'FAIL ')+name);
const failed=checks.filter(([,p])=>!p).length;
console.log('STOCK_ANALYSIS_DECISION_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
process.exit(failed?1:0);
