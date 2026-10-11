// Free, no-key, source-timestamped BTC/INR market price only. CoinDCX is
// preferred when its BTCINR trade is fresh. CoinGecko INR is an explicitly
// indicative FALLBACK, never relabeled as a directly executable trade.
// No USD price conversion, charts, user input, private API or orders.
export const BTC_INR_SOURCE='COINDCX_PUBLIC_SPOT';
export const BTC_INR_INDICATIVE_SOURCE='COINGECKO_PUBLIC_INR';
const SOURCE_MAX_AGE_MS=120000,COINDCX_MAX_AGE_MS=90000;
const FUTURE_GRACE_MS=15000,MIN_POLL_MS=15000;
const safe=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,
 realOrderPlaced:false,productionRealTradingEnabled:false});
const iso=n=>new Date(n).toISOString();
const number=x=>(typeof x==='string'&&x.trim()!==''||typeof x==='number')&&
 Number.isFinite(Number(x))?Number(x):NaN;
const reasonable=n=>Number.isFinite(n)&&n>=100000&&n<=1e9;
const fresh=(t,now,age)=>Number.isSafeInteger(t)&&t>0&&
 t<=now+FUTURE_GRACE_MS&&now-t<=age;
const unavailable=(now,reason)=>({
 tab:'crypto',symbol:'BTC/INR',currency:'INR',
 state:'UNAVAILABLE',reason,priceInr:null,priceAtUtc:null,
 checkedAtUtc:iso(now),provider:null,quoteType:'NONE',...safe
});
const quote=(now,n,t,provider,type)=>({
 tab:'crypto',symbol:'BTC/INR',currency:'INR',state:'LIVE_PRICE',
 priceInr:n,priceAtUtc:iso(t),checkedAtUtc:iso(now),
 provider,quoteType:type,...safe
});
export function parseCoinDcxBtcInrTicker(payload,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_CLOCK_INVALID');
 if(!Array.isArray(payload)||payload.length>10000)
  return unavailable(now,'BTC_INR_TICKER_INVALID');
 const selected=payload.filter(x=>x?.market==='BTCINR');
 if(selected.length!==1)return unavailable(now,'BTC_INR_PAIR_MISSING_OR_DUPLICATED');
 const tick=selected[0],last=number(tick.last_price),timestamp=tick.timestamp;
 if(!reasonable(last)||!Number.isSafeInteger(timestamp)||timestamp<=0)
  return unavailable(now,'BTC_INR_TICKER_INVALID');
 if(!fresh(timestamp,now,COINDCX_MAX_AGE_MS))
  return unavailable(now,'BTC_INR_SOURCE_TIMESTAMP_STALE');
 return quote(now,last,timestamp,BTC_INR_SOURCE,'SPOT_LAST_TRADE');
}
export function parseCoinGeckoBtcInrPrice(payload,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_CLOCK_INVALID');
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
  !payload.bitcoin||typeof payload.bitcoin!=='object')
  return unavailable(now,'BTC_INR_INDICATIVE_INVALID');
 const price=number(payload.bitcoin.inr),seconds=payload.bitcoin.last_updated_at;
 if(!reasonable(price)||!Number.isSafeInteger(seconds)||seconds<1e9)
  return unavailable(now,'BTC_INR_INDICATIVE_INVALID');
 const timestamp=seconds*1000;
 if(!fresh(timestamp,now,SOURCE_MAX_AGE_MS))
  return unavailable(now,'BTC_INR_INDICATIVE_TIMESTAMP_STALE');
 return quote(now,price,timestamp,BTC_INR_INDICATIVE_SOURCE,
  'INDICATIVE_MARKET_PRICE');
}
export async function fetchPublicCoinDcxBtcInrTicker(){
 const response=await fetch('https://api.coindcx.com/exchange/ticker',{
  method:'GET',headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(7500)
 });
 if(!response.ok)throw Error('BTC_INR_PROVIDER_UNAVAILABLE');
 return response.json();
}
export async function fetchPublicCoinGeckoBtcInr(){
 const response=await fetch(
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=inr&include_last_updated_at=true',
  {method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(7500)}
 );
 if(!response.ok)throw Error('BTC_INR_INDICATIVE_PROVIDER_UNAVAILABLE');
 return response.json();
}
export function createBtcInrLivePriceFeed({
 fetchTicker,fetchIndicative,clock=()=>Date.now()
}={}){
 if(typeof fetchTicker!=='function'||typeof fetchIndicative!=='function'||
  typeof clock!=='function')throw Error('BTC_INR_DEPENDENCIES_REQUIRED');
 let cached=null,pending=null;
 async function getLatest(){
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_CLOCK_INVALID');
  if(cached&&now-cached.checkedAt>=0&&now-cached.checkedAt<MIN_POLL_MS){
   if(cached.response.state==='LIVE_PRICE'&&
    now-Date.parse(cached.response.priceAtUtc)>
     (cached.response.provider===BTC_INR_SOURCE?
      COINDCX_MAX_AGE_MS:SOURCE_MAX_AGE_MS))
    return unavailable(now,'BTC_INR_SOURCE_TIMESTAMP_STALE');
   return cached.response;
  }
  if(pending)return pending;
  pending=(async()=>{
   // Independent source failures are isolated. No stale source is promoted.
   const [direct,indicative]=await Promise.allSettled([
    fetchTicker(),fetchIndicative()
   ]);
   const checkedAt=clock();
   const directQuote=direct.status==='fulfilled'?
    parseCoinDcxBtcInrTicker(direct.value,checkedAt):null;
   const indicativeQuote=indicative.status==='fulfilled'?
    parseCoinGeckoBtcInrPrice(indicative.value,checkedAt):null;
   const out=directQuote?.state==='LIVE_PRICE'?directQuote:
    indicativeQuote?.state==='LIVE_PRICE'?indicativeQuote:
    unavailable(checkedAt,'BTC_INR_LIVE_SOURCES_UNAVAILABLE_OR_STALE');
   cached={checkedAt:clock(),response:out};
   return out;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return {getLatest};
}
