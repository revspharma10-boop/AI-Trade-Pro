// AI Trade Pro 2.0 Phase 1: OFFLINE paper-only market-replay scheduler.
// Not wired into the deployed API or public web app. All provider, exchange
// calendar and local ledger dependencies MUST be supplied by the caller.
// Only verified completed bars and non-future quote timestamps are eligible.
import {createHash} from 'node:crypto';
import {deriveOpeningRangeBias} from '../src/services/openingRangeResearch.js';
import {marketClockState} from '../src/services/intradayMarketClock.js';

export const PHASE1_SHADOW_SAFETY=Object.freeze({
 paperOnly:true,realOrderPlaced:false,orderSubmissionAllowed:false,
 productionRealTradingEnabled:false,optionPlanQualified:false
});
export const PHASE1_MARKETS=Object.freeze({
 nifty:Object.freeze({exchange:'NSE',segment:'NSE_INDEX',keyPrefix:'NSE_INDEX|'}),
 sensex:Object.freeze({exchange:'BSE',segment:'BSE_INDEX',keyPrefix:'BSE_INDEX|'})
});
const FIVE=5*60*1000,GRACE=12000,MAX_DELAY=90000,IST_OFFSET=330*60000;
const sha256=str=>createHash('sha256').update(str).digest('hex');
const iso=ms=>new Date(ms).toISOString();
const dateIST=ms=>iso(ms+IST_OFFSET).slice(0,10);
const minuteIST=ms=>{
 const d=new Date(ms+IST_OFFSET);
 return d.getUTCHours()*60+d.getUTCMinutes();
};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>finite(n)&&n>0;
const reasonSet=xs=>[...new Set(xs.filter(x=>typeof x==='string'&&
 /^[A-Z0-9_]{3,100}$/.test(x)))].slice(0,12);
const codeFromError=_e=>'PROVIDER_DATA_UNAVAILABLE'; // Never expose broker tokens/error bodies.
const validBar=c=>c&&Number.isFinite(Date.parse(c.datetime))&&
 [c.open,c.high,c.low,c.close,c.volume].every(finite)&&c.volume>=0&&
 c.low>0&&c.high>=c.low&&c.open>=c.low&&c.open<=c.high&&
 c.close>=c.low&&c.close<=c.high;
const emptyForecast=(base,reason)=>({
 ...base,status:'ABSTAIN',direction:'ABSTAIN',referencePrice:null,
 underlyingInstrumentKey:null,sourceQuoteAtUtc:null,evidenceHash:null,dataQuality:'MISSING',
 reasonCodes:reasonSet([reason])
});

export function eligibleShadowDecision({market,asOf=Date.now(),calendar}={}){
 const spec=PHASE1_MARKETS[market];
 const now=Number(new Date(asOf));
 if(!spec)throw Error('UNSUPPORTED_PHASE1_MARKET');
 if(!finite(now))throw Error('INVALID_PHASE1_CLOCK');
 // The 12s grace guarantees bars ending at the decision boundary have closed.
 const candleEnd=Math.floor((now-GRACE)/FIVE)*FIVE;
 const lag=now-candleEnd;
 if(lag<GRACE||lag>MAX_DELAY)return {eligible:false,reason:'DECISION_WINDOW_MISSED'};
 const mins=minuteIST(candleEnd);
 if(mins<570||mins>=915)return {eligible:false,reason:'OUTSIDE_PHASE1_EQUITY_FORECAST_WINDOW'};
 const clock=marketClockState({segment:spec.segment,asOf:now});
 if(!clock.open)return {eligible:false,reason:'EXCHANGE_CLOCK_CLOSED'};
 const d=dateIST(now);
 const official=typeof calendar?.getSession==='function'?
  calendar.getSession({market,exchange:spec.exchange,date:d}):null;
 if(!official||official.verified!==true||official.market!==market||
    official.exchange!==spec.exchange||official.date!==d||
    official.closed!==false||official.openMinuteIST!==555||
    !(Number.isInteger(official.closeMinuteIST)&&
      official.closeMinuteIST>=600&&official.closeMinuteIST<=930)||
    !official.sourceId||typeof official.sourceId!=='string'||
    !/^[A-Z0-9_-]{5,90}$/.test(official.sourceId)||
    mins>=official.closeMinuteIST-15)
   return {eligible:false,reason:'EXCHANGE_SESSION_CALENDAR_UNVERIFIED'};
 return {eligible:true,market,spec,candleEnd,asOf:now,
  session:clock,sourceId:official.sourceId};
}

export function createPhase1ShadowPipeline({
 ledger,marketData,calendar,strategyVersion='or15-shadow-v1'
}={}){
 if(!ledger||typeof ledger.append!=='function'||typeof ledger.get!=='function'||
    typeof ledger.list!=='function'||typeof marketData?.getSnapshot!=='function'||
    typeof marketData?.getSettlementCandle!=='function'||
    typeof calendar?.getSession!=='function'||
    !/^or15-shadow-v[0-9]+$/.test(strategyVersion))
  throw Error('PHASE1_SHADOW_DEPENDENCIES_REQUIRED');

 async function tick({market,asOf=Date.now()}={}){
  const state=eligibleShadowDecision({market,asOf,calendar});
  if(!state.eligible)return {recorded:false,status:'SKIPPED',reason:state.reason};
  const {spec,candleEnd}=state,now=state.asOf;
  const id=sha256(['forecast',market,strategyVersion,iso(candleEnd)].join('|'));
  const prior=ledger.get(id);
  if(prior)return {recorded:false,status:'DUPLICATE',event:prior};
  const base={
   schemaVersion:1,kind:'DIRECTIONAL_FORECAST',id,market,exchange:spec.exchange,
   strategyVersion,forecastCandleEndUtc:iso(candleEnd),capturedAtUtc:iso(now),
   horizonEndUtc:iso(candleEnd+FIVE),featureCutoffUtc:iso(now),
   paperOnly:true,realOrderPlaced:false,orderSubmissionAllowed:false
  };
  let event;
  try{
   const snapshot=await marketData.getSnapshot({market,exchange:spec.exchange,
    asOf:now,forecastCandleEndUtc:iso(candleEnd)});
   const key=snapshot?.instrumentKey,quote=snapshot?.quote;
   if(snapshot?.market!==market||snapshot?.exchange!==spec.exchange||
      typeof key!=='string'||!key.startsWith(spec.keyPrefix)||
      typeof quote?.instrumentKey!=='string'||quote.instrumentKey!==key||
      quote.verified!==true||!positive(quote.lastPrice)||!finite(quote.timestamp)||
      quote.timestamp>now||now-quote.timestamp>120000)
    event=emptyForecast(base,'SOURCE_INSTRUMENT_OR_QUOTE_UNVERIFIED');
   else{
    const raw=Array.isArray(snapshot?.candles)?snapshot.candles:[];
    // Never evaluate candles whose close+freshness allowance occurs later.
    // Reject duplicates: no "one good bar" masking a conflicting bar.
    const usable=raw.filter(c=>{
      const at=Date.parse(c?.datetime);
      return finite(at)&&dateIST(at)===dateIST(now)&&
       at+FIVE+GRACE<=now&&at+FIVE<=candleEnd;
    });
    if(usable.some(c=>!validBar(c))||
       new Set(usable.map(c=>Date.parse(c.datetime))).size!==usable.length)
     event=emptyForecast(base,'OHLCV_OR_DUPLICATE_CANDLE_INVALID');
    else{
     const ordered=[...usable].sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
     const analysis=deriveOpeningRangeBias({
      candles:ordered,quote:{lastPrice:quote.lastPrice,timestamp:quote.timestamp},
      session:state.session,asOf:now
     });
     if(!analysis.valid){
      event=emptyForecast(base,reasonSet(analysis.reasons).at(0)||
       'OPENING_RANGE_EVIDENCE_INCOMPLETE');
     }else{
      const direction=analysis.direction==='CE'?'BULLISH':
       analysis.direction==='PE'?'BEARISH':'ABSTAIN';
      const featurePayload={
       strategyVersion,market,forecastCandleEndUtc:base.forecastCandleEndUtc,
       candles:ordered.map(c=>[c.datetime,c.open,c.high,c.low,c.close,c.volume]),
       quote:[quote.lastPrice,quote.timestamp]
      };
      event={...base,
       underlyingInstrumentKey:key,
       status:direction==='ABSTAIN'?'ABSTAIN':'PROVISIONAL_DIRECTION',
       direction,referencePrice:quote.lastPrice,
       sourceQuoteAtUtc:iso(quote.timestamp),
       evidenceHash:sha256(JSON.stringify(featurePayload)),
       dataQuality:'VERIFIED',
       reasonCodes:direction==='ABSTAIN'?
        reasonSet(analysis.reasons.length?analysis.reasons:['NO_CLEAR_DIRECTION']):
        reasonSet([analysis.signalBasis??'OPENING_RANGE_PROVISIONAL_BIAS'])
      };
     }
    }
   }
  }catch(e){event=emptyForecast(base,codeFromError(e));}
  // append() enforces uniqueness and freezes the first committed event.
  const result=await ledger.append(event);
  return {recorded:result.created,status:result.created?'RECORDED':'DUPLICATE',
   event:result.event};
 }

 async function evaluate({forecastId,asOf=Date.now()}={}){
  const now=Number(new Date(asOf));
  if(!finite(now))throw Error('INVALID_PHASE1_CLOCK');
  const forecast=ledger.get(forecastId);
  if(!forecast||forecast.kind!=='DIRECTIONAL_FORECAST')
   throw Error('PHASE1_FORECAST_NOT_FOUND');
  if(forecast.status!=='PROVISIONAL_DIRECTION')
   return {recorded:false,status:'ABSTENTION_NOT_SCORED'};
  const id=sha256('outcome|'+forecast.id);
  const existing=ledger.get(id);
  if(existing)return {recorded:false,status:'DUPLICATE',event:existing};
  const end=Date.parse(forecast.horizonEndUtc);
  if(now<end+GRACE)return {recorded:false,status:'OUTCOME_NOT_DUE'};
  // Settlement is the close of the single predetermined 5-minute candle.
  const expectedOpen=end-FIVE;
  let observed=null,failReason='OUTCOME_PRICE_NOT_VERIFIED';
  try{
   const response=await marketData.getSettlementCandle({
    market:forecast.market,exchange:forecast.exchange,
    candleStartUtc:iso(expectedOpen),candleEndUtc:forecast.horizonEndUtc,asOf:now
   });
   const candle=response?.candle;
   if(response?.verified===true&&response.market===forecast.market&&
      response.exchange===forecast.exchange&&
      response.instrumentKey===forecast.underlyingInstrumentKey&&validBar(candle)&&
      Date.parse(candle.datetime)===expectedOpen&&
      Date.parse(candle.datetime)+FIVE+GRACE<=now)
    observed={close:candle.close};
   else failReason='SETTLEMENT_CANDLE_OR_SOURCE_UNVERIFIED';
  }catch(_e){failReason='SETTLEMENT_PROVIDER_UNAVAILABLE';}
  // Do not mark a missing response a loss; wait for a bounded delay then
  // record UNEVALUABLE (and never backfill with hindsight after the fact).
  if(!observed&&now<end+180000)
   return {recorded:false,status:'OUTCOME_AWAITING_VERIFIED_CANDLE'};
  const referencePrice=forecast.referencePrice;
  const changeBps=observed?Number((
    10000*(observed.close-referencePrice)/referencePrice).toFixed(4)):null;
  const directionSign=forecast.direction==='BULLISH'?1:-1;
  const outcome=!observed?'UNEVALUABLE':
   Math.abs(changeBps)<=2?'INCONCLUSIVE':
   changeBps*directionSign>0?'CORRECT':'INCORRECT';
  const event={
   schemaVersion:1,kind:'DIRECTIONAL_OUTCOME',id,
   forecastId:forecast.id,market:forecast.market,exchange:forecast.exchange,
   forecastCandleEndUtc:forecast.forecastCandleEndUtc,
   underlyingInstrumentKey:forecast.underlyingInstrumentKey,
   horizonEndUtc:forecast.horizonEndUtc,
   capturedAtUtc:iso(now),
   observedCloseAtUtc:observed?forecast.horizonEndUtc:null,
   outcome,referencePrice,observedClose:observed?.close??null,changeBps,
   reasonCode:observed?'HORIZON_5M_VERIFIED_CANDLE':failReason,
   paperOnly:true,realOrderPlaced:false,orderSubmissionAllowed:false
  };
  const result=await ledger.append(event);
  return {recorded:result.created,status:result.created?'RECORDED':'DUPLICATE',
   event:result.event};
 }

 return {tick,evaluate,
  listForecasts:()=>ledger.list('DIRECTIONAL_FORECAST'),
  listOutcomes:()=>ledger.list('DIRECTIONAL_OUTCOME'),
  safety:PHASE1_SHADOW_SAFETY};
}
