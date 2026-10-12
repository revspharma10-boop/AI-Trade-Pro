// Read-only Nifty/Sensex index levels. Never imply a trade or current quote from stale data.
export function verifiedIndexQuote({tab,instrument,quote,asOf=Date.now()}={}){
 const key=tab==='nifty'?'NSE_INDEX|':'BSE_INDEX|';
 const fail={tab,state:'WAIT',price:null,sourceAtUtc:null,provider:'UPSTOX_READ_ONLY',
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false};
 const now=Number(new Date(asOf)),at=quote?.timestamp;
 if(!key||!['nifty','sensex'].includes(tab)||!instrument?.instrumentKey?.startsWith(key)||
  quote?.instrumentKey!==instrument.instrumentKey||quote.mode!=='READ_ONLY'||
  typeof quote.lastPrice!=='number'||!Number.isFinite(quote.lastPrice)||
  quote.lastPrice<1000||quote.lastPrice>200000||
  !Number.isFinite(now)||!Number.isFinite(at)||at>now+10000||now-at>90000)
  return fail;
 return {...fail,state:'LIVE_PRICE',price:quote.lastPrice,sourceAtUtc:new Date(at).toISOString()};
}
