import {fetchPublicCoinDcxBtcInrTicker,parseCoinDcxBtcInrTicker}
 from './btcInrLivePrice.js';
try{
 const raw=await fetchPublicCoinDcxBtcInrTicker();
 const now=Date.now();
 const parsed=parseCoinDcxBtcInrTicker(raw,now);
 if(parsed.state!=='LIVE_LAST_TRADE')
  throw Error('LIVE_COIN_DCX_BTC_INR_INVALID_'+parsed.reason);
 console.log(JSON.stringify({
  status:'BTC_INR_COIN_DCX_LIVE_VERIFIED',
  symbol:parsed.symbol,currency:parsed.currency,
  lastTradeInr:parsed.lastTradeInr,
  exchangeTradeAtUtc:parsed.lastTradeAtUtc,
  checkedAtUtc:parsed.checkedAtUtc,
  provider:parsed.provider,
  kind:'SPOT_LAST_TRADE',
  paperOnly:parsed.paperOnly,realOrderPlaced:parsed.realOrderPlaced,
  orderSubmissionAllowed:parsed.orderSubmissionAllowed
 }));
}catch(e){
 console.error('BTC_INR_LIVE_PROBE_FAILED',String(e?.message??'UNAVAILABLE'));
 process.exitCode=1;
}
