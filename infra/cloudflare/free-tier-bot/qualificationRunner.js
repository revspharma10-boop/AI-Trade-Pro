// Synthetic-only free-tier Cloudflare Worker and D1 smoke tests.
// No Cloudflare account, Upstox token, paid resource or real trade involved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import bot,{digest,dueSlot,directionFromSnapshot,brokerSnapshot,
 runFreeResearch,settlePending,runCron} from './worker.js';

const time=hhmm=>Date.parse('2026-10-09T'+hhmm+':00+05:30');
const fmt=hhmm=>'2026-10-09T'+hhmm+':00+05:30';
const b=(hhmm,o,h,l,c)=>[fmt(hhmm),o,h,l,c,12000,0];
const candles=[
 b('09:15',100,100.9,99.2,100.5),
 b('09:20',100.5,101.4,100.2,101.1),
 b('09:25',101.1,101.8,100.8,101.6),
 b('09:30',101.6,102.4,101.5,102.2),
 b('09:35',102.2,103.5,102.0,103.3),
 b('09:45',103.3,500,102,450)
];
const session=market=>({
 market,exchange:market==='nifty'?'NSE':'BSE',
 session_date:'2026-10-09',verified:1,closed:0,
 open_minute_ist:555,close_minute_ist:930,source_id:'VERIFIED_SYNTHETIC_TEST_ONLY'
});
const s=dueSlot({market:'nifty',now:time('09:31'),official:session('nifty')});
assert.equal(s.eligible,true);
assert.equal(new Date(s.candleEnd).toISOString(),new Date(time('09:30')).toISOString());
assert.equal(dueSlot({market:'nifty',now:time('09:30'),
 official:session('nifty')}).eligible,false,'12 sec post-close grace');
assert.equal(dueSlot({market:'nifty',now:time('09:33'),
 official:session('nifty')}).reason,'DECISION_WINDOW_MISSED');
assert.equal(dueSlot({market:'nifty',now:time('09:31'),
 official:null}).reason,'EXCHANGE_CALENDAR_UNVERIFIED');
assert.equal(dueSlot({market:'nifty',now:time('09:31'),
 official:{...session('nifty'),closed:1}}).eligible,false);
assert.equal(dueSlot({market:'nifty',now:Date.parse('2026-10-10T09:31:00+05:30'),
 official:session('nifty')}).eligible,false,'Saturday must be closed');
assert.equal(dueSlot({market:'sensex',now:time('09:31'),
 official:session('nifty')}).eligible,false,'Exchange calendar cannot cross markets');

const quote=(market,at=time('09:31'),px=102.85)=>({
 instrumentKey:(market==='nifty'?'NSE_INDEX|Synthetic Nifty':'BSE_INDEX|Synthetic Sensex'),
 verified:true,lastPrice:px,timestamp:at
});
const snapshot=(market='nifty',at=time('09:31'),bars=candles)=>({
 market,exchange:market==='nifty'?'NSE':'BSE',
 instrumentKey:quote(market).instrumentKey,
 quote:quote(market,at),candles:bars.map(x=>({
  datetime:x[0],open:x[1],high:x[2],low:x[3],close:x[4],volume:x[5]
 }))
});
const predicted=directionFromSnapshot({
 snapshot:snapshot(),slot:s,now:time('09:31'),market:'nifty'
});
assert.equal(predicted.direction,'BULLISH');
assert.equal(predicted.referencePrice,102.85);
assert.equal(predicted.reason,'OPENING_15M_BULLISH_BODY_AND_CLOSE_SEQUENCE');
assert.ok(!predicted.evidence.includes('2026-10-09T09:45'),'Later 09:45 future candle never enters earlier features');
assert.equal(directionFromSnapshot({snapshot:snapshot('nifty',time('09:25')),
 slot:s,now:time('09:31'),market:'nifty'}).direction,'ABSTAIN');
assert.equal(directionFromSnapshot({snapshot:snapshot('sensex'),
 slot:s,now:time('09:31'),market:'nifty'}).direction,'ABSTAIN');
assert.equal(directionFromSnapshot({snapshot:snapshot('nifty',time('09:31'),
 [...candles,b('09:25',101.1,101.8,100.8,101.6)]),
 slot:s,now:time('09:31'),market:'nifty'}).direction,'ABSTAIN',
 'Duplicate exchange candle cannot silently override source data');
assert.match(await digest('test'),/^[a-f0-9]{64}$/);

const key='NSE_INDEX|Synthetic Nifty';
const secret='SYNTHETIC_TEST_TOKEN_NOT_A_REAL_SECRET';
const mockFetch=async(url,options)=>{
 assert.match(options.headers.Authorization,/^Bearer SYNTHETIC_TEST_TOKEN/);
 assert.ok(!url.includes(secret),'Authorization must be sent only in request header');
 if(url.includes('/historical-candle/intraday/')){
  assert.ok(url.includes(encodeURIComponent(key)));
  return {ok:true,json:async()=>({data:{candles}})};
 }
 if(url.includes('/market-quote/quotes?')){
  assert.ok(url.includes(encodeURIComponent(key)));
  return {ok:true,json:async()=>({data:{
   [key]:{instrument_token:key,last_price:102.85,
    timestamp:new Date(time('09:31')).toISOString()}
  }})};
 }
 throw Error('TEST_UNKNOWN_UPSTOX_ENDPOINT');
};
const broker=await brokerSnapshot({market:'nifty',spec:s.spec,
 env:{NIFTY_INDEX_KEY:key,UPSTOX_ANALYTICS_TOKEN:secret},
 now:time('09:31'),fetchFn:mockFetch});
assert.equal(broker.candles.length,candles.length);
assert.equal(broker.quote.instrumentKey,key);
await assert.rejects(brokerSnapshot({market:'nifty',spec:s.spec,
 env:{NIFTY_INDEX_KEY:key},now:time('09:31'),fetchFn:mockFetch}),
 /BROKER_CONFIGURATION_MISSING/);

class FakeD1{
 constructor(){this.sessions=[session('nifty'),session('sensex')];
  this.forecasts=[];this.outcomes=[];}
 prepare(sql){
  const db=this;
  return {bind(...args){
   return {
    async first(){
     if(sql.includes('FROM verified_sessions'))return db.sessions.find(x=>
      x.market===args[0]&&x.session_date===args[1])??null;
     if(sql.includes('FROM forecasts WHERE id=?'))
      return db.forecasts.find(x=>x.id===args[0])??null;
     if(sql.includes('FROM forecasts f ')&&sql.includes('LEFT JOIN outcomes')){
      const row=db.forecasts.filter(x=>x.market===args[0]).sort((a,b)=>
       b.candle_end_utc.localeCompare(a.candle_end_utc))[0];
      if(!row)return null;
      const o=db.outcomes.find(x=>x.forecast_id===row.id);
      return {...row,outcome:o?.outcome??null,
       observed_close:o?.observed_close??null,change_bps:o?.change_bps??null};
     }
     throw Error('UNEXPECTED_D1_FIRST_QUERY');
    },
    async all(){
     if(!sql.includes('FROM forecasts WHERE market=?')&&
        !sql.includes('FROM forecasts WHERE market=?'))throw Error('UNKNOWN_ALL');
     const filtered=db.forecasts.filter(x=>x.market===args[0]&&
      ['BULLISH','BEARISH'].includes(x.direction)&&
      x.horizon_end_utc<=args[1]&&
      !db.outcomes.some(o=>o.forecast_id===x.id)).slice(0,10);
     return {results:filtered};
    },
    async run(){
     if(sql.startsWith('INSERT OR IGNORE INTO forecasts')){
      const fields=['id','market','exchange','strategy_version',
       'candle_end_utc','captured_at_utc','horizon_end_utc','direction',
       'underlying_instrument_key','reference_price','source_quote_utc',
       'evidence_hash','data_quality','reason_code'];
      const row=Object.fromEntries(fields.map((f,i)=>[f,args[i]]));
      if(db.forecasts.some(x=>x.id===row.id||
       x.market===row.market&&x.strategy_version===row.strategy_version&&
       x.candle_end_utc===row.candle_end_utc))return {meta:{changes:0}};
      db.forecasts.push(row);
      return {meta:{changes:1}};
     }
     if(sql.startsWith('INSERT OR IGNORE INTO outcomes')){
      const fields=['id','forecast_id','market','exchange','evaluated_at_utc',
       'horizon_end_utc','observed_close','change_bps','outcome'];
      const row=Object.fromEntries(fields.map((f,i)=>[f,args[i]]));
      if(db.outcomes.some(x=>x.id===row.id||x.forecast_id===row.forecast_id))
       return {meta:{changes:0}};
      db.outcomes.push(row);
      return {meta:{changes:1}};
     }
     throw Error('UNEXPECTED_D1_WRITE');
    }
   };
  }};
 }
}

const db=new FakeD1();
const env={DB:db,NIFTY_INDEX_KEY:key,SENSEX_INDEX_KEY:'BSE_INDEX|Synthetic Sensex',
 UPSTOX_ANALYTICS_TOKEN:secret};
const first=await runFreeResearch({env,market:'nifty',
 now:time('09:31'),fetchFn:mockFetch});
assert.equal(first.status,'RECORDED');assert.equal(first.direction,'BULLISH');
assert.equal(db.forecasts.length,1);
assert.equal(db.forecasts[0].paper_only,undefined,
 'Synthetic in-memory SQL simulator stores explicit bind variables only');
assert.equal(db.forecasts[0].candle_end_utc,new Date(time('09:30')).toISOString());
assert.equal(db.forecasts[0].data_quality,'VERIFIED');
assert.equal(await digest('forecast|nifty|or15-shadow-v1|'+
 new Date(time('09:30')).toISOString()),db.forecasts[0].id);
assert.equal((await runFreeResearch({env,market:'nifty',
 now:time('09:31'),fetchFn:mockFetch})).status,'DUPLICATE');
assert.equal(db.forecasts.length,1);
const settle=await settlePending({env,market:'nifty',
 now:time('09:36'),fetchFn:mockFetch});
assert.equal(settle.recorded,1);
assert.equal(db.outcomes[0].outcome,'INCORRECT',
 'Synthetic later close 102.2 must be scored against captured 102.85');
assert.equal((await settlePending({env,market:'nifty',
 now:time('09:36'),fetchFn:mockFetch})).recorded,0);
const publicView=await bot.fetch(new Request('https://free.example/v1/public/latest?market=nifty',{
 headers:{origin:'https://revspharma10-boop.github.io'}
}),env);
assert.equal(publicView.status,200);
assert.equal(publicView.headers.get('access-control-allow-origin'),
 'https://revspharma10-boop.github.io');
const publicData=await publicView.json();
assert.equal(publicData.latest.direction,'BULLISH');
assert.equal(publicData.latest.outcome,'INCORRECT');
assert.equal(publicData.orderSubmissionAllowed,false);
assert.ok(!JSON.stringify(publicData).includes(secret));
assert.ok(!JSON.stringify(publicData).includes(key),
 'Do not expose internal instrument keys');
const offsite=await bot.fetch(new Request(
 'https://free.example/v1/public/latest?market=nifty',
 {headers:{origin:'https://unexpected.example'}}),env);
assert.equal(offsite.headers.get('access-control-allow-origin'),null);
assert.equal((await bot.fetch(new Request('https://free.example/health'),env)
 ).status,200);
assert.equal((await bot.fetch(new Request('https://free.example/v1/private/balance'),env)
 ).status,404);
assert.equal((await bot.fetch(new Request('https://free.example/v1/public/latest',
 {method:'POST'}),env)).status,405);

// Confirm missing token creates ABSTAIN without synthetic BUY or leaked code.
const noToken={...env,DB:new FakeD1(),UPSTOX_ANALYTICS_TOKEN:''};
const noData=await runFreeResearch({env:noToken,market:'nifty',
 now:time('09:31'),fetchFn:mockFetch});
assert.equal(noData.direction,'ABSTAIN');
assert.equal(noToken.DB.forecasts[0].reference_price,null);
assert.equal(noToken.DB.forecasts[0].reason_code,'PROVIDER_SOURCE_UNAVAILABLE');

// Cron outside trading time must not attempt upstream calls.
const beforeCount=db.forecasts.length;
await runCron({env,now:time('07:00'),fetchFn:async()=>{throw Error(
 'BAD_UPSTREAM_CALLED_OFF_HOURS');}});
assert.equal(db.forecasts.length,beforeCount);
const code=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('./wrangler.toml',import.meta.url),'utf8');
assert.match(code,/orderSubmissionAllowed:false/);
assert.doesNotMatch(code,/\/v2\/order\/place|\/v3\/order\/place/);
assert.match(sql,/UNIQUE \(market,strategy_version,candle_end_utc\)/);
assert.match(sql,/real_order_placed INTEGER NOT NULL DEFAULT 0 CHECK \(real_order_placed=0\)/);
assert.match(wrangler,/crons = \["\* 3-10 \* \* 1-5"\]/);
assert.match(wrangler,/REPLACE_WITH_REAL_D1_DATABASE_ID/,
 'No accidental deploy without user-controlled Cloudflare account setup');
console.log('PHASE 1B FREE-TIER QUALIFICATION PASSED: time/calendar gating, genuine provider contract, no future candle, immutable D1 writes, honest 5m settlement, public-safe read-only JSON and ZERO orders (synthetic fixtures)');
