// Browser-only read-only quote refresh policy. Does not execute orders, refresh models or invent prices.
export const MARKET_QUOTE_POLL_MS=30000;
export const MARKET_QUOTE_MAX_AGE_MS=120000;
export const MARKET_QUOTE_SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function mayPollMarketQuote({visible=true,session=null,hasInstrument=false,alreadyRunning=false}={}){
 return visible===true&&session?.open===true&&hasInstrument===true&&alreadyRunning!==true;
}
export function assessMarketQuote({quote=null,expectedInstrumentKey='',asOf=Date.now(),option=false}={}){
 const now=Number(new Date(asOf)),timestamp=quote?.timestamp;
 const base={state:'UNAVAILABLE',fresh:false,lastPrice:null,bid:null,ask:null,quoteAt:null,lastTradeAt:null,
   ageMs:null,reason:'MARKET_QUOTE_UNAVAILABLE',...MARKET_QUOTE_SAFETY};
 if(!quote||!expectedInstrumentKey||quote.instrumentKey!==expectedInstrumentKey||
    !finite(now)||!finite(timestamp)||!finite(quote.lastPrice)||quote.lastPrice<=0)
  return {...base,reason:'UNVERIFIED_QUOTE_OR_INSTRUMENT'};
 if(timestamp>now+10000||now-timestamp>MARKET_QUOTE_MAX_AGE_MS)
  return {...base,state:'STALE',quoteAt:timestamp,ageMs:now-timestamp,reason:'BROKER_QUOTE_STALE'};
 const output={...base,state:'FRESH',fresh:true,lastPrice:quote.lastPrice,bid:null,ask:null,
  quoteAt:timestamp,ageMs:Math.max(0,now-timestamp),reason:'QUOTE_FRESH'};
 if(option){
  const lastTradeAt=quote?.lastTradeTime;
  if(!finite(lastTradeAt)||lastTradeAt>now+10000||now-lastTradeAt>MARKET_QUOTE_MAX_AGE_MS||
    !finite(quote.bid)||quote.bid<=0||!finite(quote.ask)||quote.ask<=0||quote.ask<quote.bid)
   return {...base,state:'STALE',quoteAt:timestamp,ageMs:now-timestamp,
    reason:'OPTION_LAST_TRADE_OR_BID_ASK_STALE'};
  output.bid=quote.bid;output.ask=quote.ask;output.lastTradeAt=lastTradeAt;
 }
 return output;
}
