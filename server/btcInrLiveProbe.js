// Read-only live source probe. It reports the selected INR source, NEVER
// claims a quote with missing/old exchange evidence is current.
import {fetchPublicCoinDcxBtcInrTicker,parseCoinDcxBtcInrTicker,
 fetchPublicCoinGeckoBtcInr,parseCoinGeckoBtcInrPrice,
 fetchPublicCoinPaprikaBtcInr,parseCoinPaprikaBtcInrPrice}
 from './btcInrLivePrice.js';
const checks=await Promise.allSettled([
 fetchPublicCoinDcxBtcInrTicker(),fetchPublicCoinGeckoBtcInr(),
 fetchPublicCoinPaprikaBtcInr()
]);
const now=Date.now();
const direct=checks[0].status==='fulfilled'?
 parseCoinDcxBtcInrTicker(checks[0].value,now):null;
const indicative=checks[1].status==='fulfilled'?
 parseCoinGeckoBtcInrPrice(checks[1].value,now):null;
const paprika=checks[2].status==='fulfilled'?
 parseCoinPaprikaBtcInrPrice(checks[2].value,now):null;
const valid=direct?.state==='LIVE_PRICE'?direct:
 indicative?.state==='LIVE_PRICE'?indicative:
 paprika?.state==='LIVE_PRICE'?paprika:null;
if(!valid){
 console.error('BTC_INR_LIVE_PROBE_FAILED',JSON.stringify({
  direct:direct?.reason??'NETWORK_UNAVAILABLE',
  indicative:indicative?.reason??'NETWORK_UNAVAILABLE',
  paprika:paprika?.reason??'NETWORK_UNAVAILABLE'
 }));
 process.exitCode=1;
}else{
 console.log(JSON.stringify({
  status:'BTC_INR_PUBLIC_LIVE_VERIFIED',symbol:valid.symbol,currency:valid.currency,
  priceInr:valid.priceInr,priceAtUtc:valid.priceAtUtc,
  checkedAtUtc:valid.checkedAtUtc,provider:valid.provider,
  quoteType:valid.quoteType,coindcxDirectStatus:direct?.state??'NETWORK_UNAVAILABLE',
  coinGeckoStatus:indicative?.state??'NETWORK_UNAVAILABLE',
  coinPaprikaStatus:paprika?.state??'NETWORK_UNAVAILABLE',
  paperOnly:valid.paperOnly,realOrderPlaced:valid.realOrderPlaced,
  orderSubmissionAllowed:valid.orderSubmissionAllowed
 }));
}
