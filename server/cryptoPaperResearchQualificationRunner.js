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
assert.equal(result.status,'PROVISIONAL_DIRECTION');
assert.equal(result.direction,'BULLISH');
assert.equal(result.completedClose,105,'Never use the 950 uncommitted close');
assert.equal(result.signalCloseAt,new Date(observed-20000).toISOString());
assert.equal(result.source,'KRAKEN_PUBLIC_SPOT');
assert.equal(result.quoteCurrency,'USD');
assert.equal(result.dataQuality,'COMPLETED_5M_OHLCV');
const down=payload([
 row(0,100,101,99,100,85),row(1,100,102,99,101,95),
 row(2,101,102,100,101,75),row(3,101,101.5,95,96,95),
 row(4,96,97,90,92)]);
assert.equal(interpretKrakenCryptoOhlc(down,observed).direction,'BEARISH');
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
let calls=0;
const feed=createCryptoPaperResearchFeed({fetchOhlc:async()=>{
 calls++;return payload();
}});
const a=await feed.getLatest(observed);
assert.equal(a.tab,'crypto');
assert.equal(a.state,'WAIT','Provisional spot hypothesis never becomes a trade');
assert.equal(a.provisionalDirection?.direction,'BULLISH');
assert.equal(a.provisionalDirection?.strategy,'CRYPTO_ROLLING_RANGE_15M');
assert.equal(a.provisionalDirection?.source,'KRAKEN_PUBLIC_SPOT');
assert.equal(a.provisionalDirection?.paperOnly,true);
assert.equal(a.provisionalDirection?.recordedDurably,false);
assert.equal(a.orderSubmissionAllowed,false);
assert.equal(a.approvedLots,0);
assert.equal(a.last,null);
assert.equal(a.verifiedContract,null);
assert.equal(a.spot.currency,'USD');
assert.equal(a.spot.lastCompletedClose,105);
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
console.log('CRYPTO PAPER RESEARCH QUALIFICATION PASSED: 24/7 BTC/USD completed candles, source identity, 5-minute frozen directional-only hypothesis and no real orders.');
