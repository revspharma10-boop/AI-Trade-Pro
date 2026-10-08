// A conservative, deterministic directional RESEARCH signal — NOT trade authorization.
// Never places orders, estimates win probability, or invents entry/stop/target prices.
import { classifyIntradayInstrument } from './intradayInstrumentContract.js';

const finite=x=>typeof x==='number'&&Number.isFinite(x);
const validPositive=x=>finite(x)&&x>0;
const utcIstDay=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
export const PAPER_SIGNAL_VERSION='PAPER_DIRECTION_V1_2026_10';
export const PAPER_SIGNAL_SAFETY=Object.freeze({
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
  productionRealTradingEnabled:false,strategyBacktested:false
});
export function deriveIntradayPaperSignal({instrument={},research=null,quote=null,session=null,asOf=Date.now()}={}){
  const meta=classifyIntradayInstrument(instrument);
  const now=Number(new Date(asOf)),s=research?.snapshot??null;
  const blocks=[...meta.reasons];
  const conditions=[];
  if(!['EQUITY','FUTURE','COMMODITY_FUTURE'].includes(meta.kind))
    blocks.push('PAPER_SIGNAL_INSTRUMENT_NOT_SUPPORTED');
  if(!finite(now)||!session?.open)blocks.push('SESSION_NOT_OPEN_FOR_PAPER_SIGNAL');
  if(!research?.valid||!s||research.completedBars<35)blocks.push('VALID_COMPLETED_CANDLES_REQUIRED');
  if(!quote?.valid||!validPositive(quote.lastPrice))blocks.push('FRESH_LIVE_QUOTE_REQUIRED');
  const actualQuoteTime=quote?.timestamp,actualTradeTime=quote?.lastTradeTime;
  if(!finite(actualQuoteTime)||!finite(actualTradeTime)||!finite(now)||
    actualQuoteTime>now+10000||actualTradeTime>now+10000||
    now-actualQuoteTime>120000||now-actualTradeTime>120000)
    blocks.push('QUOTE_OR_LAST_TRADE_STALE');
  const spread=quote?.spreadPercent;
  const maxSpread=meta.kind==='EQUITY'?0.25:meta.kind==='FUTURE'?0.35:0.5;
  if(!finite(spread)||spread<0||spread>maxSpread)blocks.push('SPREAD_TOO_WIDE_OR_UNKNOWN');
  if(meta.kind!=='EQUITY'){
    const today=finite(now)?utcIstDay(now):'9999-12-31';
    if(!meta.expiry||meta.expiry<=today)blocks.push('FUTURE_EXPIRED_OR_EXPIRY_DAY');
    if(!validPositive(meta.lotSize))blocks.push('FUTURE_LOT_NOT_VERIFIED');
  }
  // Require credible volume and turnover for research. MCX lots need exchange-
  // appropriate volume thresholds, not an NSE-equity 1000-share absolute floor.
  if(s&&!s.liquidityResearchPass)blocks.push('RESEARCH_LIQUIDITY_THRESHOLD_NOT_MET');
  if(s&&(!validPositive(s.atr14)||!validPositive(s.vwap)||!validPositive(s.ema9)||
         !validPositive(s.ema21)||!validPositive(s.close)||
         !finite(s.rsi14)||!finite(s.macdHistogram)))
    blocks.push('TECHNICAL_INPUTS_NOT_VERIFIED');
  if(s&&validPositive(s.atr14)&&validPositive(s.close)&&validPositive(quote?.lastPrice)&&
    Math.abs(s.close-quote.lastPrice)>Math.max(3*s.atr14,0.015*s.close))
    blocks.push('CANDLE_AND_LIVE_PRICE_DISAGREE');
  const bullish=!!s&&s.bias==='BULLISH'&&s.close>s.vwap&&s.ema9>s.ema21&&
    s.rsi14>=55&&s.rsi14<=75&&s.macdHistogram>0;
  const bearish=!!s&&s.bias==='BEARISH'&&s.close<s.vwap&&s.ema9<s.ema21&&
    s.rsi14<=45&&s.rsi14>=25&&s.macdHistogram<0;
  if(!bullish&&!bearish)blocks.push('NO_CLEAR_BUY_OR_SELL_SETUP');
  const direction=blocks.length?'WAIT':bullish?'BUY':'SELL';
  if(direction!=='WAIT'){
    conditions.push('EMA9 '+(bullish?'above':'below')+' EMA21');
    conditions.push('Completed candle close '+(bullish?'above':'below')+' VWAP');
    conditions.push('RSI14 '+s.rsi14+' in research range');
    conditions.push('MACD histogram '+(bullish?'positive':'negative'));
    conditions.push('Fresh quote, last trade and spread checked');
    conditions.push('Preliminary volume threshold met');
  }
  return {
    version:PAPER_SIGNAL_VERSION,
    direction,status:direction==='WAIT'?'BLOCKED':'PROVISIONAL_UNVALIDATED',
    explanation:direction==='WAIT'?'No qualified directional research setup.':
      'Technical '+direction+' research candidate only; NOT a trading instruction.',
    conditions,blocks:[...new Set(blocks)],
    observedLastPrice:direction==='WAIT'?null:quote.lastPrice,
    observedAt:direction==='WAIT'?null:new Date(now).toISOString(),
    expiresInSeconds:direction==='WAIT'?null:120,
    backtested:false,forwardValidated:false,winProbability:null,
    entry:null,stopLoss:null,targets:[],
    paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
    productionRealTradingEnabled:false
  };
}
