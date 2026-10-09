// Paper-only 30-minute *direction* audit. Snapshots are frozen before outcomes.
import {analyzeIntradayCandles} from './intradayTechnicalEngine.js';
import {buildIndexPredictionReview} from './indexPredictionReview.js';
// No external training, no orders, no fake fills, no automatic strategy changes.
export const DEMO_VERSION='INDEX_DEMO_2026_10_V1';
export const DEMO_SYMBOLS=Object.freeze(['NIFTY','BANKNIFTY','SENSEX']);
export const DEMO_SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false,autoStrategyUpdates:false});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>finite(n)&&n>0;
const istDay=n=>new Date(n+330*60000).toISOString().slice(0,10);
const HORIZON_MS=30*60*1000;
const unique=xs=>[...new Set(xs.filter(Boolean))];
export function createDemoObservation({symbol,asOf,underlyingKey=null,session=null,
 research=null,quote=null,signal=null,contract=null,plan=null,openingRange=null,diagnostics=[]}={}){
 const now=Number(new Date(asOf));
 if(!DEMO_SYMBOLS.includes(symbol)||!finite(now))throw Error('INVALID_DEMO_OBSERVATION');
 const s=research?.valid?research.snapshot:null;
 const openingValid=openingRange?.valid===true&&openingRange?.strategy==='OPENING_RANGE_15M';
 const openingOHLC=openingValid?openingRange.openingOHLC:null;
 const rawDirection=['CE','PE'].includes(signal?.direction)?signal.direction:'WAIT';
 const reasons=unique([...(Array.isArray(signal?.reasons)?signal.reasons:[]),
  ...(Array.isArray(plan?.reasons)?plan.reasons:[]),...diagnostics]);
 const validPrice=positive(quote?.lastPrice)&&finite(quote?.timestamp)&&
  quote.timestamp<=now+10000&&now-quote.timestamp<=120000;
 const direction=rawDirection!=='WAIT'&&(s||openingValid)&&validPrice?rawDirection:'WAIT';
 const lastCompletedAt=s?.lastCompletedAt??openingRange?.lastCompletedAt??research?.latestCompletedAt??null;
 const barMs=Date.parse(lastCompletedAt);
 const key=finite(barMs)?String(barMs):String(Math.floor(now/300000)*300000);
 const study={version:DEMO_VERSION,id:istDay(now)+'/'+symbol+'/'+key,
  dateIST:istDay(now),symbol,recordedAt:new Date(now).toISOString(),
  underlyingKey:typeof underlyingKey==='string'?underlyingKey:null,
  sessionOpen:session?.open===true,
  researchValid:research?.valid===true,completedBars:research?.completedBars??null,
  predictionType:openingValid&&!s?'EARLY_OPENING_RANGE_15M':'FULL_5M_TECHNICAL',
  openingOHLC,openingRangePoints:openingValid?openingRange.range:null,
  openingRangeHigh:openingValid?openingRange.openingRangeHigh:null,
  openingRangeLow:openingValid?openingRange.openingRangeLow:null,
  openingBreakoutByQuote:openingValid?openingRange.breakoutConfirmedByQuote:null,
  openingEvidence:openingValid?openingRange.evidence:[],
  lastCompletedAt:finite(barMs)?new Date(barMs).toISOString():null,
  underlyingClose:positive(s?.close)?s.close:null,
  indexQuote:validPrice?quote.lastPrice:null,quoteTimestamp:validPrice?quote.timestamp:null,
  ema9:s?.ema9??null,ema21:s?.ema21??null,
  rsi14:s?.rsi14??null,macdHistogram:s?.macdHistogram??null,
  atr14:s?.atr14??null,vwap:s?.vwap??null,
  direction,optionContract:contract?.tradingSymbol??null,
  optionInstrumentKey:contract?.instrumentKey??null,optionStrike:contract?.strike??null,
  optionExpiry:contract?.expiry??null,optionLotSize:contract?.lotSize??null,
  optionBuyEntry:plan?.entry??null,optionStop:plan?.stopLoss??null,
  optionTarget1:plan?.target1??null,optionTarget2:plan?.target2??null,
  optionTarget3:plan?.target3??null,
  theoreticalLots:plan?.paperEnvelopeLots??null,approvedRealLots:0,
  status:direction==='WAIT'?'WAIT':'PENDING_30M_DIRECTION',
  reasons:unique([...(direction==='WAIT'&&rawDirection!=='WAIT'?['FRESH_EVIDENCE_REQUIRED']:[]),...reasons]),
  outcome:null,review:null,learningNotes:[],fundamentalContext:null,...DEMO_SAFETY};
 return Object.freeze(study);
}
export function evaluateDemoObservations(records=[],symbol='',completedCandles=[],asOf=Date.now()){
 const now=Number(new Date(asOf));
 if(!DEMO_SYMBOLS.includes(symbol)||!finite(now))return records;
 const bars=(Array.isArray(completedCandles)?completedCandles:[]).map(c=>({
  ...c,at:Date.parse(c.datetime)
 })).filter(c=>finite(c.at)&&positive(c.close)&&c.at+5*60000+10000<=now).sort((a,b)=>a.at-b.at);
 return records.map(record=>{
  if(record.symbol!==symbol||record.status!=='PENDING_30M_DIRECTION'||!positive(record.indexQuote)||
     !(record.predictionType==='EARLY_OPENING_RANGE_15M'?positive(record.openingRangePoints):positive(record.atr14))||
     !['CE','PE'].includes(record.direction)||
     !finite(Date.parse(record.recordedAt)))return record;
  // Measure the horizon from the recorded prediction, never from an earlier candle.
  const horizon=Date.parse(record.recordedAt)+HORIZON_MS;
  const target=bars.find(b=>b.at>=horizon&&b.at<horizon+10*60000&&
   istDay(b.at)===record.dateIST);
  if(!target)return record;
  const movement=(record.direction==='CE'?1:-1)*(target.close-record.indexQuote);
  const fluctuation=record.predictionType==='EARLY_OPENING_RANGE_15M'?record.openingRangePoints:record.atr14;
  const threshold=Math.max(fluctuation*0.25,record.indexQuote*0.0005);
  const verdict=movement>threshold?'CORRECT_DIRECTION':
   movement< -threshold?'WRONG_DIRECTION':'INCONCLUSIVE_NOISE';
  const notes=verdict==='WRONG_DIRECTION'?
   ['Index price moved against the recorded '+record.direction+' hypothesis over 30 minutes.',
    'Review opening volatility, trend confirmation, option liquidity and market-regime drift before proposing a rule change.']:
   verdict==='CORRECT_DIRECTION'?
    ['Index moved in the forecast direction; this does NOT prove an option trade would have profited.']:
    ['Move was within the volatility/noise threshold; classify as inconclusive, not a win.'];
  if(!positive(record.optionBuyEntry))notes.push('Option premium entry was not verified; do not infer option P&L.');
  const atOutcome=target.at+5*60000+10000;
  const historic=bars.filter(b=>b.at<=target.at&&istDay(b.at)===record.dateIST);
  const result=analyzeIntradayCandles(historic,{asOf:atOutcome,intervalMinutes:5,session:{open:true,exchange:'NSE'}});
  const after=result.valid?result.snapshot:null;
  const outcomeRecord={...record,status:'EVALUATED_30M_DIRECTION',
   outcome:{verdict,settledAt:new Date(now).toISOString(),horizonMinutes:30,
    observedCandleAt:new Date(target.at).toISOString(),observedClose:target.close,
    signedDirectionalMove:Number(movement.toFixed(3)),noiseThreshold:Number(threshold.toFixed(3)),
    realizedPaperOptionPnL:null,marketExecutionVerified:false},
   learningNotes:notes,approvedRealLots:0,orderSubmissionAllowed:false};
  const review=buildIndexPredictionReview({prediction:outcomeRecord,postTechnical:after,
   fundamentalContext:record.fundamentalContext});
  return {...outcomeRecord,review,
   learningNotes:[...notes,...(review?.improvementCandidates||[])],
   approvedRealLots:0,orderSubmissionAllowed:false};
 });
}
export function mergeDemoObservation(records=[],observation,maxRecords=1000){
 if(!observation||!DEMO_SYMBOLS.includes(observation.symbol))return records;
 const index=records.findIndex(x=>x.id===observation.id);
 if(index>=0)return records; // immutable snapshot: never overwrite evidence.
 return [...records,observation].slice(-maxRecords);
}
export function demoSummary(records=[]){
 const items=Array.isArray(records)?records:[];
 const valid=items.filter(r=>DEMO_SYMBOLS.includes(r.symbol));
 const result={total:valid.length,wait:0,predictions:0,pending:0,correct:0,wrong:0,inconclusive:0,
  bySymbol:{},blockers:{},proposals:[],...DEMO_SAFETY};
 for(const s of DEMO_SYMBOLS)result.bySymbol[s]={wait:0,predictions:0,correct:0,wrong:0,pending:0,inconclusive:0};
 for(const r of valid){
  const t=result.bySymbol[r.symbol];
  if(r.direction==='WAIT'){
   result.wait++;t.wait++;
   for(const reason of r.reasons||[])result.blockers[reason]=(result.blockers[reason]||0)+1;
  }else{
   result.predictions++;t.predictions++;
   if(r.status==='PENDING_30M_DIRECTION'){result.pending++;t.pending++;}
   if(r.outcome?.verdict==='CORRECT_DIRECTION'){result.correct++;t.correct++;}
   if(r.outcome?.verdict==='WRONG_DIRECTION'){result.wrong++;t.wrong++;}
   if(r.outcome?.verdict==='INCONCLUSIVE_NOISE'){result.inconclusive++;t.inconclusive++;}
  }
 }
 const ranked=Object.entries(result.blockers).sort((a,b)=>b[1]-a[1]).slice(0,3);
 for(const [reason,count] of ranked)result.proposals.push('Investigate recurring '+reason+' ('+count+' WAIT snapshots) before modifying the strategy.');
 if(result.wrong)result.proposals.push('Review '+result.wrong+' incorrect 30-minute directional forecasts against frozen EMA/RSI/MACD snapshots; test any new rule on separate future sessions.');
 if(!result.wrong&&!result.correct)result.proposals.push('Collect more labeled outcomes; a model performance claim is not yet possible.');
 return result;
}
export function demoCsv(records=[]){
 const fields=['dateIST','symbol','recordedAt','status','direction','predictionType','openingOHLC.open','openingOHLC.high',
  'openingOHLC.low','openingOHLC.close','openingRangePoints','openingBreakoutByQuote',
  'underlyingClose','indexQuote','ema9','ema21','rsi14','macdHistogram','atr14',
  'optionContract','optionStrike','optionExpiry','optionBuyEntry','optionStop','optionTarget1','optionTarget2','optionTarget3','theoreticalLots','approvedRealLots',
  'outcome.verdict','outcome.observedClose','outcome.signedDirectionalMove','review.summary','review.technical.status',
  'review.technical.conclusion','review.fundamental.status','review.improvementCandidates','reasons'];
 const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const value=(r,k)=>{
  if(k==='reasons')return (r.reasons||[]).join('; ');
  if(k==='review.improvementCandidates')return (r.review?.improvementCandidates||[]).join('; ');
  return k.split('.').reduce((v,part)=>v?.[part],r);
 };
 return [fields.join(','),...records.map(r=>fields.map(k=>escape(value(r,k))).join(','))].join('\r\n');
}
