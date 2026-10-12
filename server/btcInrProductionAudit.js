// Pure validation for deployed public BTC/INR price diagnostics.
// Invalid / stale / unsafe responses never expose a verified numeric price.
const miss=()=>({verified:false,priceInr:null,provider:null,quoteType:null,
 sourceAtUtc:null,priceAgeSeconds:null});
const utc=x=>typeof x==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&
 Number.isFinite(Date.parse(x));
export function auditDeployedBtcInrQuote(x,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)throw Error('BTC_INR_AUDIT_CLOCK_INVALID');
 const direct=x?.provider==='COINDCX_PUBLIC_SPOT'&&
  x?.quoteType==='SPOT_LAST_TRADE';
 const indicative=(x?.provider==='COINGECKO_PUBLIC_INR'||
  x?.provider==='COINPAPRIKA_PUBLIC_INR')&&
  x?.quoteType==='INDICATIVE_MARKET_PRICE';
 if(!x||x.tab!=='crypto'||x.symbol!=='BTC/INR'||
  x.currency!=='INR'||x.state!=='LIVE_PRICE'||!(direct||indicative)||
  x.paperOnly!==true||x.orderSubmissionAllowed!==false||
  x.realOrderPlaced!==false||x.productionRealTradingEnabled!==false||
  typeof x.priceInr!=='number'||!Number.isFinite(x.priceInr)||
  x.priceInr<100000||x.priceInr>1e9||
  !utc(x.priceAtUtc)||!utc(x.checkedAtUtc))return miss();
 const sourceAt=Date.parse(x.priceAtUtc),checkedAt=Date.parse(x.checkedAtUtc);
 if(sourceAt>now+15000||checkedAt>now+15000||
  now-sourceAt>(direct?90000:120000)||now-checkedAt>90000||
  checkedAt<sourceAt-15000)return miss();
 return {verified:true,priceInr:x.priceInr,provider:x.provider,
  quoteType:x.quoteType,sourceAtUtc:x.priceAtUtc,
  priceAgeSeconds:Math.round((now-sourceAt)/1000)};
}
