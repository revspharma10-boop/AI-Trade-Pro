// AI Trade Pro 2.0 Phase 1B — free-tier SHADOW paper research, not a trading bot.
// No orders, no private portfolio, no paid APIs. Cloudflare Worker + D1.
// Prepared for deployment; nothing is activated merely by merging this file.
import {deriveOpeningRangeBias} from '../../../src/services/openingRangeResearch.js';
import {marketClockState} from '../../../src/services/intradayMarketClock.js';

const FIVE=300000,GRACE=12000,MAX_LAG=90000,IST=330*60000;
const MARKET=Object.freeze({
 nifty:{exchange:'NSE',segment:'NSE_INDEX',env:'NIFTY_INDEX_KEY'},
 sensex:{exchange:'BSE',segment:'BSE_INDEX',env:'SENSEX_INDEX_KEY'}
});
const SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,
 realOrderPlaced:false,productionRealTradingEnabled:false,optionPlanQualified:false});
const iso=n=>new Date(n).toISOString();
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>valid(n)&&n>0;
const day=ms=>iso(ms+IST).slice(0,10);
const minutes=ms=>{const x=new Date(ms+IST);return x.getUTCHours()*60+x.getUTCMinutes();};
const time=value=>{
 if(typeof value==='number')return value;
 if(typeof value==='string'&&/^\d{13}$/.test(value))return Number(value);
 return typeof value==='string'?Date.parse(value):NaN;
};
const dateBar=a=>Array.isArray(a)?{
 datetime:String(a[0]??''),open:Number(a[1]),high:Number(a[2]),
 low:Number(a[3]),close:Number(a[4]),volume:Number(a[5])
}:null;
const validCandle=c=>c&&valid(Date.parse(c.datetime))&&
 [c.open,c.high,c.low,c.close,c.volume].every(valid)&&c.low>0&&
 c.volume>=0&&c.high>=c.low&&c.open>=c.low&&c.open<=c.high&&
 c.close>=c.low&&c.close<=c.high;
const cleanCode=code=>typeof code==='string'&&/^[A-Z0-9_]{3,90}$/.test(code)?
 code:'DATA_NOT_VERIFIED';
const safeHeaders=origin=>({
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 ...(origin==='https://revspharma10-boop.github.io'?
  {'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})
});
const respond=(obj,status=200,origin='')=>new Response(JSON.stringify(obj),{
 status,headers:safeHeaders(origin)
});
export async function digest(value){
 const bytes=new TextEncoder().encode(value);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function dueSlot({market,now,official}={}){
 const spec=MARKET[market];
 if(!spec||!valid(now))return {eligible:false,reason:'MARKET_OR_CLOCK_UNSUPPORTED'};
 const session=marketClockState({segment:spec.segment,asOf:now});
 if(!session.open)return {eligible:false,reason:'EXCHANGE_CLOCK_CLOSED'};
 const candleEnd=Math.floor((now-GRACE)/FIVE)*FIVE,lag=now-candleEnd;
 if(lag<GRACE||lag>MAX_LAG)return {eligible:false,reason:'DECISION_WINDOW_MISSED'};
 const ending=minutes(candleEnd);
 if(ending<570||ending>=915)return {eligible:false,reason:'OUTSIDE_FORECAST_WINDOW'};
 if(!official||official.market!==market||official.exchange!==spec.exchange||
    official.session_date!==day(now)||official.verified!==1||
    official.closed!==0||official.open_minute_ist!==555||
    !Number.isInteger(official.close_minute_ist)||
    official.close_minute_ist<600||official.close_minute_ist>930||
    typeof official.source_id!=='string'||!/^[A-Z0-9_-]{5,90}$/.test(official.source_id)||
    ending>=official.close_minute_ist-15)
  return {eligible:false,reason:'EXCHANGE_CALENDAR_UNVERIFIED'};
 return {eligible:true,spec,session,candleEnd,capturedAt:now,
  horizonEnd:candleEnd+FIVE};
}
export function directionFromSnapshot({snapshot,slot,now,market}={}){
 const spec=MARKET[market];
 const fail=reason=>({direction:'ABSTAIN',referencePrice:null,
  sourceQuoteUtc:null,instrumentKey:null,evidence:null,reason:cleanCode(reason)});
 if(!spec||!slot?.eligible||!snapshot||snapshot.market!==market||
    snapshot.exchange!==spec.exchange)return fail('INSTRUMENT_NOT_VERIFIED');
 const key=snapshot.instrumentKey,quote=snapshot.quote;
 if(typeof key!=='string'||!key.startsWith(spec.segment+'|')||
    quote?.instrumentKey!==key||quote?.verified!==true||
    !positive(quote.lastPrice)||!valid(quote.timestamp)||
    quote.timestamp>now||now-quote.timestamp>120000)
  return fail('QUOTE_MISSING_OR_STALE');
 const raw=snapshot.candles;
 if(!Array.isArray(raw)||raw.length>120)return fail('CANDLE_SOURCE_INVALID');
 const selected=raw.filter(c=>{
  const t=Date.parse(c?.datetime);
  return valid(t)&&day(t)===day(now)&&t+FIVE+GRACE<=now&&t+FIVE<=slot.candleEnd;
 });
 if(selected.some(c=>!validCandle(c))||
   new Set(selected.map(c=>Date.parse(c.datetime))).size!==selected.length)
  return fail('CANDLE_INVALID_OR_DUPLICATE');
 selected.sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
 const result=deriveOpeningRangeBias({candles:selected,
  quote:{lastPrice:quote.lastPrice,timestamp:quote.timestamp},
  session:slot.session,asOf:now});
 if(!result.valid)return fail(result.reasons?.[0]||'OPENING_EVIDENCE_MISSING');
 const direction=result.direction==='CE'?'BULLISH':
  result.direction==='PE'?'BEARISH':'ABSTAIN';
 return {direction,referencePrice:quote.lastPrice,instrumentKey:key,
  sourceQuoteUtc:iso(quote.timestamp),
  // Only source measurements and a versioned strategy ID are hashed, never
  // OAuth credentials or personal account information.
  evidence:JSON.stringify({market,candleEnd:iso(slot.candleEnd),
   strategy:'or15-shadow-v1',
   bars:selected.map(x=>[x.datetime,x.open,x.high,x.low,x.close,x.volume]),
   quote:[quote.lastPrice,quote.timestamp]}),
  reason:direction==='ABSTAIN'?'NO_CONFIRMED_DIRECTION':
   cleanCode(result.signalBasis)};
}

export async function brokerSnapshot({market,spec,env,now,fetchFn=fetch}){
 const key=String(env[spec.env]??''),token=String(env.UPSTOX_ANALYTICS_TOKEN??'');
 if(!new RegExp('^'+spec.segment.replace('_','_')+'\\|[A-Za-z0-9 _-]{1,75}$').test(key)||
   !token||token.length<16||token.length>8000)
  throw Error('BROKER_CONFIGURATION_MISSING');
 const candlesUrl='https://api.upstox.com/v3/historical-candle/intraday/'+
  encodeURIComponent(key)+'/minutes/5';
 const quoteUrl='https://api.upstox.com/v3/market-quote/quotes?instrument_key='+
  encodeURIComponent(key);
 const options={headers:{Accept:'application/json',Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(12000)};
 const [barResp,quoteResp]=await Promise.all([
  fetchFn(candlesUrl,options),fetchFn(quoteUrl,options)
 ]);
 if(!barResp.ok||!quoteResp.ok)throw Error('BROKER_SOURCE_UNAVAILABLE');
 const [bars,quotes]=await Promise.all([barResp.json(),quoteResp.json()]);
 const rawBars=bars?.data?.candles;
 if(!Array.isArray(rawBars)||rawBars.length>120)throw Error('BROKER_CANDLES_UNAVAILABLE');
 const match=Object.values(quotes?.data??{}).find(q=>q?.instrument_token===key);
 if(!match)throw Error('BROKER_INDEX_QUOTE_UNAVAILABLE');
 const lastPrice=Number(match.last_price),timestamp=time(match.timestamp);
 return {market,exchange:spec.exchange,instrumentKey:key,
  candles:rawBars.map(dateBar),quote:{
   instrumentKey:key,verified:true,lastPrice,timestamp
  }};
}
const marketRow=async(env,market,now)=>await env.DB.prepare(
 'SELECT market,exchange,session_date,verified,closed,open_minute_ist,'+
 'close_minute_ist,source_id FROM verified_sessions WHERE market=? AND session_date=?'
).bind(market,day(now)).first();
const getPending=async(env,market,now)=>await env.DB.prepare(
 'SELECT id,market,exchange,underlying_instrument_key,reference_price,'+
 'direction,horizon_end_utc FROM forecasts WHERE market=? AND direction IN'+
 " ('BULLISH','BEARISH') AND horizon_end_utc<=? AND "+
 'NOT EXISTS (SELECT 1 FROM outcomes o WHERE o.forecast_id=forecasts.id)'+
 ' ORDER BY horizon_end_utc ASC LIMIT 10'
).bind(market,iso(now-GRACE)).all();

export async function runFreeResearch({env,market,now=Date.now(),fetchFn=fetch}={}){
 if(!env?.DB)throw Error('D1_BINDING_REQUIRED');
 const official=await marketRow(env,market,now);
 const slot=dueSlot({market,now,official});
 if(!slot.eligible)return {status:'SKIP',reason:slot.reason};
 const id=await digest(['forecast',market,'or15-shadow-v1',iso(slot.candleEnd)].join('|'));
 const existing=await env.DB.prepare('SELECT id FROM forecasts WHERE id=?').bind(id).first();
 if(existing)return {status:'DUPLICATE',market};
 let snapshot=null,reason='PROVIDER_SOURCE_UNAVAILABLE';
 try{snapshot=await brokerSnapshot({market,spec:slot.spec,env,now,fetchFn});}
 catch(_e){reason='PROVIDER_SOURCE_UNAVAILABLE';}
 const result=snapshot?directionFromSnapshot({snapshot,slot,now,market}):
  {direction:'ABSTAIN',referencePrice:null,sourceQuoteUtc:null,
   instrumentKey:null,evidence:null,reason};
 const evidenceHash=result.evidence?await digest(result.evidence):null;
 const inserted=await env.DB.prepare(
  'INSERT OR IGNORE INTO forecasts (id,market,exchange,strategy_version,'+
  'candle_end_utc,captured_at_utc,horizon_end_utc,direction,underlying_instrument_key,'+
  'reference_price,source_quote_utc,evidence_hash,data_quality,reason_code,'+
  'paper_only,order_submission_allowed,real_order_placed) VALUES'+
  ' (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,0)'
 ).bind(id,market,slot.spec.exchange,'or15-shadow-v1',iso(slot.candleEnd),
  iso(now),iso(slot.horizonEnd),result.direction,result.instrumentKey,
  result.referencePrice,result.sourceQuoteUtc,evidenceHash,
  result.evidence?'VERIFIED':'MISSING',result.reason).run();
 return {status:inserted?.meta?.changes===1?'RECORDED':'DUPLICATE',market,
  direction:result.direction,reason:result.reason,paperOnly:true,
  orderSubmissionAllowed:false,realOrderPlaced:false};
}
export async function settlePending({env,market,now=Date.now(),fetchFn=fetch}={}){
 // Results are independent of new forecasts; missing settlement is NOT a loss.
 const pending=(await getPending(env,market,now))?.results??[];
 if(!pending.length)return {checked:0,recorded:0};
 const spec=MARKET[market];if(!spec)return {checked:0,recorded:0};
 let snapshot=null;
 try{snapshot=await brokerSnapshot({market,spec,env,now,fetchFn});}
 catch(_e){/* Do not invent market outcomes. */}
 let recorded=0;
 for(const row of pending){
  const horizon=Date.parse(row.horizon_end_utc),needed=horizon-FIVE;
  if(!valid(horizon)||horizon>now-GRACE)continue;
  const settlement=snapshot?.instrumentKey===row.underlying_instrument_key?
   snapshot.candles.find(c=>validCandle(c)&&Date.parse(c.datetime)===needed):null;
  // Wait up to three minutes; never score stale or mismatched data.
  if(!settlement&&now<horizon+180000)continue;
  const close=settlement?.close??null;
  const change=positive(close)&&positive(row.reference_price)?
   Number((10000*(close-row.reference_price)/row.reference_price).toFixed(4)):null;
  const outcome=change===null?'UNEVALUABLE':Math.abs(change)<=2?'INCONCLUSIVE':
   (row.direction==='BULLISH'?change>0:change<0)?'CORRECT':'INCORRECT';
  const id=await digest('outcome|'+row.id);
  const write=await env.DB.prepare(
   'INSERT OR IGNORE INTO outcomes (id,forecast_id,market,exchange,'+
   'evaluated_at_utc,horizon_end_utc,observed_close,change_bps,outcome,'+
   'paper_only,order_submission_allowed,real_order_placed) '+
   'VALUES (?,?,?,?,?,?,?,?,?,1,0,0)'
  ).bind(id,row.id,market,row.exchange,iso(now),row.horizon_end_utc,
   close,change,outcome).run();
  if(write?.meta?.changes===1)recorded++;
 }
 return {checked:pending.length,recorded};
}
export async function runCron({env,now=Date.now(),fetchFn=fetch}={}){
 // UTC minute cron runs, but only 09:31/09:36/... IST slots can qualify.
 // Some Cron invocations may arrive late; those slots fail closed.
 const results=[];
 for(const market of Object.keys(MARKET)){
  const recording=await runFreeResearch({env,market,now,fetchFn});
  let settlement={checked:0,recorded:0};
  if(recording.status!=='SKIP'){
   settlement=await settlePending({env,market,now,fetchFn});
  }
  results.push({market,recording,settlement});
 }
 return results;
}
export default {
 async scheduled(controller,env,ctx){
  ctx.waitUntil(runCron({env,now:Date.now()}).catch(
   ()=>console.error('PHASE1B_SCHEDULED_RESEARCH_FAILED')
  ));
 },
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('origin')??'';
  if(request.method!=='GET')return respond({error:'READ_ONLY_REQUIRED'},405,origin);
  if(url.pathname==='/health')return respond({
   service:'PHASE1B_SHADOW_ONLY',deployed:true,
   ...SAFETY
  },200,origin);
  if(url.pathname!=='/v1/public/latest')
   return respond({error:'NOT_FOUND'},404,origin);
  const market=url.searchParams.get('market');
  if(!Object.hasOwn(MARKET,market))return respond({error:'MARKET_NOT_SUPPORTED'},400,origin);
  if(!env?.DB)return respond({error:'RESEARCH_NOT_CONFIGURED'},503,origin);
  try{
   const latest=await env.DB.prepare(
    'SELECT f.id,f.market,f.direction,f.candle_end_utc,f.captured_at_utc,'+
    'f.horizon_end_utc,f.reference_price,f.data_quality,f.reason_code,'+
    'o.outcome,o.observed_close,o.change_bps FROM forecasts f '+
    'LEFT JOIN outcomes o ON o.forecast_id=f.id WHERE f.market=? '+
    'ORDER BY f.candle_end_utc DESC LIMIT 1'
   ).bind(market).first();
   return respond({market,latest:latest??null,...SAFETY},200,origin);
  }catch(_e){return respond({market,latest:null,reason:'DATA_UNAVAILABLE',
   ...SAFETY},503,origin);}
 }
};
