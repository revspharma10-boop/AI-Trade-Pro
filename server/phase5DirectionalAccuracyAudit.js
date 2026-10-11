// Phase 5: OFFLINE audit of append-only directional research events.
// No market feeds, credential access, trading endpoints, or automated model promotion.
// The source of the input records is not authenticated by this module.
import {validatePhase1Event} from './phase1LocalJsonlLedger.js';

const finite=x=>typeof x==='number'&&Number.isFinite(x);
const percent=(part,whole)=>whole>0?Number((100*part/whole).toFixed(2)):null;
const dateIST=timestamp=>new Date(Date.parse(timestamp)+330*60000).toISOString().slice(0,10);
const isForward=(event,now)=>Date.parse(event.capturedAtUtc)<=now;
const normalized=(n)=>Number(n.toFixed(4));

// Two-sided Wilson 95% interval; does not correct for time dependence,
// overlapping horizons or selection bias. Never show a CI for zero observations.
export function wilson95(successes,trials){
 if(!Number.isSafeInteger(successes)||!Number.isSafeInteger(trials)||
   successes<0||trials<0||successes>trials)
  throw Error('ACCURACY_COUNTS_INVALID');
 if(trials===0)return null;
 const z=1.95996398454,p=successes/trials,z2=z*z,den=1+z2/trials;
 const center=(p+z2/(2*trials))/den;
 const half=z*Math.sqrt(p*(1-p)/trials+z2/(4*trials*trials))/den;
 return {lowerPct:Number((100*Math.max(0,center-half)).toFixed(2)),
  upperPct:Number((100*Math.min(1,center+half)).toFixed(2))};
}
function bucket(events,outcomeByForecast){
 const count={eligibleDecisions:events.length,directional:0,abstained:0,
  correct:0,incorrect:0,inconclusive:0,unevaluable:0,pending:0};
 const days=new Set();
 for(const f of events){
  days.add(dateIST(f.forecastCandleEndUtc));
  if(f.direction==='ABSTAIN'){count.abstained++;continue;}
  count.directional++;
  const outcome=outcomeByForecast.get(f.id);
  if(!outcome){count.pending++;continue;}
  count[outcome.outcome.toLowerCase()]++;
 }
 const evaluable=count.correct+count.incorrect+count.inconclusive;
 const decisive=count.correct+count.incorrect;
 return {...count,sessions:days.size,evaluable,decisive,
  // Primary: includes neutral results, not just directional winners.
  evaluatedAccuracyPct:percent(count.correct,evaluable),
  decisiveAccuracyPct:percent(count.correct,decisive),
  grossDirectionalSuccessPct:percent(count.correct,count.directional),
  directionalCoveragePct:percent(count.directional,count.eligibleDecisions),
  outcomeResolutionPct:percent(evaluable+count.unevaluable,count.directional),
  inconclusivePct:percent(count.inconclusive,evaluable),
  wilson95Evaluable:wilson95(count.correct,evaluable)};
}
export function evaluateDirectionalHistory({
 forecasts=[],outcomes=[],asOf=Date.now(),provenance='UNVERIFIED'
}={}){
 const now=Number(new Date(asOf));
 if(!finite(now)||!Array.isArray(forecasts)||!Array.isArray(outcomes)||
  !['UNVERIFIED','SYNTHETIC_FIXTURE','USER_SUPPLIED_UNVERIFIED'].includes(provenance))
  throw Error('ACCURACY_INPUT_INVALID');
 const byId=new Map(),decisionSlots=new Set(),outcomeByForecast=new Map();
 for(const f of forecasts){
  validatePhase1Event(f);
  if(f.kind!=='DIRECTIONAL_FORECAST'||byId.has(f.id)||
    !isForward(f,now))
   throw Error('ACCURACY_FORECAST_ID_OR_TIME_INVALID');
  const slot=[f.market,f.strategyVersion,f.forecastCandleEndUtc].join('|');
  if(decisionSlots.has(slot))throw Error('ACCURACY_DUPLICATE_DECISION_WINDOW');
  decisionSlots.add(slot);byId.set(f.id,f);
 }
 const outcomeIds=new Set();
 for(const o of outcomes){
  validatePhase1Event(o);
  if(o.kind!=='DIRECTIONAL_OUTCOME'||outcomeIds.has(o.id)||
    outcomeByForecast.has(o.forecastId)||!isForward(o,now))
   throw Error('ACCURACY_OUTCOME_ID_OR_TIME_INVALID');
  const f=byId.get(o.forecastId);
  if(!f||f.status!=='PROVISIONAL_DIRECTION'||
    f.market!==o.market||f.exchange!==o.exchange||
    f.forecastCandleEndUtc!==o.forecastCandleEndUtc||
    f.horizonEndUtc!==o.horizonEndUtc||
    f.underlyingInstrumentKey!==o.underlyingInstrumentKey||
    f.referencePrice!==o.referencePrice||
    Date.parse(o.capturedAtUtc)<Date.parse(f.horizonEndUtc)||
    Date.parse(o.capturedAtUtc)<=Date.parse(f.capturedAtUtc))
    throw Error('ACCURACY_OUTCOME_FORECAST_MISMATCH');
  if(o.outcome==='UNEVALUABLE'){
   if(o.observedClose!==null||o.changeBps!==null||
      Date.parse(o.capturedAtUtc)<Date.parse(f.horizonEndUtc)+180000)
    throw Error('ACCURACY_UNEVALUABLE_TOO_EARLY');
  }else{
   if(o.observedCloseAtUtc!==f.horizonEndUtc||
      Date.parse(o.observedCloseAtUtc)>Date.parse(o.capturedAtUtc))
    throw Error('ACCURACY_SETTLEMENT_CHRONOLOGY_INVALID');
   const change=normalized(10000*(o.observedClose-f.referencePrice)/f.referencePrice);
   const label=Math.abs(change)<=2?'INCONCLUSIVE':
    change*(f.direction==='BULLISH'?1:-1)>0?'CORRECT':'INCORRECT';
   if(Math.abs(change-o.changeBps)>0.00011||o.outcome!==label)
    throw Error('ACCURACY_OUTCOME_RECOMPUTATION_FAILED');
  }
  outcomeIds.add(o.id);outcomeByForecast.set(o.forecastId,o);
 }
 const ordered=[...forecasts].sort((a,b)=>
  a.forecastCandleEndUtc.localeCompare(b.forecastCandleEndUtc)||a.id.localeCompare(b.id));
 const byModel=new Map();
 for(const f of ordered){
  const key=f.market+'|'+f.strategyVersion;
  if(!byModel.has(key))byModel.set(key,[]);
  byModel.get(key).push(f);
 }
 const models=Object.fromEntries([...byModel.entries()].map(([key,events])=>
  [key,bucket(events,outcomeByForecast)]));
 const total=bucket(ordered,outcomeByForecast);
 return Object.freeze({
  status:forecasts.length?'AUDITED_UNVERIFIED_HISTORY':'NO_RECORDED_FORECASTS',
  provenance,realForwardAccuracyVerified:false,
  sourceIntegrityExternallyVerified:false,
  autoPromotionAllowed:false,realOrdersAllowed:false,
  scoreDefinition:'CORRECT / (CORRECT + INCORRECT + INCONCLUSIVE)',
  evidenceLimitations:[
   'Input provenance not independently authenticated',
   'No control for serially correlated or overlapping forecast outcomes',
   'Directional accuracy does not measure options P&L, slippage or costs',
   'No live model promotion from an accuracy report'
  ],
  total,models
 });
}

// A large, temporally independent sample and a signed data-ingestion audit
// are prerequisites. This offline report can NEVER activate a candidate.
export function accuracyPromotionReview(report,{minimumEvaluable=100,minimumSessions=20}={}){
 if(!report||!Number.isSafeInteger(minimumEvaluable)||
  !Number.isSafeInteger(minimumSessions)||minimumEvaluable<30||minimumSessions<10)
  throw Error('ACCURACY_REVIEW_INVALID');
 const reasons=[];
 if(!report.realForwardAccuracyVerified)reasons.push('FORWARD_DATA_NOT_INDEPENDENTLY_VERIFIED');
 if(report.total?.evaluable<minimumEvaluable)reasons.push('OUT_OF_SAMPLE_COUNT_INSUFFICIENT');
 if(report.total?.sessions<minimumSessions)reasons.push('SESSION_DIVERSITY_INSUFFICIENT');
 if(report.total?.pending>0)reasons.push('UNRESOLVED_OUTCOMES');
 if(Object.keys(report.models??{}).length!==1)
  reasons.push('MODEL_AND_MARKET_SPECIFIC_HOLDOUT_REQUIRED');
 return {status:'BLOCKED_PENDING_INDEPENDENT_REVIEW',
  autoPromotionAllowed:false,realOrdersAllowed:false,reasons};
}
