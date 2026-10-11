import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCoinDcxBtcInrTicker,createBtcInrLivePriceFeed,
 BTC_INR_SOURCE} from './btcInrLivePrice.js';
const now=Date.parse('2026-10-11T10:05:00Z');
const base={market:'BTCINR',last_price:'9212345.67',
 bid:'9212000.00',ask:'9212700.00',timestamp:now-19000};
const ticker=[{market:'ETHINR',last_price:'1',timestamp:now},{...base}];
const checked=parseCoinDcxBtcInrTicker(ticker,now);
assert.equal(checked.tab,'crypto');
assert.equal(checked.symbol,'BTC/INR');
assert.equal(checked.state,'LIVE_LAST_TRADE');
assert.equal(checked.provider,'COINDCX_PUBLIC_SPOT');
assert.equal(checked.quoteType,'SPOT_LAST_TRADE');
assert.equal(checked.lastTradeInr,9212345.67);
assert.equal(checked.lastTradeAtUtc,new Date(now-19000).toISOString());
assert.equal(checked.currency,'INR');
assert.equal(checked.paperOnly,true);
assert.equal(checked.orderSubmissionAllowed,false);
assert.equal(checked.realOrderPlaced,false);
assert.equal(checked.productionRealTradingEnabled,false);
for(const val of [
 [],null,{},[{market:'BTCUSD',last_price:'9212345.67',timestamp:now}],
 [{...base},{...base}],
 [{...base,last_price:0}],
 [{...base,last_price:'untrusted'}],
 [{...base,last_price:'9212345,xx'}],
 [{...base,last_price:Infinity}],
 [{...base,timestamp:now-91000}],
 [{...base,timestamp:now+16000}],
 [{...base,timestamp:0}],
 [{...base,last_price:50}],
 [{...base,last_price:1.1e10}]
]){
 const out=parseCoinDcxBtcInrTicker(val,now);
 assert.equal(out.state,'UNAVAILABLE','Invalid, stale, future or non-INR ticks fail closed');
 assert.equal(out.lastTradeInr,null);
 assert.equal(out.orderSubmissionAllowed,false);
}
let time=now,calls=0;
const feed=createBtcInrLivePriceFeed({
 clock:()=>time,fetchTicker:async()=>{calls++;return ticker;}
});
assert.equal((await feed.getLatest()).state,'LIVE_LAST_TRADE');
time+=7000;
assert.equal((await feed.getLatest()).lastTradeInr,9212345.67);
assert.equal(calls,1,'Cache avoids excessive provider traffic');
time+=15000;
assert.equal((await feed.getLatest()).state,'LIVE_LAST_TRADE');
assert.equal(calls,2,'Must refresh market price after cache TTL');
time+=100000;
assert.equal((await feed.getLatest()).state,'UNAVAILABLE',
 'Provider has an old timestamp; never keep old price as LIVE');
const unavail=createBtcInrLivePriceFeed({
 clock:()=>now,fetchTicker:async()=>{throw Error('PRIVATE_NEVER_EXPOSE')}
});
const failure=await unavail.getLatest();
assert.equal(failure.state,'UNAVAILABLE');
assert.equal(failure.lastTradeInr,null);
assert.ok(!JSON.stringify(failure).includes('PRIVATE_NEVER_EXPOSE'));
const src=readFileSync(new URL('./btcInrLivePrice.js',import.meta.url),'utf8');
assert.match(src,/api\.coindcx\.com\/exchange\/ticker/);
assert.doesNotMatch(src,/\/orders\/|\/private\/|POST|UPSTOX_CLIENT_SECRET/);
const backend=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(backend,/\/api\/crypto-price\/inr\/latest/);
assert.ok(backend.includes('btcInrLivePrice.getLatest()'));
console.log('BTC INR LIVE PRICE QUALIFICATION PASSED: direct INR spot, timestamp age, strict symbol, zero orders and refresh/rejection.');
