// Diagnostics from public GitHub Actions: real external endpoints, no secret,
// browser, account access, orders or logging of full third-party responses.
import {auditDeployedBtcInrQuote} from './btcInrProductionAudit.js';
import {parseCoinDcxBtcInrTicker} from './btcInrLivePrice.js';
const base='https://ai-trade-pro-oauth.onrender.com';
const start=Date.now();
async function get(url,timeout=13000){
 const t=Date.now();
 try{
  const res=await fetch(url,{
   method:'GET',headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(timeout),cache:'no-store'
  });
  const value=await res.json().catch(()=>null);
  return {ok:res.ok,httpStatus:res.status,latencyMs:Date.now()-t,value};
 }catch(e){return {ok:false,error:e?.name??'NETWORK_ERROR',
  latencyMs:Date.now()-t,value:null};}
}
const [deployed,gecko,paprika,coindcx]=await Promise.all([
 get(base+'/api/crypto-price/inr/latest',20000),
 get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=inr&include_last_updated_at=true',13000),
 get('https://api.coinpaprika.com/v1/tickers/btc-bitcoin?quotes=INR',13000),
 get('https://api.coindcx.com/exchange/ticker',13000)
]);
function age(t){if(!Number.isFinite(t))return null;return Date.now()-t;}
const coinGeckoAge=gecko.value?.bitcoin?.last_updated_at?
 age(gecko.value.bitcoin.last_updated_at*1000):null;
const paprikaAge=paprika.value?.last_updated?
 age(Date.parse(paprika.value.last_updated)):null;
const dcx=Array.isArray(coindcx.value)?
 coindcx.value.find(x=>x.market==='BTCINR'):null;
const audited=deployed.ok?auditDeployedBtcInrQuote(deployed.value):{
 verified:false,priceInr:null,sourceAtUtc:null,priceAgeSeconds:null};
const directQuote=coindcx.ok?
 parseCoinDcxBtcInrTicker(coindcx.value,Date.now()):null;
const result={
  status:'BTC_INR_PRODUCTION_DIAGNOSTIC',atUtc:new Date().toISOString(),
  deployed:{ok:deployed.ok,httpStatus:deployed.httpStatus,
   latencyMs:deployed.latencyMs,state:deployed.value?.state,
   reason:deployed.value?.reason,provider:deployed.value?.provider,
   quoteType:deployed.value?.quoteType,
   quoteVerified:audited.verified,
   priceInr:audited.priceInr,sourceAtUtc:audited.sourceAtUtc,
   paperOnlySafetyVerified:audited.verified,
   priceAtAgeSeconds:audited.priceAgeSeconds},
  coinGecko:{ok:gecko.ok,httpStatus:gecko.httpStatus,
   latencyMs:gecko.latencyMs,hasInr:Number.isFinite(gecko.value?.bitcoin?.inr),
   priceAgeSeconds:coinGeckoAge===null?null:Math.round(coinGeckoAge/1000)},
  coinPaprika:{ok:paprika.ok,httpStatus:paprika.httpStatus,
   latencyMs:paprika.latencyMs,hasInr:Number.isFinite(paprika.value?.quotes?.INR?.price),
   sourceSymbol:paprika.value?.symbol,
   priceAgeSeconds:paprikaAge===null?null:Math.round(paprikaAge/1000)},
  coinDcx:{ok:coindcx.ok,httpStatus:coindcx.httpStatus,
   latencyMs:coindcx.latencyMs,btcInrPairPresent:!!dcx,
   freshDirectBtcInr:directQuote?.state==='LIVE_PRICE',
   tradeAgeSeconds:directQuote?.state==='LIVE_PRICE'?
    Math.round(age(Date.parse(directQuote.priceAtUtc))/1000):null}
};
console.log(JSON.stringify(result));
// Distinguish diagnostics from qualification: stale exchange data is
// reported as stale, NOT declared a pass for fresh BTC price delivery.
// An HTTP 200 with UNAVAILABLE, stale quote, wrong pair, or unsafe order
// flags is NOT a successful live-price verification.
if(!deployed.ok||!audited.verified)process.exitCode=1;
