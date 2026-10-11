// Public spot BTC research only. Immutable, SHA256-checksummed JSONL journal.
// GitHub Actions commits these files to a dedicated archive branch; no Render
// filesystem, paid DB, trading key, authenticated exchange account or orders.
import {createHash} from 'node:crypto';
import {readdir,readFile,mkdir,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {interpretKrakenCryptoOhlc} from './cryptoPaperResearch.js';
import {BTC_CONFLUENCE_VERSION} from './cryptoTechnicalConfluence.js';

export const CRYPTO_JOURNAL_BRANCH='crypto-shadow-history';
const FIVE=300000,GRACE=12000,MAX_CAPTURE_LAG=90000;
const SETTLEMENT_RETRY_MS=60*60*1000,MAX_UNEVALUABLE_MS=60*60*60*1000;
const SAFE=Object.freeze({paperOnly:true,realOrderPlaced:false,
 orderSubmissionAllowed:false,productionRealTradingEnabled:false});
const hash=x=>createHash('sha256').update(x).digest('hex');
const iso=x=>new Date(x).toISOString();
const numeric=x=>(typeof x==='number'||typeof x==='string'&&x.trim()!=='')&&
 Number.isFinite(Number(x))?Number(x):NaN;
const validIso=x=>typeof x==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x));
const reasonCode=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{3,100}$/.test(x);
const keys=(x,allowed)=>Object.keys(x).sort().join('|')===allowed.sort().join('|');
const rootFile=(dir,day)=>join(dir,'data','crypto','btc-usd',day+'.jsonl');

export function validateCryptoJournalEvent(x){
 const base=['schemaVersion','kind','id','symbol','strategyVersion',
 'slotUtc','capturedAtUtc','paperOnly','realOrderPlaced',
 'orderSubmissionAllowed','productionRealTradingEnabled'];
 if(!x||typeof x!=='object'||Array.isArray(x)||x.schemaVersion!==1||
  !['FORECAST','OUTCOME','SKIP'].includes(x.kind)||
  !/^[0-9a-f]{64}$/.test(x.id??'')||x.symbol!=='BTC/USD'||
  x.strategyVersion!==BTC_CONFLUENCE_VERSION||
  !validIso(x.slotUtc)||!validIso(x.capturedAtUtc)||
  Date.parse(x.slotUtc)%FIVE!==0||
  x.paperOnly!==true||x.realOrderPlaced!==false||
  x.orderSubmissionAllowed!==false||x.productionRealTradingEnabled!==false)
  throw Error('CRYPTO_LEDGER_INVALID');
 const slot=Date.parse(x.slotUtc),captured=Date.parse(x.capturedAtUtc);
 if(x.kind==='FORECAST'){
  if(!keys(x,[...base,'direction','referenceClose','source',
    'lastCompletedAtUtc','horizonUtc','featureHash','dataQuality',
    'technicalState','reasonCode'])||
   x.id!==hash('btc-forecast|'+BTC_CONFLUENCE_VERSION+'|'+x.slotUtc)||
   !['BULLISH','BEARISH','ABSTAIN'].includes(x.direction)||
   x.source!=='KRAKEN_PUBLIC_SPOT'||x.dataQuality!=='COMPLETED_5M_OHLCV'||
   x.technicalState!=='HIGH_CONFLUENCE_UNVALIDATED'&&
    x.technicalState!=='ABSTAIN'||
   !validIso(x.lastCompletedAtUtc)||Date.parse(x.lastCompletedAtUtc)!==slot-FIVE||
   !validIso(x.horizonUtc)||Date.parse(x.horizonUtc)!==slot+FIVE||
   !/^[a-f0-9]{64}$/.test(x.featureHash)||!reasonCode(x.reasonCode)||
   (x.direction==='ABSTAIN'?! (x.referenceClose===null&&x.technicalState==='ABSTAIN'):
    !(typeof x.referenceClose==='number'&&Number.isFinite(x.referenceClose)&&
     x.referenceClose>0&&x.technicalState==='HIGH_CONFLUENCE_UNVALIDATED'))||
   captured<slot+GRACE||captured>slot+MAX_CAPTURE_LAG)
   throw Error('CRYPTO_FORECAST_INVALID');
 }else if(x.kind==='OUTCOME'){
  if(!keys(x,[...base,'forecastId','forecastCapturedAtUtc','direction',
    'referenceClose','horizonUtc','observedClose','settlementCandleOpenUtc',
    'moveBps','outcome','reasonCode'])||
   !/^[a-f0-9]{64}$/.test(x.forecastId)||
   x.id!==hash('btc-outcome|'+x.forecastId)||
   !['BULLISH','BEARISH'].includes(x.direction)||
   typeof x.referenceClose!=='number'||!Number.isFinite(x.referenceClose)||
   x.referenceClose<=0||!validIso(x.horizonUtc)||
   Date.parse(x.horizonUtc)!==slot+FIVE||
   !validIso(x.forecastCapturedAtUtc)||
   Date.parse(x.forecastCapturedAtUtc)>=captured||
   captured<slot+FIVE+GRACE||
   !['CORRECT','INCORRECT','INCONCLUSIVE','UNEVALUABLE'].includes(x.outcome)||
   !reasonCode(x.reasonCode))
   throw Error('CRYPTO_OUTCOME_INVALID');
  if(x.outcome==='UNEVALUABLE'){
   if(x.observedClose!==null||x.moveBps!==null||
     x.settlementCandleOpenUtc!==null||
     captured<slot+FIVE+MAX_UNEVALUABLE_MS)
    throw Error('CRYPTO_UNEVALUABLE_INVALID');
  }else{
   if(typeof x.observedClose!=='number'||!Number.isFinite(x.observedClose)||
    x.observedClose<=0||typeof x.moveBps!=='number'||
    !Number.isFinite(x.moveBps)||
    x.settlementCandleOpenUtc!==x.slotUtc||
    x.reasonCode!=='VERIFIED_FIXED_HORIZON_CLOSE')
    throw Error('CRYPTO_SETTLEMENT_INVALID');
   const move=Number((10000*(x.observedClose-x.referenceClose)/
    x.referenceClose).toFixed(4));
   const expected=Math.abs(move)<=2?'INCONCLUSIVE':
    move*(x.direction==='BULLISH'?1:-1)>0?'CORRECT':'INCORRECT';
   if(Math.abs(move-x.moveBps)>0.00011||x.outcome!==expected)
    throw Error('CRYPTO_OUTCOME_LABEL_INVALID');
  }
 }else{
  if(!keys(x,[...base,'reasonCode'])||
   x.id!==hash('btc-skip|'+BTC_CONFLUENCE_VERSION+'|'+x.slotUtc)||
   !reasonCode(x.reasonCode)||captured<slot)
   throw Error('CRYPTO_SKIP_INVALID');
 }
 return true;
}
export function createCryptoFileJournal(baseDir){
 if(typeof baseDir!=='string'||!baseDir.trim())throw Error('CRYPTO_JOURNAL_DIR_MISSING');
 const root=resolve(baseDir);
 let events=[],opened=false,queue=Promise.resolve();
 async function readAll(){
  const dir=join(root,'data','crypto','btc-usd');
  let names=[];
  try{names=(await readdir(dir)).filter(x=>/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(x)).sort();}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const ids=new Set(),uniqueForecastSlots=new Set(),all=[];
  for(const name of names){
   const raw=await readFile(join(dir,name),'utf8');
   if(raw&&!raw.endsWith('\n'))throw Error('CRYPTO_LEDGER_TORN_RECORD');
   for(const line of raw.split('\n').filter(Boolean)){
    let doc;
    try{doc=JSON.parse(line);}catch(_){throw Error('CRYPTO_LEDGER_CORRUPT_JSON');}
    if(!doc||!keys(doc,['checksum','event'])||
     doc.checksum!==hash(JSON.stringify(doc.event)))throw Error('CRYPTO_LEDGER_CHECKSUM_INVALID');
    validateCryptoJournalEvent(doc.event);
    if(name!==doc.event.slotUtc.slice(0,10)+'.jsonl'||
     ids.has(doc.event.id))throw Error('CRYPTO_LEDGER_DUPLICATE_OR_WRONG_FILE');
    ids.add(doc.event.id);
    if(doc.event.kind==='FORECAST'){
     if(uniqueForecastSlots.has(doc.event.slotUtc))throw Error('CRYPTO_LEDGER_SLOT_DUPLICATE');
     uniqueForecastSlots.add(doc.event.slotUtc);
    }
    all.push(doc.event);
   }
  }
  const forecasts=new Map(all.filter(e=>e.kind==='FORECAST').map(x=>[x.id,x]));
  const settled=new Set();
  for(const e of all.filter(x=>x.kind==='OUTCOME')){
   const f=forecasts.get(e.forecastId);
   if(!f||f.direction==='ABSTAIN'||settled.has(e.forecastId)||
      e.slotUtc!==f.slotUtc||e.horizonUtc!==f.horizonUtc||
      e.direction!==f.direction||e.referenceClose!==f.referenceClose||
      e.forecastCapturedAtUtc!==f.capturedAtUtc)
    throw Error('CRYPTO_LEDGER_OUTCOME_FORECAST_MISMATCH');
   settled.add(e.forecastId);
  }
  for(const e of all.filter(x=>x.kind==='SKIP')){
   if(uniqueForecastSlots.has(e.slotUtc))throw Error('CRYPTO_LEDGER_SKIP_FORECAST_CONFLICT');
  }
  return all;
 }
 return {
  async open(){events=await readAll();opened=true;return this;},
  list(){if(!opened)throw Error('CRYPTO_LEDGER_NOT_OPEN');return structuredClone(events);},
  async append(e){
   if(!opened)throw Error('CRYPTO_LEDGER_NOT_OPEN');
   validateCryptoJournalEvent(e);
   const next=queue.then(async()=>{
    if(events.some(x=>x.id===e.id))return {created:false,event:e};
    const affected=[...events,e];
    const forecast=e.kind==='OUTCOME'?events.find(x=>x.id===e.forecastId):null;
    if(e.kind==='OUTCOME'&&(!forecast||forecast.direction==='ABSTAIN'||
      e.slotUtc!==forecast.slotUtc||e.horizonUtc!==forecast.horizonUtc||
      e.direction!==forecast.direction||e.referenceClose!==forecast.referenceClose||
      e.forecastCapturedAtUtc!==forecast.capturedAtUtc))
     throw Error('CRYPTO_OUTCOME_PARENT_NOT_VERIFIED');
    if(e.kind==='FORECAST'&&events.some(x=>x.slotUtc===e.slotUtc&&
      ['FORECAST','SKIP'].includes(x.kind))||
       e.kind==='SKIP'&&events.some(x=>x.slotUtc===e.slotUtc&&
       ['FORECAST','SKIP'].includes(x.kind))||
       e.kind==='OUTCOME'&&events.some(x=>x.forecastId===e.forecastId))
      throw Error('CRYPTO_JOURNAL_COLLISION');
    const file=rootFile(root,e.slotUtc.slice(0,10));
    await mkdir(join(root,'data','crypto','btc-usd'),{recursive:true});
    const line=JSON.stringify({checksum:hash(JSON.stringify(e)),event:e})+'\n';
    const handle=await open(file,'a',0o600);
    try{await handle.writeFile(line,'utf8');await handle.sync();}
    finally{await handle.close();}
    events=affected;
    return {created:true,event:e};
   });
   queue=next.catch(()=>undefined);
   return next;
  }
 };
}

function checkedKrakenRows(payload,now){
 if(!payload||!Array.isArray(payload.error)||payload.error.length!==0||
    !payload.result||typeof payload.result!=='object')
  return null;
 const keys=Object.keys(payload.result).filter(k=>k!=='last');
 if(keys.length!==1||!['XXBTZUSD','XBTUSD'].includes(keys[0]))
  return null;
 const raw=payload.result[keys[0]];
 if(!Array.isArray(raw)||raw.length<2||raw.length>720)return null;
 const current=Math.floor(now/FIVE)*FIVE;
 const bars=[];
 for(const x of raw){
  if(!Array.isArray(x)||x.length<8||!Number.isSafeInteger(x[0]))return null;
  const t=x[0]*1000,o=numeric(x[1]),hi=numeric(x[2]),lo=numeric(x[3]),
   c=numeric(x[4]),v=numeric(x[6]),tr=numeric(x[7]);
  if(t%FIVE!==0||![o,hi,lo,c].every(n=>Number.isFinite(n)&&n>0)||
     lo>hi||o<lo||o>hi||c<lo||c>hi||
     !Number.isFinite(v)||v<0||!Number.isSafeInteger(tr)||tr<0)
   return null;
  bars.push({time:t,open:o,high:hi,low:lo,close:c,volume:v,trades:tr});
 }
 if(bars.some((x,i)=>i&&x.time<=bars[i-1].time)||
    bars.at(-1).time!==current)return null;
 return bars.slice(0,-1);
}
const errorCode=reason=>reasonCode(reason)?reason:'CRYPTO_PROVIDER_DATA_UNAVAILABLE';
export async function cryptoShadowCycle({ledger,fetchOhlc,clock=()=>Date.now()}={}){
 if(!ledger||typeof ledger.list!=='function'||typeof ledger.append!=='function'||
   typeof fetchOhlc!=='function'||typeof clock!=='function')
  throw Error('CRYPTO_SHADOW_DEPENDENCIES_REQUIRED');
 // Capture wall clock AFTER the request; network delay is part of the cutoff.
 let payload=null;
 try{payload=await fetchOhlc();}catch(_){}
 const now=Number(clock()),slot=Math.floor(now/FIVE)*FIVE;
 if(!Number.isFinite(now)||!Number.isSafeInteger(now))throw Error('CRYPTO_SHADOW_CLOCK_INVALID');
 const all=ledger.list();
 const priorIds=new Set(all.map(x=>x.id));
 const outcomes=[],nowSlot=iso(slot);
 const verifiedBars=checkedKrakenRows(payload,now);
 const forecasts=all.filter(e=>e.kind==='FORECAST'&&
  e.direction!=='ABSTAIN'&&!priorIds.has(hash('btc-outcome|'+e.id)));
 for(const forecast of forecasts){
  const horizon=Date.parse(forecast.horizonUtc);
  if(now<horizon+GRACE)continue;
  const settle=verifiedBars?.find(x=>x.time===Date.parse(forecast.slotUtc));
  if(!settle&&now<horizon+MAX_UNEVALUABLE_MS)continue;
  const close=settle?.close??null;
  const move=close===null?null:Number((10000*(close-forecast.referenceClose)/
   forecast.referenceClose).toFixed(4));
  const classification=close===null?'UNEVALUABLE':Math.abs(move)<=2?'INCONCLUSIVE':
   move*(forecast.direction==='BULLISH'?1:-1)>0?'CORRECT':'INCORRECT';
  const outcome={schemaVersion:1,kind:'OUTCOME',
   id:hash('btc-outcome|'+forecast.id),symbol:'BTC/USD',
   strategyVersion:BTC_CONFLUENCE_VERSION,
   slotUtc:forecast.slotUtc,capturedAtUtc:iso(now),
   forecastId:forecast.id,forecastCapturedAtUtc:forecast.capturedAtUtc,
   direction:forecast.direction,referenceClose:forecast.referenceClose,
   horizonUtc:forecast.horizonUtc,observedClose:close,
   settlementCandleOpenUtc:close===null?null:forecast.slotUtc,
   moveBps:move,outcome:classification,
   reasonCode:close===null?'CANDLE_UNAVAILABLE_AFTER_TIMEOUT':'VERIFIED_FIXED_HORIZON_CLOSE',
   ...SAFE};
  const result=await ledger.append(outcome);
  if(result.created)outcomes.push(classification);
 }
 const existing=all.some(e=>e.slotUtc===nowSlot&&
  (e.kind==='FORECAST'||e.kind==='SKIP'));
 let forecastState='DUPLICATE';
 if(!existing){
  if(now-slot<GRACE||now-slot>MAX_CAPTURE_LAG||!verifiedBars){
   const reason=now-slot<GRACE?'CRYPTO_DECISION_NOT_READY':
    now-slot>MAX_CAPTURE_LAG?'CRYPTO_DECISION_WINDOW_MISSED':
    'CRYPTO_PROVIDER_DATA_UNAVAILABLE';
   // Only write skips during same slot, never backfill missed prior slots.
   await ledger.append({schemaVersion:1,kind:'SKIP',
    id:hash('btc-skip|'+BTC_CONFLUENCE_VERSION+'|'+nowSlot),symbol:'BTC/USD',
    strategyVersion:BTC_CONFLUENCE_VERSION,slotUtc:nowSlot,
    capturedAtUtc:iso(now),reasonCode:reason,...SAFE});
   forecastState='SKIPPED';
  }else{
   const observed=interpretKrakenCryptoOhlc(payload,now);
   const signal=observed.status==='PROVISIONAL_DIRECTION';
   const last=verifiedBars.at(-1);
   const referenceClose=signal?observed.completedClose:null;
   const fingerprint=hash(JSON.stringify(verifiedBars.slice(-360).map(x=>[
    x.time,x.open,x.high,x.low,x.close,x.volume,x.trades
   ])));
   const f={schemaVersion:1,kind:'FORECAST',
    id:hash('btc-forecast|'+BTC_CONFLUENCE_VERSION+'|'+nowSlot),
    symbol:'BTC/USD',strategyVersion:BTC_CONFLUENCE_VERSION,
    slotUtc:nowSlot,capturedAtUtc:iso(now),direction:signal?observed.direction:'ABSTAIN',
    referenceClose,source:'KRAKEN_PUBLIC_SPOT',
    lastCompletedAtUtc:iso(slot-FIVE),horizonUtc:iso(slot+FIVE),
    featureHash:fingerprint,dataQuality:'COMPLETED_5M_OHLCV',
    technicalState:signal?'HIGH_CONFLUENCE_UNVALIDATED':'ABSTAIN',
    reasonCode:signal?'ALL_EIGHT_TECHNICAL_CHECKS_PASSED':errorCode(observed.reason),
    ...SAFE};
   // If Kraken OHLC is missing expected previous candle, record skip rather than
   // invent a valid abstention.
   if(!last||last.time!==slot-FIVE){
    await ledger.append({schemaVersion:1,kind:'SKIP',
     id:hash('btc-skip|'+BTC_CONFLUENCE_VERSION+'|'+nowSlot),
     symbol:'BTC/USD',strategyVersion:BTC_CONFLUENCE_VERSION,
     slotUtc:nowSlot,capturedAtUtc:iso(now),
     reasonCode:'CRYPTO_COMPLETED_CANDLES_REQUIRED',...SAFE});
    forecastState='SKIPPED';
   }else{
    await ledger.append(f);forecastState=signal?f.direction:'ABSTAIN';
   }
  }
 }
 return {status:'STAGED_PENDING_GIT_COMMIT',slotUtc:nowSlot,
  forecastState,outcomesEvaluated:outcomes.length,
  correct:outcomes.filter(x=>x==='CORRECT').length,
  incorrect:outcomes.filter(x=>x==='INCORRECT').length,
  inconclusive:outcomes.filter(x=>x==='INCONCLUSIVE').length,
  unevaluable:outcomes.filter(x=>x==='UNEVALUABLE').length,
  paperOnly:true,realOrdersAllowed:false};
}

export function cryptoHistorySummary(events){
 const counts={decisions:0,qualified:0,abstained:0,skipped:0,
  correct:0,incorrect:0,inconclusive:0,unevaluable:0,pending:0};
 const resolved=new Map(events.filter(x=>x.kind==='OUTCOME').map(x=>[x.forecastId,x]));
 for(const e of events){
  if(e.kind==='SKIP'){counts.skipped++;continue;}
  if(e.kind!=='FORECAST')continue;
  counts.decisions++;
  if(e.direction==='ABSTAIN'){counts.abstained++;continue;}
  counts.qualified++;
  const out=resolved.get(e.id);
  if(out)counts[out.outcome.toLowerCase()]++;
  else counts.pending++;
 }
 const n=counts.correct+counts.incorrect+counts.inconclusive;
 return {strategyVersion:BTC_CONFLUENCE_VERSION,counts,
  evaluatedFiveMinuteDirectionAccuracyPct:n?
   Number((counts.correct*100/n).toFixed(2)):null,
  evaluatedSampleSize:n,livePerformanceVerified:false,
  selectedRecordsMayNotCoverAllClockSlots:true,
  netTradingPnLMeasured:false,realOrdersAllowed:false};
}
