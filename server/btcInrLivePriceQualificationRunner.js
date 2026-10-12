import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCoinDcxBtcInrTicker,parseCoinGeckoBtcInrPrice,
 parseCoinPaprikaBtcInrPrice,createBtcInrLivePriceFeed,
 BTC_INR_SOURCE,BTC_INR_INDICATIVE_SOURCE,BTC_INR_PAPRIKA_SOURCE}
 from './btcInrLivePrice.js';
import {auditDeployedBtcInrQuote} from './btcInrProductionAudit.js';
const now=Date.parse('2026-10-11T10:05:00Z');
const base={market:'BTCINR',last_price:'9212345.67',
 bid:'9212000.00',ask:'9212700.00',
 timestamp:Math.floor((now-19000)/1000)}; // Real CoinDCX format: Unix seconds.
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
assert.equal(parseCoinDcxBtcInrTicker([{...base,timestamp:now-19000}],now)
 .state,'LIVE_PRICE','Accept explicitly supported legacy epoch milliseconds');
assert.equal(parseCoinDcxBtcInrTicker([{...base,timestamp:now-91000}],now)
 .state,'UNAVAILABLE','Old milliseconds must never appear fresh');
assert.equal(parseCoinDcxBtcInrTicker([{...base,timestamp:
 Math.floor((now-91000)/1000)}],now).state,'UNAVAILABLE',
 'Old seconds must never appear fresh');
assert.equal(parseCoinDcxBtcInrTicker([{...base,timestamp:10000000000}],now)
 .state,'UNAVAILABLE','Reject ambiguous timestamp magnitude');
assert.equal(checked.currency,'INR');
assert.equal(checked.paperOnly,true);
assert.equal(checked.orderSubmissionAllowed,false);
assert.equal(checked.realOrderPlaced,false);
assert.equal(checked.productionRealTradingEnabled,false);
// Read-only *production diagnostic* must not mistake HTTP 200 or an unsafe,
// wrong-currency, stale, future or nonnumeric quote for live market evidence.
const deployedAudit=auditDeployedBtcInrQuote(checked,now);
assert.equal(deployedAudit.verified,true);
assert.equal(deployedAudit.priceInr,9212345.67);
assert.equal(deployedAudit.provider,'COINDCX_PUBLIC_SPOT');
assert.equal(deployedAudit.priceAgeSeconds,19);
for(const bad of [
 {...checked,state:'UNAVAILABLE'}, {...checked,symbol:'BTC/USD'},
 {...checked,currency:'USD'}, {...checked,priceInr:null},
 {...checked,priceInr:Infinity}, {...checked,orderSubmissionAllowed:true},
 {...checked,paperOnly:false},{...checked,realOrderPlaced:true},
 {...checked,productionRealTradingEnabled:true},
 {...checked,priceAtUtc:new Date(now-91000).toISOString()},
 {...checked,priceAtUtc:new Date(now+16000).toISOString()},
 {...checked,checkedAtUtc:new Date(now-91000).toISOString()},
 {...checked,provider:'KRAKEN_PUBLIC_SPOT'},
 {...checked,quoteType:'INDICATIVE_MARKET_PRICE'},
 {...checked,priceAtUtc:'2026-10-11TXX:05:00.000Z'}
]){
 const result=auditDeployedBtcInrQuote(bad,now);
 assert.equal(result.verified,false);
 assert.equal(result.priceInr,null);
}
assert.equal(auditDeployedBtcInrQuote(
 parseCoinGeckoBtcInrPrice(gecko,now),now).verified,true);
assert.equal(auditDeployedBtcInrQuote(
 parseCoinPaprikaBtcInrPrice({id:'btc-bitcoin',symbol:'BTC',
 last_updated:new Date(now-13000).toISOString(),
 quotes:{INR:{price:9219999.1}}},now),now).verified,true);
const paprikas={id:'btc-bitcoin',symbol:'BTC',
 last_updated:new Date(now-13000).toISOString(),
 quotes:{INR:{price:9219999.1}}};
const paprikaChecked=parseCoinPaprikaBtcInrPrice(paprikas,now);
assert.equal(paprikaChecked.state,'LIVE_PRICE');
assert.equal(paprikaChecked.priceInr,9219999.1);
assert.equal(paprikaChecked.provider,BTC_INR_PAPRIKA_SOURCE);
assert.equal(paprikaChecked.quoteType,'INDICATIVE_MARKET_PRICE');
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
for(const invalid of [
 null,{id:'eth-ethereum',symbol:'BTC',quotes:{INR:{price:9219999}},
  last_updated:new Date(now-15000).toISOString()},
 {...paprikas,last_updated:new Date(now-125000).toISOString()},
 {...paprikas,quotes:{USD:{price:100000}}},
 {...paprikas,quotes:{INR:{price:'NaN'}}},
 {...paprikas,last_updated:'not-a-date'}
]){
 assert.equal(parseCoinPaprikaBtcInrPrice(invalid,now).state,'UNAVAILABLE');
}
let time=now,calls=0,geckoCalls=0,paprikaCalls=0;
const feed=createBtcInrLivePriceFeed({
 clock:()=>time,
 fetchTicker:async()=>{calls++;return direct;},
 fetchIndicative:async()=>{geckoCalls++;return gecko;},
 fetchPaprika:async()=>{paprikaCalls++;return paprikas;}
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
 fetchIndicative:async()=>{throw Error('PRIVATE_NEVER_EXPOSE')},
 fetchPaprika:async()=>{throw Error('PRIVATE_NEVER_EXPOSE')}
});
const failure=await unavail.getLatest();
assert.equal(failure.state,'UNAVAILABLE');
assert.equal(failure.priceInr,null);
assert.ok(!JSON.stringify(failure).includes('PRIVATE_NEVER_EXPOSE'));
const src=readFileSync(new URL('./btcInrLivePrice.js',import.meta.url),'utf8');
assert.match(src,/api\.coindcx\.com\/exchange\/ticker/);
assert.match(src,/api\.coingecko\.com\/api\/v3\/simple\/price/);
assert.match(src,/api\.coinpaprika\.com\/v1\/tickers\/btc-bitcoin/);
assert.doesNotMatch(src,/\/orders\/|\/private\/|POST|UPSTOX_CLIENT_SECRET/);
const backend=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(backend,/\/api\/crypto-price\/inr\/latest/);
assert.ok(backend.includes('btcInrLivePrice.getLatest()'));
// CoinPaprika is selected when both faster sources are stale or unavailable.
const paprikaFallback=createBtcInrLivePriceFeed({
 clock:()=>now,fetchTicker:async()=>[],
 fetchIndicative:async()=>({bitcoin:{inr:1,last_updated_at:123}}),
 fetchPaprika:async()=>paprikas
});
const backup=await paprikaFallback.getLatest();
assert.equal(backup.provider,BTC_INR_PAPRIKA_SOURCE);
assert.equal(backup.priceInr,9219999.1);
assert.equal(backup.paperOnly,true);
assert.equal(backup.orderSubmissionAllowed,false);
console.log('BTC INR PRICE QUALIFICATION PASSED: CoinDCX epoch seconds fixed, 3 sources, fresh timestamp and no orders.');
