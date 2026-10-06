// AI TRADE PRO — QUALIFIED DECISION TO PAPER TRADE BRIDGE
// No broker adapter. BUY-only until bearish accounting is separately qualified.
export function buildPaperCandidateFromDecision(decision={},quantity=1){
  const q=Math.floor(Number(quantity));
  const reasons=[];
  if(decision.paperEligible!==true)reasons.push('DECISION_NOT_PAPER_ELIGIBLE');
  if(!['BUY','STRONG BUY'].includes(decision.recommendation))reasons.push('BUY_DECISION_REQUIRED');
  if(decision.riskGatesPassed!==true)reasons.push('RISK_GATES_NOT_PASSED');
  if(!(q>0))reasons.push('QUANTITY_INVALID');
  const price=Number(decision.entryZone?.high),stopLoss=Number(decision.stopLoss),target=Number(decision.targets?.[0]);
  if(!(price>0&&stopLoss>0&&target>price))reasons.push('PRICE_LEVELS_INVALID');
  if(reasons.length)return {valid:false,reasons,paperOnly:true,realOrderPlaced:false};
  return {valid:true,symbol:decision.symbol,recommendation:'BUY',quantity:q,price,entryPrice:price,stopLoss,target,targets:decision.targets,riskRewardRatio:decision.riskRewardRatio,opportunityScore:decision.opportunityScore,source:'AI_STOCK_ANALYSIS',paperOnly:true,realOrderPlaced:false};
}
export function evaluatePaperExit(position={},candidate={},markPrice){
  const price=Number(markPrice),stop=Number(candidate.stopLoss),targets=Array.isArray(candidate.targets)?candidate.targets.map(Number):[];
  if(!Number.isFinite(price))return {action:'HOLD',reason:'MARK_PRICE_INVALID'};
  if(Number.isFinite(stop)&&price<=stop)return {action:'CLOSE',reason:'STOP_LOSS_HIT',price};
  const hit=targets.filter(Number.isFinite).find(t=>price>=t);
  if(hit)return {action:'CLOSE',reason:'TARGET_HIT',price,target:hit};
  return {action:'HOLD',reason:'NO_EXIT_CONDITION',price};
}
