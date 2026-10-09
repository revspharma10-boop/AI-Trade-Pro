// Phase 1 local-only append-only ledger for synthetic replay qualification.
// This is NOT a distributed production event store or a cloud durability claim.
// One writer/process only. PostgreSQL uniqueness+transactions required for cloud.
// No credentials, account data, personal trading positions or trade orders allowed.
import {createHash} from 'node:crypto';
import {open,readFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

export const PHASE1_EVENT_SCHEMA=1;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const STAGES=new Set(['DIRECTIONAL_FORECAST','DIRECTIONAL_OUTCOME']);
const DIRECTIONS=new Set(['BULLISH','BEARISH','ABSTAIN']);
const FORECAST_STATUSES=new Set(['PROVISIONAL_DIRECTION','ABSTAIN']);
const OUTCOMES=new Set(['CORRECT','INCORRECT','INCONCLUSIVE','UNEVALUABLE']);
const isIso=value=>typeof value==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&
 Number.isFinite(Date.parse(value));
const isId=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const knownKeys=(obj,allowed)=>Object.keys(obj).every(k=>allowed.includes(k));

export function validatePhase1Event(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||
    !STAGES.has(event.kind)||event.schemaVersion!==PHASE1_EVENT_SCHEMA||
    !isId(event.id)||event.paperOnly!==true||event.realOrderPlaced!==false||
    event.orderSubmissionAllowed!==false||
    !['nifty','sensex'].includes(event.market)||
    !['NSE','BSE'].includes(event.exchange)||
    (event.market==='nifty'?'NSE':'BSE')!==event.exchange||
    !isIso(event.capturedAtUtc)||!isIso(event.forecastCandleEndUtc))
  throw Error('PHASE1_EVENT_SCHEMA_INVALID');
 if(event.kind==='DIRECTIONAL_FORECAST'){
  const allowed=['schemaVersion','kind','id','market','exchange','strategyVersion',
   'forecastCandleEndUtc','capturedAtUtc','horizonEndUtc','featureCutoffUtc',
   'underlyingInstrumentKey','direction','status','referencePrice','sourceQuoteAtUtc','evidenceHash',
   'reasonCodes','dataQuality','paperOnly','realOrderPlaced','orderSubmissionAllowed'];
  if(!knownKeys(event,allowed)||!/^or15-shadow-v[0-9]+$/.test(event.strategyVersion??'')||
     !isIso(event.horizonEndUtc)||!isIso(event.featureCutoffUtc)||
     Date.parse(event.horizonEndUtc)-Date.parse(event.forecastCandleEndUtc)!==300000||
     Date.parse(event.capturedAtUtc)<Date.parse(event.forecastCandleEndUtc)+12000||
     Date.parse(event.capturedAtUtc)>Date.parse(event.forecastCandleEndUtc)+90000||
     event.featureCutoffUtc!==event.capturedAtUtc||
     (event.underlyingInstrumentKey!==null&&
      (typeof event.underlyingInstrumentKey!=='string'||
       !event.underlyingInstrumentKey.startsWith(event.exchange+'_INDEX|')))||
     !DIRECTIONS.has(event.direction)||!FORECAST_STATUSES.has(event.status)||
     (event.status==='PROVISIONAL_DIRECTION')!==(event.direction!=='ABSTAIN')||
     !['VERIFIED','MISSING'].includes(event.dataQuality)||
     !Array.isArray(event.reasonCodes)||event.reasonCodes.length>12||
     event.reasonCodes.some(x=>typeof x!=='string'||!/^[A-Z0-9_]{3,100}$/.test(x))||
     (event.evidenceHash!==null&&!isId(event.evidenceHash))||
     (event.referencePrice!==null&&!(finite(event.referencePrice)&&event.referencePrice>0))||
     (event.sourceQuoteAtUtc!==null&&!isIso(event.sourceQuoteAtUtc))||
     (event.direction!=='ABSTAIN'&&
      (event.dataQuality!=='VERIFIED'||event.referencePrice===null||
       event.underlyingInstrumentKey===null||
       event.sourceQuoteAtUtc===null||event.evidenceHash===null))||
     (event.dataQuality==='MISSING'&&
      (event.referencePrice!==null||event.underlyingInstrumentKey!==null))||
     (event.sourceQuoteAtUtc!==null&&Date.parse(event.sourceQuoteAtUtc)>Date.parse(event.featureCutoffUtc)+10000))
   throw Error('PHASE1_FORECAST_VALIDATION_FAILED');
 }else{
  const allowed=['schemaVersion','kind','id','forecastId','market','exchange',
   'forecastCandleEndUtc','capturedAtUtc','horizonEndUtc','observedCloseAtUtc',
   'underlyingInstrumentKey','outcome','referencePrice','observedClose','changeBps','reasonCode',
   'paperOnly','realOrderPlaced','orderSubmissionAllowed'];
  if(!knownKeys(event,allowed)||!isId(event.forecastId)||
     !isIso(event.horizonEndUtc)||event.capturedAtUtc<event.horizonEndUtc||
     !OUTCOMES.has(event.outcome)||
     typeof event.underlyingInstrumentKey!=='string'||
     !event.underlyingInstrumentKey.startsWith(event.exchange+'_INDEX|')||
     (event.observedCloseAtUtc!==null&&!isIso(event.observedCloseAtUtc))||
     (event.observedClose!==null&&!(finite(event.observedClose)&&event.observedClose>0))||
     (event.changeBps!==null&&!finite(event.changeBps))||
     (event.referencePrice!==null&&!(finite(event.referencePrice)&&event.referencePrice>0))||
     typeof event.reasonCode!=='string'||!/^[A-Z0-9_]{3,100}$/.test(event.reasonCode)||
     (event.outcome==='UNEVALUABLE'&&
      (event.observedClose!==null||event.changeBps!==null||event.observedCloseAtUtc!==null))||
     (event.outcome!=='UNEVALUABLE'&&
      (event.referencePrice===null||event.observedClose===null||
       event.observedCloseAtUtc===null||event.changeBps===null)))
   throw Error('PHASE1_OUTCOME_VALIDATION_FAILED');
 }
 return true;
}
const clone=value=>JSON.parse(JSON.stringify(value));

export class Phase1LocalJsonlLedger{
 #path;
 #items=new Map();
 #initialized=false;
 #queue=Promise.resolve();
 constructor(filepath){
  if(typeof filepath!=='string'||!filepath.trim())throw Error('PHASE1_LEDGER_PATH_REQUIRED');
  this.#path=resolve(filepath);
 }
 async open(){
  if(this.#initialized)return this;
  let contents='';
  try{contents=await readFile(this.#path,'utf8');}
  catch(e){if(e?.code!=='ENOENT')throw e;}
  if(contents&&!contents.endsWith('\n'))throw Error('PHASE1_LEDGER_TORN_WRITE');
  for(const line of contents.split('\n').filter(Boolean)){
   let doc;
   try{doc=JSON.parse(line);}catch(_){throw Error('PHASE1_LEDGER_CORRUPT_JSON');}
   if(!doc||typeof doc!=='object'||Object.keys(doc).sort().join(',')!=='checksum,event')
    throw Error('PHASE1_LEDGER_CORRUPT_RECORD');
   const raw=JSON.stringify(doc.event);
   if(doc.checksum!==sha256(raw))throw Error('PHASE1_LEDGER_CHECKSUM_MISMATCH');
   validatePhase1Event(doc.event);
   if(this.#items.has(doc.event.id))throw Error('PHASE1_LEDGER_DUPLICATE_RECORD');
   this.#items.set(doc.event.id,clone(doc.event));
  }
  this.#initialized=true;
  return this;
 }
 get(id){
  if(!this.#initialized)throw Error('PHASE1_LEDGER_NOT_OPEN');
  const event=this.#items.get(id);
  return event?clone(event):null;
 }
 list(kind=null){
  if(!this.#initialized)throw Error('PHASE1_LEDGER_NOT_OPEN');
  if(kind!==null&&!STAGES.has(kind))throw Error('PHASE1_EVENT_KIND_INVALID');
  return [...this.#items.values()].filter(x=>!kind||x.kind===kind).map(clone);
 }
 async append(event){
  if(!this.#initialized)throw Error('PHASE1_LEDGER_NOT_OPEN');
  validatePhase1Event(event);
  const safe=clone(event);
  const run=async()=>{
   const existing=this.#items.get(safe.id);
   if(existing)return {created:false,event:clone(existing)};
   const raw=JSON.stringify(safe);
   const line=JSON.stringify({event:safe,checksum:sha256(raw)})+'\n';
   await mkdir(dirname(this.#path),{recursive:true});
   const handle=await open(this.#path,'a',0o600);
   try{await handle.writeFile(line,'utf8');await handle.sync();}
   finally{await handle.close();}
   this.#items.set(safe.id,safe);
   return {created:true,event:clone(safe)};
  };
  const next=this.#queue.then(run);
  this.#queue=next.catch(()=>undefined); // a failed append must not deadlock.
  return next;
 }
}
