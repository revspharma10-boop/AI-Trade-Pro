// All fixtures here are synthetic. This is NOT an intraday performance backtest.
// Qualifies the local event contract, per-bar scheduler, no-lookahead and
// immutable evaluation WITHOUT connecting to Upstox or placing orders.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Phase1LocalJsonlLedger,validatePhase1Event} from './phase1LocalJsonlLedger.js';
import {createPhase1ShadowPipeline,eligibleShadowDecision,
 PHASE1_SHADOW_SAFETY} from './phase1ShadowForecastPipeline.js';

const at=time=>Date.parse('2026-10-09T'+time+':00+05:30');
const candle=(time,o,h,l,c,v=11000)=>({datetime:'2026-10-09T'+time+
 ':00+05:30',open:o,high:h,low:l,close:c,volume:v});
const syntheticCandles=[
 candle('09:15',100,100.9,99.2,100.5),
 candle('09:20',100.5,101.4,100.2,101.1),
 candle('09:25',101.1,101.8,100.8,101.6),
 candle('09:30',101.6,102.4,101.5,102.2),
 candle('09:35',102.2,103,102,102.7),
 candle('09:45',102.7,104.2,102.5,103.7) // future, MUST be ignored at 09:40
];
const goodCalendar={
 getSession:({market,exchange,date})=>({
  verified:true,market,exchange,date,closed:false,
  sourceId:'SYNTHETIC_EXCHANGE_CALENDAR_FIXTURE',
  openMinuteIST:555,closeMinuteIST:930
 })
};
const calendarNotVerified={getSession:()=>({
 verified:false,market:'nifty',exchange:'NSE',date:'2026-10-09',
 closed:false,sourceId:'NO_OFFICIAL_CALENDAR',
 openMinuteIST:555,closeMinuteIST:930
})};
const fixtureData=({quoteAt=at('09:40')+19000,
 quotePrice=102.85,market='nifty',excludeQuote=false,
 throwError=false,extraFuture=false}={})=>({
 async getSnapshot({market:asked}){
  if(throwError)throw Error('SECRET_UPSTOX_TOKEN_DO_NOT_RECORD');
  return {market,exchange:asked==='nifty'?'NSE':'BSE',
   instrumentKey:asked==='nifty'?'NSE_INDEX|Synthetic Nifty':'BSE_INDEX|Synthetic Sensex',
   quote:excludeQuote?null:{instrumentKey:asked==='nifty'?
     'NSE_INDEX|Synthetic Nifty':'BSE_INDEX|Synthetic Sensex',
    verified:true,lastPrice:quotePrice,timestamp:quoteAt},
   candles:extraFuture?[...syntheticCandles,candle('10:00',103,500,102,450)]:
    syntheticCandles
  };
 },
 async getSettlementCandle({market:requested,candleStartUtc}){
  return {verified:true,market:requested,
   exchange:requested==='nifty'?'NSE':'BSE',
   candle:{...candle('09:40',102.7,104.5,102.6,103.5),
    datetime:candleStartUtc}};
 }
});

const tmp=await mkdtemp(join(tmpdir(),'ai-trade-pro-phase1-'));
try{
 const file=join(tmp,'forecast-events.jsonl');
 const ledger=await new Phase1LocalJsonlLedger(file).open();
 const provider=fixtureData();
 const pipeline=createPhase1ShadowPipeline({ledger,marketData:provider,
  calendar:goodCalendar});
 assert.equal(PHASE1_SHADOW_SAFETY.paperOnly,true);
 assert.equal(PHASE1_SHADOW_SAFETY.orderSubmissionAllowed,false);
 assert.equal(PHASE1_SHADOW_SAFETY.realOrderPlaced,false);
 assert.equal(PHASE1_SHADOW_SAFETY.productionRealTradingEnabled,false);
 assert.equal(PHASE1_SHADOW_SAFETY.optionPlanQualified,false);

 await assert.rejects(async()=>createPhase1ShadowPipeline({ledger,marketData:{},
  calendar:goodCalendar}),/PHASE1_SHADOW_DEPENDENCIES_REQUIRED/);
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('09:25'),
  calendar:goodCalendar}).eligible,false);
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('09:30')+11000,
  calendar:goodCalendar}).eligible,false);
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('09:40')+91000,
  calendar:goodCalendar}).reason,'DECISION_WINDOW_MISSED');
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('09:40')+20000,
  calendar:calendarNotVerified}).reason,'EXCHANGE_SESSION_CALENDAR_UNVERIFIED');
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('15:21'),
  calendar:goodCalendar}).eligible,false,'No late new NSE paper research');
 assert.equal(eligibleShadowDecision({market:'nifty',asOf:at('09:40')+20000,
  calendar:{getSession:()=>({...goodCalendar.getSession({
   market:'nifty',exchange:'NSE',date:'2026-10-09'
  }),closed:true})}}).eligible,false);
 assert.equal(eligibleShadowDecision({market:'sensex',asOf:at('09:40')+20000,
  calendar:goodCalendar}).eligible,true,'BSE calendar accepted independently');

 const moment=at('09:40')+20000;
 const [first,second,third]=await Promise.all([
  pipeline.tick({market:'nifty',asOf:moment}),
  pipeline.tick({market:'nifty',asOf:moment}),
  pipeline.tick({market:'nifty',asOf:moment})
 ]);
 assert.equal([first,second,third].filter(x=>x.recorded).length,1,
  'Concurrent scheduling of the same five-minute slot commits one forecast');
 const event=first.event;
 assert.equal(first.status==='RECORDED'||second.status==='RECORDED',true);
 assert.equal(event.kind,'DIRECTIONAL_FORECAST');
 assert.equal(event.status,'PROVISIONAL_DIRECTION');
 assert.equal(event.direction,'BULLISH');
 assert.equal(event.referencePrice,102.85);
 assert.equal(event.dataQuality,'VERIFIED');
 assert.equal(event.horizonEndUtc,new Date(at('09:45')).toISOString());
 assert.equal(event.featureCutoffUtc,new Date(moment).toISOString());
 assert.equal(event.orderSubmissionAllowed,false);
 assert.ok(/^[a-f0-9]{64}$/.test(event.evidenceHash));
 assert.equal(event.reasonCodes[0],'COMPLETED_5M_UPSIDE_RANGE_BREAKOUT');
 assert.equal(ledger.list().length,1);
 assert.equal(ledger.get(event.id).id,event.id);
 assert.equal(pipeline.listOutcomes().length,0);
 // A caller cannot mutate a returned event to modify ledger history.
 event.referencePrice=1;
 assert.equal(ledger.get(event.id).referencePrice,102.85);
 const replay=await pipeline.tick({market:'nifty',asOf:moment});
 assert.equal(replay.recorded,false);
 assert.equal(replay.status,'DUPLICATE');
 assert.equal(ledger.list('DIRECTIONAL_FORECAST').length,1);
 assert.equal((await readFile(file,'utf8')).trim().split('\n').length,1,
  'The file must contain exactly one forecast JSONL record');
 const closed=await new Phase1LocalJsonlLedger(file).open();
 assert.equal(closed.list('DIRECTIONAL_FORECAST').length,1,
  'Restarting the ledger restores committed history');
 const shadowRestart=createPhase1ShadowPipeline({ledger:closed,
  marketData:provider,calendar:goodCalendar});
 const noSecondWrite=await shadowRestart.tick({market:'nifty',asOf:moment});
 assert.equal(noSecondWrite.status,'DUPLICATE');
 assert.equal((await readFile(file,'utf8')).trim().split('\n').length,1);

 const early=await pipeline.evaluate({forecastId:first.event.id,asOf:at('09:44')});
 assert.equal(early.status,'OUTCOME_NOT_DUE');
 assert.equal(pipeline.listOutcomes().length,0);
 const settled=await shadowRestart.evaluate({
  forecastId:first.event.id,asOf:at('09:45')+13000
 });
 assert.equal(settled.recorded,true);
 assert.equal(settled.event.outcome,'CORRECT');
 assert.equal(settled.event.observedClose,103.5);
 assert.equal(settled.event.referencePrice,102.85);
 assert.equal(settled.event.observedCloseAtUtc,new Date(at('09:45')).toISOString());
 assert.equal(settled.event.orderSubmissionAllowed,false);
 assert.equal(settled.event.realOrderPlaced,false);
 assert.equal((await shadowRestart.evaluate({
  forecastId:first.event.id,asOf:at('09:46')
 })).status,'DUPLICATE');
 const reloaded=await new Phase1LocalJsonlLedger(file).open();
 assert.equal(reloaded.list().length,2);
 assert.equal(reloaded.list('DIRECTIONAL_OUTCOME').length,1);
 await assert.rejects(async()=>reloaded.append({...first.event,
  BROKER_API_SECRET:'MUST_REJECT'}),/PHASE1_FORECAST_VALIDATION_FAILED/);
 await assert.rejects(async()=>reloaded.append({...first.event,
  orderSubmissionAllowed:true}),/PHASE1_EVENT_SCHEMA_INVALID/);

 // A later synthetic price cannot be read into an earlier feature cutoff.
 const futureFile=join(tmp,'future.jsonl');
 const futureLedger=await new Phase1LocalJsonlLedger(futureFile).open();
 const futurePipeline=createPhase1ShadowPipeline({ledger:futureLedger,
  marketData:fixtureData({extraFuture:true}),calendar:goodCalendar});
 const futureEvent=(await futurePipeline.tick({market:'nifty',asOf:moment})).event;
 assert.equal(futureEvent.referencePrice,102.85);
 assert.equal(futureEvent.evidenceHash,first.event.evidenceHash,
  'Later candles must be ignored in deterministic pre-horizon features');
 // A different model version gets a distinct ID and cannot rewrite v1 history.
 const version2=createPhase1ShadowPipeline({ledger:futureLedger,
  marketData:provider,calendar:goodCalendar,
  strategyVersion:'or15-shadow-v2'});
 assert.notEqual((await version2.tick({market:'nifty',asOf:moment})).event.id,
  futureEvent.id);

 for(const [name,opts] of [
  ['stale',{quoteAt:at('09:35')}],
  ['futureQuote',{quoteAt:at('09:41')}],
  ['missingQuote',{excludeQuote:true}],
  ['mismatch',{market:'sensex'}],
  ['providerFailure',{throwError:true}]
 ]){
  const store=await new Phase1LocalJsonlLedger(join(tmp,name+'.jsonl')).open();
  const p=createPhase1ShadowPipeline({ledger:store,marketData:fixtureData(opts),
   calendar:goodCalendar});
  const r=await p.tick({market:'nifty',asOf:moment});
  assert.equal(r.recorded,true,name);
  assert.equal(r.event.status,'ABSTAIN',name);
  assert.equal(r.event.direction,'ABSTAIN',name);
  assert.equal(r.event.referencePrice,null,name);
  assert.equal((await p.evaluate({forecastId:r.event.id,asOf:at('09:46')})
   ).status,'ABSTENTION_NOT_SCORED',name);
  assert.equal(p.listOutcomes().length,0);
  if(name==='providerFailure'){
   const persisted=await readFile(join(tmp,name+'.jsonl'),'utf8');
   assert.ok(!persisted.includes('SECRET_UPSTOX_TOKEN_DO_NOT_RECORD'),
    'Provider exception text must never reach the ledger');
  }
 }
 // No direction is an abstention even with fully verified quotes/candles.
 const mixed=await new Phase1LocalJsonlLedger(join(tmp,'mixed.jsonl')).open();
 const flatProvider=fixtureData({quotePrice:100.9});
 const baseSnapshot=flatProvider.getSnapshot;
 flatProvider.getSnapshot=async x=>{
  const snapshot=await baseSnapshot(x);
  snapshot.candles=[
   candle('09:15',100,101.2,99.5,100.9),
   candle('09:20',100.9,101.3,100.5,100.7),
   candle('09:25',100.7,101.2,100.4,100.6),
   candle('09:30',100.6,101.3,100.3,100.8),
   candle('09:35',100.8,101.2,100.4,100.9)
  ];
  return snapshot;
 };
 const flat=(await createPhase1ShadowPipeline({
  ledger:mixed,marketData:flatProvider,calendar:goodCalendar
 }).tick({market:'nifty',asOf:moment})).event;
 assert.equal(flat.status,'ABSTAIN');
 assert.equal(flat.dataQuality,'VERIFIED');
 assert.equal(flat.referencePrice,100.9,
  'Valid neutral research is not the same as missing source data');

 // Missing outcome never becomes an invented WIN/LOSS.
 const missingOutcomeFile=join(tmp,'outcome-missing.jsonl');
 const missingLedger=await new Phase1LocalJsonlLedger(missingOutcomeFile).open();
 const badOutcomeProvider=fixtureData();
 badOutcomeProvider.getSettlementCandle=async()=>null;
 const missing=createPhase1ShadowPipeline({ledger:missingLedger,
  marketData:badOutcomeProvider,calendar:goodCalendar});
 const candidate=(await missing.tick({market:'nifty',asOf:moment})).event;
 assert.equal((await missing.evaluate({forecastId:candidate.id,
  asOf:at('09:45')+15000})).status,'OUTCOME_AWAITING_VERIFIED_CANDLE');
 const unavailable=await missing.evaluate({forecastId:candidate.id,
  asOf:at('09:49')});
 assert.equal(unavailable.event.outcome,'UNEVALUABLE');
 assert.equal(unavailable.event.observedClose,null);
 assert.equal(unavailable.event.changeBps,null);
 assert.equal((await missing.evaluate({forecastId:candidate.id,
  asOf:at('09:50')})).status,'DUPLICATE');

 // Checksum/damaged write on restart is detected, not silently skipped.
 const invalidFile=join(tmp,'corrupted.jsonl');
 await writeFile(invalidFile,(await readFile(file,'utf8')).replace('102.85','999.99'));
 await assert.rejects(
  new Phase1LocalJsonlLedger(invalidFile).open(),
  /PHASE1_LEDGER_CHECKSUM_MISMATCH/
 );
 const tornFile=join(tmp,'torn.jsonl');
 await writeFile(tornFile,'{"event":');
 await assert.rejects(new Phase1LocalJsonlLedger(tornFile).open(),
  /PHASE1_LEDGER_TORN_WRITE/);
 assert.equal(validatePhase1Event(first.event),true);
 console.log('PHASE 1 LOCAL PIPELINE QUALIFICATION PASSED: 09:40 completed-candle bullish shadow forecast, immutable file replay, concurrent de-duplication, explicit calendar, no future data, honest settlement/abstention, zero orders');
}finally{
 await rm(tmp,{recursive:true,force:true});
}
