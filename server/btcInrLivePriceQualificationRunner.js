import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCoinDcxBtcInrTicker,parseCoinGeckoBtcInrPrice,
 createBtcInrLivePriceFeed,BTC_INR_SOURCE,BTC_INR_INDICATIVE_SOURCE}
 from './btcInrLivePrice.js';
const now=Date.parse('2026-10-11T10:05:00Z');
const base={market:'BTCINR',last_price:'9212345.67',
 bid:'9212000.00',ask:'9212700.00',timestamp:now-19000};
const direct=[{market:'ETHINR',last_price:'1',timestamp:now},{...base}];
const gecko={bitcoin:{inr:9312345.67,last_updated_at:Math.floor((now-24000)/1000)}};
const checked=parseCoinDcxBtcInrTicker(direct,now);
assert.equal(checked.tab,'crypto');
assert.equal(checked.symbol,'BTC/INR');
assert.equal(checked.state,'LIVE_PRICE');
assert.equal(checked.provider,BTC_INR_SOURCE);
assert.equal(checked.quoteType,'SPOT_LAST_TRADE');
assert.equal(checked.priceInr,9212345.67);
assert.equal(checked.priceAtUtc,new Date(now-19000).toISOString());
assert.equal(checked.currency,'INR');
assert.equal(checked.paperOnly,true);
assert.equal(checked.orderSubmissionAllowed,false);
assert.equal(checked.realOrderPlaced,false);
assert.equal(checked.productionRealTradingEnabled,false);
const indicative=parseCoinGeckoBtcInrPrice(gecko,now);
assert.equal(indicative.state,'LIVE_PRICE');
assert.equal(indicative.quoteType,'INDICATIVE_MARKET_PRICE');
assert.equal(indicative.provider,BTC_INR_INDICATIVE_SOURCE);
assert.equal(indicative.priceInr,9312345.67);
assert.equal(indicative.priceAtUtc,new Date(now-24000).toISOString());
for(const val of [
 [],null,{},[{market:'BTCUSD',last_price:'9212345.67',timestamp:now}],
 [{...base},{...base}],[{...base,last_price:0}],
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
 assert.equal(out.state,'UNAVAILABLE','Invalid or stale direct INR trade must fail closed');
 assert.equal(out.priceInr,null);
 assert.equal(out.orderSubmissionAllowed,false);
}
for(const val of [
 {},null,{bitcoin:{inr:0,last_updated_at:Math.floor(now/1000)}},
 {bitcoin:{inr:'9412USD',last_updated_at:Math.floor(now/1000)}},
 {bitcoin:{inr:9412345,last_updated_at:Math.floor((now-121000)/1000)}},
 {bitcoin:{inr:9412345,last_updated_at:Math.floor((now+16000)/1000)}},
 {bitcoin:{inr:9412345,last_updated_at:'2030-01-01'}}
]){
 const out=parseCoinGeckoBtcInrPrice(val,now);
 assert.equal(out.state,'UNAVAILABLE','Invalid or stale aggregator quote must not show');
 assert.equal(out.priceInr,null);
}
let time=now,calls=0,geckoCalls=0;
const feed=createBtcInrLivePriceFeed({
 clock:()=>time,
 fetchTicker:async()=>{calls++;return direct;},
 fetchIndicative:async()=>{geckoCalls++;return gecko;}
});
assert.equal((await feed.getLatest()).state,'LIVE_PRICE');
assert.equal((await feed.getLatest()).provider,BTC_INR_SOURCE,'Direct fresh INR preferred');
time+=7000;
assert.equal((await feed.getLatest()).priceInr,9212345.67);
assert.equal(calls,1,'Cache avoids excessive ticker traffic');
time+=15000;
assert.equal((await feed.getLatest()).state,'LIVE_PRICE');
assert.equal(calls,2,'Must refresh market price after TTL');
time+=72000;
assert.equal((await feed.getLatest()).state,'LIVE_PRICE');
assert.equal((await feed.getLatest()).provider,BTC_INR_INDICATIVE_SOURCE,
 'Stale direct trade must fall back to a fresher and clearly labeled indicative quote');
time+=40000;
assert.equal((await feed.getLatest()).state,'UNAVAILABLE',
 'Both stale sources must never be mislabeled as live');
const unavail=createBtcInrLivePriceFeed({
 clock:()=>now,fetchTicker:async()=>{throw Error('PRIVATE_NEVER_EXPOSE')},
 fetchIndicative:async()=>{throw Error('PRIVATE_NEVER_EXPOSE')}
});
const failure=await unavail.getLatest();
assert.equal(failure.state,'UNAVAILABLE');
assert.equal(failure.priceInr,null);
assert.ok(!JSON.stringify(failure).includes('PRIVATE_NEVER_EXPOSE'));
const src=readFileSync(new URL('./btcInrLivePrice.js',import.meta.url),'utf8');
assert.match(src,/api\.coindcx\.com\/exchange\/ticker/);
assert.match(src,/api\.coingecko\.com\/api\/v3\/simple\/price/);
assert.doesNotMatch(src,/\/orders\/|\/private\/|POST|UPSTOX_CLIENT_SECRET/);
const backend=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(backend,/\/api\/crypto-price\/inr\/latest/);
assert.ok(backend.includes('btcInrLivePrice.getLatest()'));
console.log('BTC INR LIVE PRICE QUALIFICATION PASSED: source-attributed spot/indicative INR, timestamps, fallback and no orders.');
