// AI Trade Pro 3.0 — isolated, paper-only hybrid research coordinator.
// NOT imported by deployed server/UI. No broker/order APIs, no network or LLM SDK.
// Experimental: combines a Phase 1 verified technical forecast with a separately
// evaluated ML agent and optional news-risk veto. Never produces trade entries.
import {createHash} from 'node:crypto';

export const HYBRID_AGENT_SAFETY=Object.freeze({
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
  productionRealTradingEnabled:false,optionPlanQualified:false,approvedLots:0
});
export const HYBRID_RESEARCH_POLICY=Object.freeze({
  nominalCapitalINR:50000,maxRiskPerTradeINR:500,maxRiskFraction:0.01,
  qualifiedTradeEntryEnabled:false,requiresVerifiedOutOfSampleModel:true
});
const EXCHANGES=Object.freeze({nifty:'NSE',sensex:'BSE'});
const HASH=/^[a-f0-9]{64}$/;
const VERSION=/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/;
const DIRECTIONS=new Set(['BULLISH','BEARISH']);
const iso=ms=>new Date(ms).toISOString();
const validMs=x=>{
  if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x))return NaN;
  return Date.parse(x);
};
const goodMs=x=>Number.isFinite(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const wait=(market,asOf,code,details={})=>Object.freeze({
  schemaVersion:1,kind:'HYBRID_DIRECTIONAL_RESEARCH',market,
  evaluatedAtUtc:iso(asOf),state:'WAIT',direction:'ABSTAIN',
  reasonCodes:Object.freeze([code]),recordedDurably:false,
  evidence: null,...details,...HYBRID_AGENT_SAFETY
});

// The upstream Phase 1 event contract is allowlisted again at the trust boundary.
// This explicitly rejects future/stale quotes, forged timestamps and trade flags.
export function validateSourceForecast(event,{market,asOf}={}){
  if(!Object.hasOwn(EXCHANGES,market)||!goodMs(asOf))return false;
  if(!event||event.kind!=='DIRECTIONAL_FORECAST'||
    event.market!==market||event.exchange!==EXCHANGES[market]||
    event.status!=='PROVISIONAL_DIRECTION'||event.dataQuality!=='VERIFIED'||
    !DIRECTIONS.has(event.direction)||!HASH.test(event.id??'')||
    !HASH.test(event.evidenceHash??'')||
    event.paperOnly!==true||event.realOrderPlaced!==false||
    event.orderSubmissionAllowed!==false||
    !String(event.underlyingInstrumentKey??'').startsWith(event.exchange+'_INDEX|')||
    typeof event.referencePrice!=='number'||!Number.isFinite(event.referencePrice)||
    event.referencePrice<=0)return false;
  const observed=validMs(event.capturedAtUtc);
  const cutoff=validMs(event.featureCutoffUtc);
  const candleEnd=validMs(event.forecastCandleEndUtc);
  const horizon=validMs(event.horizonEndUtc);
  const quoted=validMs(event.sourceQuoteAtUtc);
  if(![observed,cutoff,candleEnd,horizon,quoted].every(goodMs))return false;
  return observed===cutoff&&observed<=asOf&&asOf-observed<=120000&&
    quoted<=cutoff&&cutoff-quoted<=120000&&
    candleEnd+12000<=cutoff&&cutoff-candleEnd<=90000&&
    horizon-candleEnd===300000&&asOf<horizon;
}

export function validateModelVote(vote,forecast){
  if(!vote||vote.kind!=='MODEL_VOTE'||vote.inputForecastId!==forecast.id||
    vote.featureEvidenceHash!==forecast.evidenceHash||
    !DIRECTIONS.has(vote.direction)||
    vote.outOfSampleValidated!==true||
    !VERSION.test(vote.modelVersion??'')||
    vote.featureCutoffUtc!==forecast.featureCutoffUtc)return false;
  const trainedThrough=validMs(vote.trainedThroughUtc);
  const candleEnd=validMs(forecast.forecastCandleEndUtc);
  return goodMs(trainedThrough)&&trainedThrough<candleEnd;
}

export function validateNewsRisk(news,forecast){
  if(!news||news.kind!=='NEWS_RISK_REVIEW'||news.verified!==true||
    !['CLEAR','BLOCK'].includes(news.decision)||
    news.featureCutoffUtc!==forecast.featureCutoffUtc)return false;
  const lastSource=validMs(news.latestSourceAtUtc);
  const cutoff=validMs(forecast.featureCutoffUtc);
  return goodMs(lastSource)&&lastSource<=cutoff&&cutoff-lastSource<=3600000;
}

// The agent has no order execution dependency and cannot upgrade a hypothesis
// to a trade. Model/optional news tools are passed as bounded research contracts.
export function createHybridPaperResearchCoordinator({
  sourcePipeline,modelAgent,newsRiskAgent=null
}={}){
  if(typeof sourcePipeline?.tick!=='function'||
     typeof modelAgent?.predict!=='function'||
     (newsRiskAgent!==null&&typeof newsRiskAgent.review!=='function'))
    throw Error('HYBRID_REQUIRED_RESEARCH_AGENTS_MISSING');

  async function tick({market,asOf=Date.now()}={}){
    const at=Number(new Date(asOf));
    if(!goodMs(at))throw Error('HYBRID_INVALID_CLOCK');
    if(!Object.hasOwn(EXCHANGES,market))throw Error('HYBRID_UNSUPPORTED_MARKET');
    let result;
    try{result=await sourcePipeline.tick({market,asOf:at});}
    catch(_){return wait(market,at,'TECHNICAL_SOURCE_UNAVAILABLE');}
    const forecast=result?.event;
    if(!validateSourceForecast(forecast,{market,asOf:at}))
      return wait(market,at,'TECHNICAL_FORECAST_NOT_QUALIFIED');

    // Only allowlisted identifiers/clock/evidence are shared with sub-agents.
    // A model adapter must resolve point-in-time features on its own and prove
    // that it used the exact original feature evidence hash.
    const context=Object.freeze({
      market,forecastId:forecast.id,sourceDirection:forecast.direction,
      instrumentKey:forecast.underlyingInstrumentKey,
      featureEvidenceHash:forecast.evidenceHash,
      featureCutoffUtc:forecast.featureCutoffUtc,
      capturedAtUtc:forecast.capturedAtUtc
    });
    let vote;
    try{vote=await modelAgent.predict(context);}
    catch(_){return wait(market,at,'MODEL_AGENT_UNAVAILABLE');}
    if(!validateModelVote(vote,forecast))
      return wait(market,at,'MODEL_EVIDENCE_NOT_QUALIFIED');
    if(vote.direction!==forecast.direction)
      return wait(market,at,'TECHNICAL_MODEL_DISAGREEMENT');

    let newsDecision='NOT_CONFIGURED';
    if(newsRiskAgent){
      let news;
      try{news=await newsRiskAgent.review(context);}
      catch(_){return wait(market,at,'NEWS_AGENT_UNAVAILABLE');}
      if(!validateNewsRisk(news,forecast))
        return wait(market,at,'NEWS_EVIDENCE_NOT_QUALIFIED');
      if(news.decision==='BLOCK')
        return wait(market,at,'NEWS_RISK_VETO');
      newsDecision='CLEAR';
    }

    const researchId=hash(['hybrid-direction-v1',forecast.id,
      vote.modelVersion,vote.direction,newsDecision].join('|'));
    return Object.freeze({
      schemaVersion:1,kind:'HYBRID_DIRECTIONAL_RESEARCH',market,
      evaluatedAtUtc:iso(at),state:'PROVISIONAL_DIRECTION',
      direction:forecast.direction,
      researchId,sourceForecastId:forecast.id,
      strategy:'TECHNICAL_ML_CONSENSUS_V1',
      modelVersion:vote.modelVersion,newsDecision,
      referencePrice:forecast.referencePrice,
      sourceQuoteAtUtc:forecast.sourceQuoteAtUtc,
      featureCutoffUtc:forecast.featureCutoffUtc,
      horizonEndUtc:forecast.horizonEndUtc,
      // Neither broker fills nor calibrated probability are established.
      probability:null,tradeEntry:null,contract:null,
      reasonCodes:Object.freeze(['VERIFIED_TECHNICAL_MODEL_CONSENSUS']),
      evidence:Object.freeze({technicalHash:forecast.evidenceHash,
        modelOutOfSampleValidated:true}),
      recordedDurably:false,...HYBRID_AGENT_SAFETY
    });
  }
  return Object.freeze({tick});
}
