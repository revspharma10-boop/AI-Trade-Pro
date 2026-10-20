// Synthetic-input engineering tests only. Never represent these as market results.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHybridPaperResearchCoordinator,validateModelVote,
  validateNewsRisk,validateSourceForecast,HYBRID_AGENT_SAFETY,
  HYBRID_RESEARCH_POLICY} from './hybridAgenticPaperResearch.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
const at=Date.parse('2026-10-09T04:10:20.000Z'); // 09:40:20 IST
const forecast=()=>({
  schemaVersion:1,kind:'DIRECTIONAL_FORECAST',market:'nifty',
  exchange:'NSE',status:'PROVISIONAL_DIRECTION',dataQuality:'VERIFIED',
  direction:'BULLISH',id:sha('synthetic-forecast'),
  evidenceHash:sha('synthetic-feature-payload'),
  instrument:'SYNTHETIC',underlyingInstrumentKey:'NSE_INDEX|Synthetic Nifty',
  referencePrice:100,sourceQuoteAtUtc:'2026-10-09T04:10:19.000Z',
  capturedAtUtc:'2026-10-09T04:10:20.000Z',
  featureCutoffUtc:'2026-10-09T04:10:20.000Z',
  forecastCandleEndUtc:'2026-10-09T04:10:00.000Z',
  horizonEndUtc:'2026-10-09T04:15:00.000Z',
  paperOnly:true,realOrderPlaced:false,orderSubmissionAllowed:false
});
const vote=f=>({
  kind:'MODEL_VOTE',inputForecastId:f.id,
  featureEvidenceHash:f.evidenceHash,direction:'BULLISH',
  outOfSampleValidated:true,modelVersion:'synthetic_ml_v1',
  featureCutoffUtc:f.featureCutoffUtc,
  trainedThroughUtc:'2026-10-08T10:00:00.000Z'
});
const news=f=>({
  kind:'NEWS_RISK_REVIEW',verified:true,decision:'CLEAR',
  featureCutoffUtc:f.featureCutoffUtc,
  latestSourceAtUtc:'2026-10-09T03:55:00.000Z'
});
const run=({f=forecast(),v=vote(f),n=null,newsAgent=null,
  sourceThrows=false,modelThrows=false}={})=>{
  const sourcePipeline={async tick(){
    if(sourceThrows)throw Error('SECRET_API_TOKEN_SHOULD_NOT_ESCAPE');
    return {status:'RECORDED',event:f};
  }};
  const modelAgent={async predict(context){
    if(modelThrows)throw Error('SECRET_API_TOKEN_SHOULD_NOT_ESCAPE');
    assert.deepEqual(Object.keys(context).sort(),[
      'capturedAtUtc','featureCutoffUtc','featureEvidenceHash','forecastId',
      'instrumentKey','market','sourceDirection'
    ].sort());
    return v;
  }};
  const agent=newsAgent??(n?{async review(){return n;}}:null);
  return createHybridPaperResearchCoordinator({
    sourcePipeline,modelAgent,newsRiskAgent:agent
  }).tick({market:'nifty',asOf:at});
};

test('safety flags and capital policy remain immutable and disabled',()=>{
  assert.equal(HYBRID_AGENT_SAFETY.paperOnly,true);
  assert.equal(HYBRID_AGENT_SAFETY.orderSubmissionAllowed,false);
  assert.equal(HYBRID_AGENT_SAFETY.realOrderPlaced,false);
  assert.equal(HYBRID_AGENT_SAFETY.productionRealTradingEnabled,false);
  assert.equal(HYBRID_RESEARCH_POLICY.nominalCapitalINR,50000);
  assert.equal(HYBRID_RESEARCH_POLICY.maxRiskPerTradeINR,500);
  assert.equal(HYBRID_RESEARCH_POLICY.qualifiedTradeEntryEnabled,false);
});
test('verified technical plus independent OOS model is provisional only',async()=>{
  const result=await run();
  assert.equal(result.state,'PROVISIONAL_DIRECTION');
  assert.equal(result.direction,'BULLISH');
  assert.equal(result.recordedDurably,false);
  assert.equal(result.optionPlanQualified,false);
  assert.equal(result.approvedLots,0);
  assert.equal(result.tradeEntry,null);
  assert.equal(result.contract,null);
  assert.equal(result.probability,null);
  assert.match(result.researchId,/^[a-f0-9]{64}$/);
});
test('model vote cannot upgrade to a trade, even with forged fields',async()=>{
  const f=forecast();const v={...vote(f),
    orderSubmissionAllowed:true,approvedLots:999,tradeEntry:100,
    confidence:1,realOrderPlaced:true};
  const r=await run({f,v});
  assert.equal(r.orderSubmissionAllowed,false);
  assert.equal(r.realOrderPlaced,false);
  assert.equal(r.approvedLots,0);
  assert.equal(r.tradeEntry,null);
  assert.equal(r.probability,null);
});
test('model disagreement returns WAIT',async()=>{
  const f=forecast(),r=await run({f,v:{...vote(f),direction:'BEARISH'}});
  assert.equal(r.state,'WAIT');
  assert.deepEqual(r.reasonCodes,['TECHNICAL_MODEL_DISAGREEMENT']);
});
test('model without out-of-sample evidence returns WAIT',async()=>{
  const f=forecast(),r=await run({f,v:{...vote(f),outOfSampleValidated:false}});
  assert.equal(r.state,'WAIT');
  assert.deepEqual(r.reasonCodes,['MODEL_EVIDENCE_NOT_QUALIFIED']);
});
test('model trained after decision boundary returns WAIT',async()=>{
  const f=forecast(),r=await run({f,v:{...vote(f),trainedThroughUtc:'2026-10-10T00:00:00.000Z'}});
  assert.equal(r.state,'WAIT');
});
test('model using different feature evidence returns WAIT',async()=>{
  const f=forecast(),r=await run({f,v:{...vote(f),featureEvidenceHash:sha('future-data')}});
  assert.equal(r.state,'WAIT');
});
test('model with unverified input forecast ID returns WAIT',async()=>{
  const f=forecast(),r=await run({f,v:{...vote(f),inputForecastId:sha('other')}});
  assert.equal(r.state,'WAIT');
});
test('stale quote returns WAIT',async()=>{
  const f={...forecast(),sourceQuoteAtUtc:'2026-10-09T04:07:00.000Z'};
  assert.equal((await run({f,v:vote(f)})).state,'WAIT');
});
test('future quote returns WAIT',async()=>{
  const f={...forecast(),sourceQuoteAtUtc:'2026-10-09T04:10:25.000Z'};
  assert.equal((await run({f,v:vote(f)})).state,'WAIT');
});
test('source event with order access returns WAIT',async()=>{
  const f={...forecast(),orderSubmissionAllowed:true};
  assert.equal((await run({f,v:vote(f)})).state,'WAIT');
});
test('expired five-minute horizon returns WAIT',()=>{
  assert.equal(validateSourceForecast(forecast(),{market:'nifty',asOf:at+300000}),false);
});
test('news risk veto prevents provisional forecast',async()=>{
  const f=forecast(),n={...news(f),decision:'BLOCK'};
  const r=await run({f,v:vote(f),n});
  assert.equal(r.state,'WAIT');
  assert.deepEqual(r.reasonCodes,['NEWS_RISK_VETO']);
});
test('news clear must be verified, not in the future',async()=>{
  const f=forecast(),n={...news(f),latestSourceAtUtc:'2026-10-09T04:10:40.000Z'};
  const r=await run({f,v:vote(f),n});
  assert.equal(r.state,'WAIT');
  assert.deepEqual(r.reasonCodes,['NEWS_EVIDENCE_NOT_QUALIFIED']);
});
test('optional news CLEAR can join without controlling price',async()=>{
  const f=forecast(),r=await run({f,v:vote(f),n:news(f)});
  assert.equal(r.state,'PROVISIONAL_DIRECTION');
  assert.equal(r.newsDecision,'CLEAR');
  assert.equal(r.tradeEntry,null);
});
test('source errors are sanitized, never expose credentials',async()=>{
  const r=await run({sourceThrows:true});
  assert.deepEqual(r.reasonCodes,['TECHNICAL_SOURCE_UNAVAILABLE']);
  assert.ok(!JSON.stringify(r).includes('SECRET_API_TOKEN'));
});
test('model errors are sanitized, never expose credentials',async()=>{
  const r=await run({modelThrows:true});
  assert.deepEqual(r.reasonCodes,['MODEL_AGENT_UNAVAILABLE']);
  assert.ok(!JSON.stringify(r).includes('SECRET_API_TOKEN'));
});
test('configured news agent failure fails closed',async()=>{
  const r=await run({newsAgent:{async review(){throw Error('SECRET_API_TOKEN');}}});
  assert.deepEqual(r.reasonCodes,['NEWS_AGENT_UNAVAILABLE']);
});
test('invalid dependencies cannot build coordinator',()=>{
  assert.throws(()=>createHybridPaperResearchCoordinator({
    sourcePipeline:{tick(){}},modelAgent:{}
  }),/HYBRID_REQUIRED_RESEARCH_AGENTS_MISSING/);
});
test('synthetic market forecast cannot be relabelled as other market',async()=>{
  const f={...forecast(),market:'sensex'};
  assert.equal((await run({f,v:vote(f)})).state,'WAIT');
});
test('model vote and news veto validators have strict contracts',()=>{
  const f=forecast();
  assert.equal(validateModelVote(vote(f),f),true);
  assert.equal(validateNewsRisk(news(f),f),true);
  assert.equal(validateModelVote({...vote(f),modelVersion:'!'},f),false);
  assert.equal(validateNewsRisk({...news(f),verified:false},f),false);
});
