// Evidence-driven post-prediction review: frozen prediction FIRST, delayed actual outcome SECOND.
// This is a deterministic diagnostic engine, not ML training and not trade authorization.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const dir=x=>x==='CE'?1:x==='PE'?-1:0;
const text=n=>finite(n)?String(Number(n.toFixed(3))):'not verified';
const comparison=(record,post,key,format='number')=>{
 const before=record?.[key],after=post?.[key];
 return {indicator:key,atPrediction:finite(before)?before:null,atOutcome:finite(after)?after:null,
  changed:finite(before)&&finite(after)&&before!==after,verified:finite(before)&&finite(after)};
};
function evidenceAt(record,post){
 const direction=dir(record.direction);
 const before={
  ema:finite(record.ema9)&&finite(record.ema21)?
   Math.sign(record.ema9-record.ema21):null,
  macd:finite(record.macdHistogram)?Math.sign(record.macdHistogram):null,
  rsi:finite(record.rsi14)?record.rsi14:null,
  vwap:finite(record.vwap)&&finite(record.underlyingClose)?
   Math.sign(record.underlyingClose-record.vwap):null
 };
 const after={
  ema:finite(post?.ema9)&&finite(post?.ema21)?Math.sign(post.ema9-post.ema21):null,
  macd:finite(post?.macdHistogram)?Math.sign(post.macdHistogram):null,
  rsi:finite(post?.rsi14)?post.rsi14:null,
  vwap:finite(post?.vwap)&&finite(post?.close)?Math.sign(post.close-post.vwap):null
 };
 const observations=[];
 if(before.ema!==null&&after.ema!==null)
  observations.push({
   test:'EMA9/EMA21 trend',start:before.ema===direction?'Aligned with prediction':'Not aligned',
   finish:after.ema===direction?'Still aligned':after.ema===-direction?'Reversed':'No EMA separation',
   reversed:before.ema===direction&&after.ema!==direction});
 if(before.macd!==null&&after.macd!==null)
  observations.push({
   test:'MACD histogram',start:before.macd===direction?'Aligned with prediction':'Not aligned',
   finish:after.macd===direction?'Still aligned':after.macd===-direction?'Momentum reversed':'Flat momentum',
   reversed:before.macd===direction&&after.macd!==direction});
 if(before.rsi!==null&&after.rsi!==null)
  observations.push({
   test:'RSI14',start:text(before.rsi),finish:text(after.rsi),
   reversed:direction===1?after.rsi<50:after.rsi>50});
 if(before.vwap!==null&&after.vwap!==null)
  observations.push({
   test:'VWAP position',start:before.vwap===direction?'Aligned':'Not aligned',
   finish:after.vwap===direction?'Still aligned':after.vwap===-direction?'Crossed against prediction':'At VWAP',
   reversed:before.vwap===direction&&after.vwap!==direction});
 return observations;
}
function verifyFundamentalContext(context,record){
 // No index earnings/macro/breadth context currently supplied by Upstox index snapshots.
 // Strictly reject unverified or post-prediction context as proof of the original forecast.
 if(!context?.verified||typeof context.sourceUrl!=='string'||!/^https:\/\//.test(context.sourceUrl)||
  !Number.isFinite(Date.parse(context.observedAt))||Date.parse(context.observedAt)>Date.parse(record.recordedAt)||
  typeof context.summary!=='string'||!context.summary.trim())
  return {status:'NOT_VERIFIED',atPrediction:null,sourceUrl:null,
   limitation:'No dated, independently sourced index earnings, constituent breadth or macroeconomic evidence was frozen before prediction. Do not infer a fundamental cause from the outcome.'};
 return {status:'PRE_PREDICTION_EVIDENCE_PRESENT',
  atPrediction:context.summary.slice(0,400),sourceUrl:context.sourceUrl,observedAt:context.observedAt,
  limitation:'Source exists but does not establish that fundamentals caused the subsequent 30-minute price movement.'};
}
export function buildIndexPredictionReview({prediction=null,postTechnical=null,fundamentalContext=null}={}){
 const p=prediction,outcome=p?.outcome;
 if(!p||!['CE','PE'].includes(p.direction)||p.status!=='EVALUATED_30M_DIRECTION'||
   !['CORRECT_DIRECTION','WRONG_DIRECTION','INCONCLUSIVE_NOISE'].includes(outcome?.verdict))
  return null; // Never evaluate WAIT/pending or hallucinate a result.
 const technicalChecks=evidenceAt(p,postTechnical);
 const reversals=technicalChecks.filter(x=>x.reversed).map(x=>x.test);
 const availableFuture=!!postTechnical&&
  [postTechnical.ema9,postTechnical.ema21,postTechnical.rsi14,postTechnical.macdHistogram].every(finite);
 const verdict=outcome.verdict;
 const summary=verdict==='CORRECT_DIRECTION'?
  'The index moved in the forecast direction over the measured horizon. This validates the direction label only, not option premium returns or the strategy.':
  verdict==='WRONG_DIRECTION'?
  'The index moved opposite to the frozen forecast over the measured horizon. Diagnose technical changes and data quality; the exact cause is not established.':
  'The move was below the preregistered volatility/noise threshold. This is inconclusive, not a win or a loss.';
 const technicalConclusion=availableFuture?
  reversals.length?
   'Observed changes against the forecast: '+reversals.join(', ')+'. These are associated diagnostics, not proven causes.':
   'No tested trend/momentum reversal was detected at the measured horizon; inspect market regime and other evidence rather than assuming a cause.':
  'Outcome-time technical indicators could not be reconstructed from sufficient timestamped OHLCV; do not invent a crossover or RSI value.';
 const fundamental=verifyFundamentalContext(fundamentalContext,p);
 const suggestions=verdict==='WRONG_DIRECTION'?[
  'Check the timing of the original signal against the first contrary completed 5-minute candle.',
  'Review whether EMA, MACD or RSI shifted against the hypothesis by the evaluated horizon.',
  'Compare recurring wrong forecasts by index, session time and volatility on a held-out sample.'
 ]:verdict==='CORRECT_DIRECTION'?[
  'Check whether trend and momentum remained aligned, not just whether the final price moved in the chosen direction.',
  'Collect a larger out-of-sample sample before attributing success to a particular indicator.'
 ]:[
  'Evaluate whether the predefined noise threshold is appropriate using independent historical data.',
  'Do not count this observation in directional wins or losses.'
 ];
 suggestions.push('Collect timestamped, sourced fundamental/macro evidence before future predictions; never retrofit it after the outcome.');
 if(!finite(p.optionBuyEntry)||!finite(p.optionStop)||!finite(p.optionTarget1))
  suggestions.push('Option entry, stop or targets lacked verified premium data; option target achievement cannot be assessed.');
 return {
  version:'INDEX_PREDICTION_REVIEW_V1',predictionId:p.id,analysisOrder:'FROZEN_PREDICTION_THEN_FUTURE_OUTCOME',
  reviewStatus:'POST_OUTCOME_EVIDENCE_REVIEW',
  verdict,summary,
  prediction:{direction:p.direction,recordedAt:p.recordedAt,price:p.indexQuote,
   ema9:p.ema9??null,ema21:p.ema21??null,rsi14:p.rsi14??null,
   macdHistogram:p.macdHistogram??null,vwap:p.vwap??null,atr14:p.atr14??null},
  observed:{asOf:outcome.observedCandleAt,close:outcome.observedClose,
   directionalMove:outcome.signedDirectionalMove,noiseThreshold:outcome.noiseThreshold},
  technical:{status:availableFuture?'PREDICTION_VS_OUTCOME_VERIFIED':'OUTCOME_INDICATORS_NOT_VERIFIED',
   checks:technicalChecks,conclusion:technicalConclusion,postIndicators:availableFuture?{
    ema9:postTechnical.ema9,ema21:postTechnical.ema21,rsi14:postTechnical.rsi14,
    macdHistogram:postTechnical.macdHistogram,vwap:finite(postTechnical.vwap)?postTechnical.vwap:null}:null},
  fundamental,improvementCandidates:suggestions,backtested:false,automaticallyTrained:false,
  actualOptionPnLVerified:false,optionTargetHitVerified:false,
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false
 };
}
