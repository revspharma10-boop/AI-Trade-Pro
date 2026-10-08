import { classifyIntradayInstrument } from './intradayInstrumentContract.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function evaluateIntradayRecommendation({instrument={},candles=[],sessionOpen=false,asOf=Date.now(),spreadPercent,minimumBars=30}={}){
 const meta=classifyIntradayInstrument(instrument), reasons=[...meta.reasons];
 if(!sessionOpen)reasons.push('MARKET_SESSION_CLOSED');
 if(!Array.isArray(candles)||candles.length<minimumBars)reasons.push('INSUFFICIENT_INTRADAY_CANDLES');
 const bars=Array.isArray(candles)?candles:[];
 const valid=bars.every(b=>finite(b.open)&&finite(b.high)&&finite(b.low)&&finite(b.close)&&finite(b.volume)&&b.volume>=0&&b.low>0&&b.low<=b.high&&b.close>=b.low&&b.close<=b.high&&Number.isFinite(Date.parse(b.datetime)));
 if(!valid)reasons.push('INVALID_OHLCV');
 const last=bars.at(-1);
 if(last&&(!Number.isFinite(asOf)||asOf-Date.parse(last.datetime)>120000||Date.parse(last.datetime)>asOf+10000))reasons.push('STALE_OR_FUTURE_CANDLE');
 if(!finite(spreadPercent)||spreadPercent<0||spreadPercent>0.2)reasons.push('SPREAD_NOT_VERIFIED');
 if(meta.kind!=='EQUITY')reasons.push('DERIVATIVE_RISK_ENGINE_NOT_QUALIFIED');
 if(valid&&bars.length>=minimumBars){const volume=bars.slice(-20).reduce((s,b)=>s+b.volume,0);if(volume<=0)reasons.push('NO_VERIFIED_VOLUME');}
 // No BUY/SELL without independently qualified strategy, calibrated outcomes and risk controls.
 reasons.push('STRATEGY_NOT_BACKTESTED_AND_FORWARD_VALIDATED');
 return {symbol:meta.symbol,kind:meta.kind,recommendation:'WAIT',confidence:null,estimatedSuccessProbability:null,entry:null,stopLoss:null,targets:[],reasons:[...new Set(reasons)],paperOnly:true,orderSubmissionAllowed:false};
}
