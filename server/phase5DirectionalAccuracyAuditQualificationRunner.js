// Synthetic-fixture validation ONLY; never interpreted as historical market edge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateDirectionalHistory,accuracyPromotionReview,wilson95,
 chronologicalAccuracyHoldout}
 from './phase5DirectionalAccuracyAudit.js';
import {selectiveOpeningRangeCandidate,SELECTIVE_CANDIDATE_VERSION}
 from './phase5SelectiveResearchCandidate.js';
import {deriveOpeningRangeBias} from '../src/services/openingRangeResearch.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const utc=ms=>new Date(ms).toISOString();
const start=Date.parse('2026-10-09T09:40:00+05:30');
const advance=i=>start+i*300000;
function forecast(i,direction='BULLISH',market='nifty'){
 const when=advance(i),hasDirection=direction!=='ABSTAIN';
 const captured=utc(when+20000);
 return {schemaVersion:1,kind:'DIRECTIONAL_FORECAST',
  id:sha('test-fixture|forecast|'+market+'|'+i),
  market,exchange:market==='nifty'?'NSE':'BSE',
  strategyVersion:'or15-shadow-v1',
  forecastCandleEndUtc:utc(when),capturedAtUtc:captured,
  horizonEndUtc:utc(when+300000),featureCutoffUtc:captured,
  underlyingInstrumentKey:hasDirection?(market==='nifty'?'NSE_INDEX|Synthetic':'BSE_INDEX|Synthetic'):null,
  direction,status:hasDirection?'PROVISIONAL_DIRECTION':'ABSTAIN',
  referencePrice:hasDirection?100:null,
  sourceQuoteAtUtc:hasDirection?utc(when+19000):null,
  evidenceHash:hasDirection?sha('test-fixture|evidence|'+i):null,
  reasonCodes:['SYNTHETIC_TEST_ONLY'],dataQuality:hasDirection?'VERIFIED':'MISSING',
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false};
}
function outcome(f,observedClose,atMs){
 const horizon=Date.parse(f.horizonEndUtc);
 const isMissing=observedClose===null;
 const bps=isMissing?null:Number((10000*(observedClose-f.referencePrice)/f.referencePrice).toFixed(4));
 const code=isMissing?'UNEVALUABLE':
  Math.abs(bps)<=2?'INCONCLUSIVE':
   bps*(f.direction==='BULLISH'?1:-1)>0?'CORRECT':'INCORRECT';
 return {schemaVersion:1,kind:'DIRECTIONAL_OUTCOME',
  id:sha('test-fixture|outcome|'+f.id),
  forecastId:f.id,market:f.market,exchange:f.exchange,
  forecastCandleEndUtc:f.forecastCandleEndUtc,
  capturedAtUtc:utc(atMs??horizon+20000),
  horizonEndUtc:f.horizonEndUtc,
  observedCloseAtUtc:isMissing?null:f.horizonEndUtc,
  underlyingInstrumentKey:f.underlyingInstrumentKey,outcome:code,
  referencePrice:f.referencePrice,observedClose,changeBps:bps,
  reasonCode:isMissing?'SETTLEMENT_PROVIDER_UNAVAILABLE':'HORIZON_5M_VERIFIED_CANDLE',
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false};
}
const [f1,f2,f3,f4,f5,f6]=[
 forecast(0,'BULLISH'),forecast(1,'BEARISH'),
 forecast(2,'BULLISH'),forecast(3,'BULLISH'),
 forecast(4,'ABSTAIN'),forecast(5,'BEARISH')
];
const outcomes=[outcome(f1,100.1),outcome(f2,100.1),
 outcome(f3,100.01),outcome(f6,null,Date.parse(f6.horizonEndUtc)+185000)];
const input={forecasts:[f1,f2,f3,f4,f5,f6],outcomes,
 asOf:utc(advance(7)),provenance:'SYNTHETIC_FIXTURE'};
const report=evaluateDirectionalHistory(input);
assert.equal(report.status,'AUDITED_UNVERIFIED_HISTORY');
assert.equal(report.realForwardAccuracyVerified,false);
assert.equal(report.autoPromotionAllowed,false);
assert.equal(report.total.eligibleDecisions,6);
assert.equal(report.total.directional,5);
assert.equal(report.total.abstained,1);
assert.equal(report.total.correct,1);
assert.equal(report.total.incorrect,1);
assert.equal(report.total.inconclusive,1);
assert.equal(report.total.unevaluable,1);
assert.equal(report.total.pending,1);
assert.equal(report.total.evaluable,3);
assert.equal(report.total.decisive,2);
assert.equal(report.total.evaluatedAccuracyPct,33.33);
assert.equal(report.total.decisiveAccuracyPct,50);
assert.equal(report.total.grossDirectionalSuccessPct,20);
assert.equal(report.total.directionalCoveragePct,83.33);
assert.equal(report.total.outcomeResolutionPct,80);
assert.ok(report.total.wilson95Evaluable.lowerPct<report.total.evaluatedAccuracyPct);
assert.ok(report.total.wilson95Evaluable.upperPct>report.total.evaluatedAccuracyPct);
assert.equal(report.models['nifty|or15-shadow-v1'].correct,1);
assert.equal(report.total.sessions,1);
assert.equal(wilson95(0,0),null);
assert.deepEqual(Object.keys(evaluateDirectionalHistory({}).models),[]);
assert.equal(evaluateDirectionalHistory({}).total.evaluatedAccuracyPct,null);
assert.equal(evaluateDirectionalHistory({}).status,'NO_RECORDED_FORECASTS');
const separated=chronologicalAccuracyHoldout({...input,
 trainEndUtc:utc(advance(1)+60000),validationEndUtc:utc(advance(3)+60000)});
assert.equal(separated.status,'OFFLINE_CHRONOLOGICAL_HOLDOUT_ONLY');
assert.equal(separated.censoredOverlapCount,2,'Overlapping forecast horizons are embargoed');
assert.equal(separated.train.total.eligibleDecisions,1);
assert.equal(separated.validation.total.eligibleDecisions,1);
assert.equal(separated.test.total.eligibleDecisions,2);
assert.equal(separated.train.total.correct,1);
assert.equal(separated.test.total.unevaluable,1);
assert.equal(separated.autoPromotionAllowed,false);
const delayed=chronologicalAccuracyHoldout({...input,
 trainEndUtc:utc(advance(1)+10000),validationEndUtc:utc(advance(3)+60000)});
assert.equal(delayed.train.total.eligibleDecisions,0,
 'Outcome reported after training cutoff must not leak into training');
assert.ok(delayed.censoredOverlapCount>=1);
assert.throws(()=>chronologicalAccuracyHoldout({...input,
 trainEndUtc:utc(advance(2)),validationEndUtc:utc(advance(1))}),
 /ACCURACY_HOLDOUT_BOUNDARIES_INVALID/);
const gate=accuracyPromotionReview(report);
assert.equal(gate.autoPromotionAllowed,false);
assert.ok(gate.reasons.includes('FORWARD_DATA_NOT_INDEPENDENTLY_VERIFIED'));
assert.ok(gate.reasons.includes('OUT_OF_SAMPLE_COUNT_INSUFFICIENT'));
assert.ok(gate.reasons.includes('SESSION_DIVERSITY_INSUFFICIENT'));
assert.ok(gate.reasons.includes('UNRESOLVED_OUTCOMES'));
const unsafeCases=[
 {...input,forecasts:[f1,f1]},
 {...input,forecasts:[f1,{...f1,id:sha('other-id')}]},
 {...input,outcomes:[...outcomes,outcomes[0]]},
 {...input,outcomes:[...outcomes,outcome(f5,100.1)]},
 {...input,outcomes:[...outcomes,{...outcome(f1,100.1),id:sha('other-outcome')}]},
 {...input,outcomes:[{...outcomes[0],outcome:'INCORRECT'},...outcomes.slice(1)]},
 {...input,outcomes:[{...outcomes[0],changeBps:1000},...outcomes.slice(1)]},
 {...input,outcomes:[{...outcomes[0],underlyingInstrumentKey:'BSE_INDEX|Another'},...outcomes.slice(1)]},
 {...input,outcomes:[{...outcomes[0],observedCloseAtUtc:utc(Date.parse(f1.horizonEndUtc)-60000)},...outcomes.slice(1)]},
 {...input,outcomes:[{...outcomes[0],capturedAtUtc:f1.capturedAtUtc},...outcomes.slice(1)]},
 {...input,outcomes:[...outcomes.slice(0,-1),
   {...outcomes.at(-1),capturedAtUtc:utc(Date.parse(f6.horizonEndUtc)+30000)}]},
 {...input,asOf:utc(advance(1))}
];
for(const [i,test] of unsafeCases.entries())assert.throws(
 ()=>evaluateDirectionalHistory(test),/ACCURACY_|PHASE1_/,
 'Bad replay '+i+' should never inflate accuracy');
assert.throws(()=>wilson95(2,1),/ACCURACY_COUNTS_INVALID/);
assert.throws(()=>accuracyPromotionReview(report,{minimumEvaluable:1}),/ACCURACY_REVIEW_INVALID/);

// Candidate only judges already-cutoff evidence: no future candles are added.
const at=t=>Date.parse('2026-10-09T'+t+':00+05:30');
const bar=(t,open,high,low,close)=>({
 datetime:utc(at(t)),open,high,low,close,volume:1200});
const mixed=[bar('09:15',25000,25038,24985,25030),
 bar('09:20',25030,25040,24970,24980),
 bar('09:25',24980,25028,24965,25010)];
const breakout=bar('09:30',25010,25070,25003,25062);
const quote=(v,atMs)=>({lastPrice:v,timestamp:atMs});
const session={open:true,exchange:'NSE'};
const earlyOnly=deriveOpeningRangeBias({candles:mixed,quote:quote(25015,at('09:30')+15000),
 session,asOf:at('09:30')+16000});
assert.equal(selectiveOpeningRangeCandidate({
 early:earlyOnly,asOf:at('09:30')+16000}).direction,'ABSTAIN');
const validBreak=deriveOpeningRangeBias({candles:[...mixed,breakout],
 quote:quote(25065,at('09:35')+15000),session,asOf:at('09:35')+16000});
const candidate=selectiveOpeningRangeCandidate({early:validBreak,asOf:at('09:35')+16000});
assert.equal(candidate.status,'SELECTIVE_HYPOTHESIS');
assert.equal(candidate.direction,'BULLISH');
assert.equal(candidate.strategyVersion,SELECTIVE_CANDIDATE_VERSION);
assert.equal(candidate.accuracyValidated,false);
assert.equal(candidate.optionPlanQualified,false);
assert.equal(candidate.orderSubmissionAllowed,false);
assert.equal(candidate.confidenceProbability,null);
for(const bad of [
 {...validBreak,breakoutConfirmedByCompletedCandle:false},
 {...validBreak,breakoutConfirmedByQuote:false},
 {...validBreak,optionPlanQualified:true},
 {...validBreak,orderSubmissionAllowed:true},
 {...validBreak,signalBasis:'OPENING_15M_BULLISH_BODY_AND_CLOSE_SEQUENCE'},
 {...validBreak,indexPriceAtCapture:24950}
])assert.equal(selectiveOpeningRangeCandidate({early:bad,asOf:at('09:35')+16000})
 .direction,'ABSTAIN');
assert.equal(selectiveOpeningRangeCandidate({early:validBreak,asOf:at('09:40')+16000})
 .direction,'ABSTAIN','Late breakout cannot be used as new forecast');
console.log('PHASE 5 ACCURACY AUDIT PASSED: synthetic-only outcome integrity, uncertainty, denominator accounting, blocked promotion, and offline selective candidate.');
