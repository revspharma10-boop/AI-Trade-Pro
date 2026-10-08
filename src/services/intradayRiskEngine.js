// Instrument-specific risk diagnostics. Never submits orders or sets position size.
import {classifyIntradayInstrument} from './intradayInstrumentContract.js';
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>valid(n)&&n>0;
export function extractUpstoxQuoteEvidence(payload,instrumentKey,asOf=Date.now()){
  const data=payload?.data??payload;
  const entries=data&&typeof data==='object'?Object.values(data):[];
  const quote=entries.find(q=>q&&q.instrument_token===instrumentKey)||
     (entries.length===1&&(!entries[0]?.instrument_token||entries[0].instrument_token===instrumentKey)?entries[0]:null);
  const bid=Number(quote?.depth?.buy?.[0]?.price),ask=Number(quote?.depth?.sell?.[0]?.price);
  const stamp=quote?.timestamp;
  const timestamp=typeof stamp==='string'&&/^\d+$/.test(stamp)?Number(stamp):typeof stamp==='number'?stamp:Date.parse(stamp);
  const now=Number(new Date(asOf));
  const reasons=[];
  if(!quote)reasons.push('QUOTE_FOR_INSTRUMENT_UNAVAILABLE');
  if(!(bid>0&&ask>=bid))reasons.push('BID_ASK_DEPTH_UNAVAILABLE');
  if(!Number.isFinite(timestamp)||!Number.isFinite(now)||timestamp>now+10000||now-timestamp>120000)reasons.push('QUOTE_STALE_OR_UNDATED');
  const spreadPercent=bid>0&&ask>=bid?100*(ask-bid)/((ask+bid)/2):null;
  return {valid:reasons.length===0,bid:bid>0?bid:null,ask:ask>0?ask:null,spreadPercent:spreadPercent===null?null:Number(spreadPercent.toFixed(4)),timestamp:Number.isFinite(timestamp)?timestamp:null,reasons};
}
export function extractUpstoxLiveQuoteEvidence(payload,instrumentKey,asOf=Date.now()){
 const quote=payload?.quote??payload,now=Number(new Date(asOf));
 const bid=quote?.bid,ask=quote?.ask,timestamp=quote?.timestamp;
 const reasons=[];
 if(!quote||quote.instrumentKey!==instrumentKey)reasons.push('QUOTE_INSTRUMENT_MISMATCH');
 if(!(valid(bid)&&bid>0&&valid(ask)&&ask>=bid))reasons.push('BID_ASK_DEPTH_UNAVAILABLE');
 if(!valid(timestamp)||!valid(now)||timestamp>now+10000||now-timestamp>120000)reasons.push('QUOTE_STALE_OR_UNDATED');
 const spreadPercent=valid(bid)&&bid>0&&valid(ask)&&ask>=bid?
  Number((100*(ask-bid)/((ask+bid)/2)).toFixed(4)):null;
 const lastPrice=valid(quote?.lastPrice)&&quote.lastPrice>0?quote.lastPrice:null;
 if(lastPrice===null)reasons.push('LAST_TRADED_PRICE_UNAVAILABLE');
 return {valid:reasons.length===0,bid,ask,lastPrice,spreadPercent,timestamp,
  openInterest:valid(quote?.openInterest)?quote.openInterest:null,
  tradedVolume:valid(quote?.tradedVolume)?quote.tradedVolume:null,
  reasons:[...new Set(reasons)]};
}
export function assessIntradayInstrumentRisk({instrument={},quote={},research=null,asOf=Date.now(),
  openInterest=null,greeks=null,impliedVolatility=null,marginVerified=false,strategyDirection='LONG',deliveryRiskVerified=false,session=null}={}){
  const meta=classifyIntradayInstrument(instrument),reasons=[...meta.reasons];
  const now=Number(new Date(asOf));
  const spread=quote?.spreadPercent;
  if(!quote?.valid||!valid(spread))reasons.push('VERIFIED_LIVE_SPREAD_REQUIRED');
  const isCommodity=meta.segment==='MCX_FO';
  const isFuture=meta.kind==='FUTURE'||meta.kind==='COMMODITY_FUTURE';
  const maxSpread=meta.kind==='EQUITY'?0.25:isFuture?(isCommodity?0.5:0.35):(isCommodity?2:1.5);
  if(valid(spread)&&spread>maxSpread)reasons.push('EXCESSIVE_BID_ASK_SPREAD');
  if(!research?.valid)reasons.push('VALID_INTRADAY_RESEARCH_REQUIRED');
  if(research?.valid&&!research.snapshot?.liquidityResearchPass)reasons.push('INADEQUATE_RECENT_VOLUME_OR_TURNOVER');
  if(meta.kind!=='EQUITY'&&meta.kind!=='UNSUPPORTED'){
    const expiry=Date.parse(meta.expiry+'T15:30:00+05:30');
    const today=Number.isFinite(now)?new Date(now+330*60000).toISOString().slice(0,10):'';
    if(!meta.expiry||meta.expiry<today||(!isCommodity&&expiry<=now))reasons.push('CONTRACT_EXPIRED');
    if(isCommodity&&meta.expiry===today)reasons.push('MCX_EXPIRY_DAY_DELIVERY_RISK');

    if(!positive(openInterest))reasons.push('OPEN_INTEREST_NOT_VERIFIED');
  }
  if(isFuture&&!marginVerified)reasons.push('FUTURES_MARGIN_NOT_VERIFIED');
  if(isCommodity){
    if(!(meta.tickSize>0))reasons.push('MCX_TICK_SIZE_REQUIRED');
    if(!(meta.qtyMultiplier>0))reasons.push('MCX_QTY_MULTIPLIER_NOT_VERIFIED');
    if(!deliveryRiskVerified)reasons.push('MCX_DELIVERY_AND_TENDER_PERIOD_NOT_VERIFIED');
    if(!session||session.exchange!=='MCX'||!session.open)reasons.push('MCX_SESSION_NOT_VERIFIED_OPEN');
    if(session&&!session.holidayCalendarVerified)reasons.push('MCX_HOLIDAY_CALENDAR_NOT_VERIFIED');
    if(session&&!session.brokerSquareOffVerified)reasons.push('MCX_BROKER_SQUARE_OFF_NOT_VERIFIED');
  }
  if(meta.kind.includes('OPTION')){
    if(strategyDirection!=='LONG')reasons.push('UNCOVERED_OPTION_SHORT_NOT_SUPPORTED');
    if(!positive(impliedVolatility))reasons.push('OPTION_IV_NOT_VERIFIED');
    if(!greeks||!valid(greeks.delta)||!valid(greeks.gamma)||!valid(greeks.theta)||!valid(greeks.vega))
      reasons.push('OPTION_GREEKS_NOT_VERIFIED');
  }
  // This is only a risk-diagnostic gate. A validated strategy, backtest,
  // forward test, fee model and calibrated probability are separate requirements.
  return {valid:reasons.length===0,kind:meta.kind,reasons:[...new Set(reasons)],
    spreadPercent:valid(spread)?spread:null,marginVerified:Boolean(marginVerified),
    orderSubmissionAllowed:false,paperOnly:true,realOrderPlaced:false};
}
