// Independent read-only BTC/INR spot ticker. Public CoinDCX endpoint,
// no credentials, currency conversion, order or chart API.
export const BTC_INR_SOURCE='COINDCX_PUBLIC_SPOT';
const SOURCE_MAX_AGE_MS=90000;
const FUTURE_GRACE_MS=15000;
const MIN_POLL_MS=15000;
const safe=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,
 realOrderPlaced:false,productionRealTradingEnabled:false});
const iso=n=>new Date(n).toISOString();
const price=x=>(typeof x==='string'&&x.trim()!==''||typeof x==='number')&&
 Number.isFinite(Number(x))?Number(x):NaN;
const unavailable=(now,reason)=>({
 tab:'crypto',symbol:'BTC/INR',currency:'INR',
 state:'UNAVAILABLE',reason,
 lastTradeInr:null,lastTradeAtUtc:null,checkedAtUtc:iso(now),
 provider:BTC_INR_SOURCE,quoteType:'SPOT_LAST_TRADE',
 ...safe
});
export function parseCoinDcxBtcInrTicker(payload,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_CLOCK_INVALID');
 if(!Array.isArray(payload)||payload.length>10000)
  return unavailable(now,'BTC_INR_TICKER_INVALID');
 const selected=payload.filter(x=>x?.market==='BTCINR');
 if(selected.length!==1)return unavailable(now,'BTC_INR_PAIR_MISSING_OR_DUPLICATED');
 const tick=selected[0],last=price(tick.last_price),timestamp=tick.timestamp;
 if(!Number.isSafeInteger(timestamp)||timestamp<=0||
   !Number.isFinite(last)||last<100000||last>1000000000)
  return unavailable(now,'BTC_INR_TICKER_INVALID');
 if(timestamp>now+FUTURE_GRACE_MS||
   now-timestamp>SOURCE_MAX_AGE_MS)
  return unavailable(now,'BTC_INR_SOURCE_TIMESTAMP_STALE');
 // This is one exchange's spot last traded price, not a buy/sell execution quote.
 return {tab:'crypto',symbol:'BTC/INR',currency:'INR',state:'LIVE_LAST_TRADE',
  lastTradeInr:last,lastTradeAtUtc:iso(timestamp),checkedAtUtc:iso(now),
  provider:BTC_INR_SOURCE,quoteType:'SPOT_LAST_TRADE',...safe};
}
export async function fetchPublicCoinDcxBtcInrTicker(){
 const response=await fetch('https://api.coindcx.com/exchange/ticker',{
  method:'GET',headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error('BTC_INR_PROVIDER_UNAVAILABLE');
 return response.json();
}
export function createBtcInrLivePriceFeed({fetchTicker,clock=()=>Date.now()}={}){
 if(typeof fetchTicker!=='function'||typeof clock!=='function')
  throw Error('BTC_INR_DEPENDENCIES_REQUIRED');
 let cached=null,pending=null;
 async function getLatest(){
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_CLOCK_INVALID');
  if(cached&&now-cached.checkedAt>=0&&now-cached.checkedAt<MIN_POLL_MS){
   // Recheck freshness even for a cached record, never serve stale as LIVE.
   if(cached.response.state==='LIVE_LAST_TRADE'&&
    now-Date.parse(cached.response.lastTradeAtUtc)>SOURCE_MAX_AGE_MS)
    return unavailable(now,'BTC_INR_SOURCE_TIMESTAMP_STALE');
   return cached.response;
  }
  if(pending)return pending;
  pending=(async()=>{
   let out;
   try{out=parseCoinDcxBtcInrTicker(await fetchTicker(),clock());}
   catch(_){out=unavailable(clock(),'BTC_INR_PROVIDER_UNAVAILABLE');}
   cached={checkedAt:clock(),response:out};
   return out;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return {getLatest};
}
