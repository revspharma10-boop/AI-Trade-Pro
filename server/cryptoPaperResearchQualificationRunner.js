// Synthetic Kraken-like fixtures only; not measured crypto accuracy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interpretKrakenCryptoOhlc,createCryptoPaperResearchFeed,CRYPTO_SAFETY}
 from './cryptoPaperResearch.js';
const start=Date.parse('2026-10-11T09:10:00Z');
const at=n=>Math.round((start+n*300000)/1000);
const observed=Date.parse('2026-10-11T09:30:20Z');
const row=(i,o,h,l,c,volume=85,trades=105)=>
 [at(i),String(o),String(h),String(l),String(c),String(c),String(volume),trades];
const rows=[
 row(0,100,101,99,100,80),
 row(1,100,102,99,101,110),
 row(2,101,102,100,101,75),
 row(3,101,106,100.5,105,98),
 row(4,105,999,1,950,120) // UNCOMMITTED CANDLE: must not influence!
];
const payload=(data=rows,key='XXBTZUSD')=>({error:[],result:{[key]:data,last:0}});
const result=interpretKrakenCryptoOhlc(payload(),observed);
assert.equal(result.status,'WAIT');
assert.equal(result.reason,'CRYPTO_TECHNICAL_HISTORY_INSUFFICIENT',
 'Four candles must not qualify as a high-confluence technical signal');
const down=payload([
 row(0,100,101,99,100,85),row(1,100,102,99,101,95),
 row(2,101,102,100,101,75),row(3,101,101.5,95,96,95),
 row(4,96,97,90,92)]);
assert.equal(interpretKrakenCryptoOhlc(down,observed).status,'WAIT');
assert.equal(interpretKrakenCryptoOhlc(payload(),observed-15000).status,'WAIT',
 'Do not predict until the previous five-minute candle has completed and grace elapsed');
for(const corrupted of [
 payload(rows.slice(1)),payload(rows,'ETHUSD'),
 payload([rows[0],rows[1],rows[2],rows[2],rows[4]]),
 payload([rows[0],rows[1],rows[2],rows[4],rows[3]]),
 payload(rows.map((x,i)=>i===3?[...x.slice(0,4),null,...x.slice(5)]:x)),
 payload(rows.map((x,i)=>i===3?[...x.slice(0,6),null,x[7]]:x)),
 {error:['EQuery:Rate limit exceeded'],result:{XXBTZUSD:rows}},
 {error:[],result:{XXBTZUSD:rows,ETHUSD:rows}},
 {error:[],result:{}},
 null
]){
 const test=interpretKrakenCryptoOhlc(corrupted,observed);
 assert.equal(test.status,'WAIT','Invalid, duplicated or mismatched Kraken data must fail closed');
}
// Synthetic 30h series: upward and downward contexts without future bars.
const epoch=observed-20000;
const longBars=Array.from({length:360},(_,i)=>{
 const p=j=>10000+j*0.9+7*Math.sin(j*.4)+3*Math.sin(j*1.3)+(j===359?16:0);
 const close=p(i),open=i===0?close-1:p(i-1);
 const high=Math.max(open,close)+2,low=Math.min(open,close)-2;
 return [Math.floor((epoch-(360-i)*300000)/1000),
  String(open),String(high),String(low),String(close),String(close),
  String(i===359?200:100),120];
});
const runningFuture=[Math.floor(epoch/1000),'10500','999999','1',
 '950000','10100','999','999'];
const highQuality=payload([...longBars,runningFuture]);
const strong=interpretKrakenCryptoOhlc(highQuality,observed);
assert.equal(strong.status,'PROVISIONAL_DIRECTION');
assert.equal(strong.direction,'BULLISH');
assert.equal(strong.strategyVersion,'btc-mtf-confluence-v1');
assert.equal(strong.technical?.checks.length,8);
assert.ok(strong.technical.checks.every(c=>c.pass));
assert.equal(strong.completedClose,Number(Number(longBars[359][4]).toFixed(2)),
 'The uncommitted current candle cannot change the last completed price');
assert.equal(strong.signalCloseAt,new Date(epoch).toISOString());
assert.equal(strong.source,'KRAKEN_PUBLIC_SPOT');
assert.equal(strong.dataQuality,'COMPLETED_5M_OHLCV');
assert.equal(strong.paperLevels.type,'ILLUSTRATIVE_UNEXECUTABLE_ATR_LEVELS');
assert.equal(strong.paperLevels.approvedQuantity,0);
assert.equal(strong.paperLevels.bidAskVerified,false);
const shortBars=longBars.map((v,i)=>[
 v[0],String(22000-Number(v[1])),String(22000-Number(v[3])),
 String(22000-Number(v[2])),String(22000-Number(v[4])),
 String(22000-Number(v[4])),v[6],v[7]
]);
const bearish=interpretKrakenCryptoOhlc(payload([...shortBars,runningFuture]),observed);
assert.equal(bearish.status,'PROVISIONAL_DIRECTION');
assert.equal(bearish.direction,'BEARISH');
assert.ok(bearish.paperLevels.target3<bearish.paperLevels.target1);
for(const broken of [
 payload([...longBars.slice(0,300),longBars[299],...longBars.slice(301),runningFuture]),
 payload([...longBars.slice(1),runningFuture]),
 payload([...longBars.slice(0,-1),
  [...longBars.at(-1).slice(0,6),'0',0],runningFuture]),
 payload([...longBars.slice(0,-1),
  [...longBars.at(-1).slice(0,6),'10',0],runningFuture])
]){
 assert.equal(interpretKrakenCryptoOhlc(broken,observed).status,'WAIT');
}
let calls=0;
const feed=createCryptoPaperResearchFeed({fetchOhlc:async()=>{
 calls++;return highQuality;
}});
const a=await feed.getLatest(observed);
assert.equal(a.tab,'crypto');
assert.equal(a.state,'WAIT','Provisional spot hypothesis never becomes a trade');
assert.equal(a.provisionalDirection?.direction,'BULLISH');
assert.equal(a.provisionalDirection?.strategy,'btc-mtf-confluence-v1');
assert.equal(a.provisionalDirection?.source,'KRAKEN_PUBLIC_SPOT');
assert.equal(a.provisionalDirection?.paperOnly,true);
assert.equal(a.provisionalDirection?.recordedDurably,false);
assert.equal(a.orderSubmissionAllowed,false);
assert.equal(a.approvedLots,0);
assert.equal(a.last,null);
assert.equal(a.verifiedContract,null);
assert.equal(a.spot.currency,'USD');
assert.equal(a.spot.lastCompletedClose,strong.completedClose);
assert.equal(a.technical?.strategyVersion,'btc-mtf-confluence-v1');
assert.equal(a.technical?.checks?.filter(x=>x.pass).length,8);
assert.equal(a.paperLevels?.currency,'USD');
assert.equal(a.paperLevels?.executed,false);
assert.equal(a.paperLevels?.approvedQuantity,0);
const second=await feed.getLatest(observed+4*60000);
assert.deepEqual(second,a,'Five-minute hypothesis must remain frozen');
assert.equal(calls,1,'Frozen hypothesis must not poll Kraken repeatedly');
const next=await feed.getLatest(observed+5*60000);
assert.equal(next.provisionalDirection,null,'Previous candle must not become a new forecast');
assert.equal(next.state,'WAIT');
assert.equal(calls,2);
const failed=createCryptoPaperResearchFeed({fetchOhlc:async()=>{
 throw Error('DO_NOT_EXPOSE_TOKEN_OR_PRIVATE_DATA');
}});
const reject=await failed.getLatest(observed);
assert.equal(reject.state,'WAIT');
assert.equal(reject.blockers[0].code,'CRYPTO_FEED_UNAVAILABLE');
assert.ok(!JSON.stringify(reject).includes('DO_NOT_EXPOSE'));
assert.equal(CRYPTO_SAFETY.productionRealTradingEnabled,false);
const source=readFileSync(new URL('./cryptoPaperResearch.js',import.meta.url),'utf8');
assert.match(source,/api\.kraken\.com\/0\/public\/OHLC/);
assert.doesNotMatch(source,/\/private\/|AddOrder|UPSTOX_CLIENT_SECRET|\/order\/place/);
const server=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(server,/\/api\/crypto-research\/latest/);
assert.match(server,/cryptoResearch\.getLatest\(\)/);
console.log('BTC TECHNICAL CONFLUENCE QUALIFICATION PASSED: 360 complete bars, 5m/1h EMA + RSI + MACD + ATR + VWAP + volume + range, strict illustrative levels, no orders.');
