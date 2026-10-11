// Versioned, deterministic 5m + 1h BTC/USD research using ONLY completed
// 5-minute public candles. No trade qualification or executable crypto orders.
// Thresholds are research hypotheses, not calibrated confidence or profit claims.
export const BTC_CONFLUENCE_VERSION='btc-mtf-confluence-v1';
export const BTC_MIN_COMPLETED_BARS=360; // 30 hours: full 1h EMA history + 24h VWAP
const F=300000,H=3600000;
const pos=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const rounded=x=>Number(x.toFixed(2));
const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
function ema(values,n){
 if(values.length<n||values.some(x=>!pos(x)))return null;
 let value=mean(values.slice(0,n)),k=2/(n+1);
 for(let i=n;i<values.length;i++)value=values[i]*k+value*(1-k);
 return value;
}
function emaAny(values,n){
 if(values.length<n||values.some(x=>typeof x!=='number'||!Number.isFinite(x)))return null;
 let v=mean(values.slice(0,n)),k=2/(n+1);
 for(let i=n;i<values.length;i++)v=values[i]*k+v*(1-k);
 return v;
}
function emaSeries(values,n){
 if(values.length<n)return [];
 let v=mean(values.slice(0,n)),out=[v],k=2/(n+1);
 for(let i=n;i<values.length;i++){v=values[i]*k+v*(1-k);out.push(v);}
 return out;
}
function rsi(closes,n=14){
 if(closes.length<n+2)return null;
 let gains=0,losses=0;
 for(let i=1;i<=n;i++){const d=closes[i]-closes[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0);}
 gains/=n;losses/=n;
 for(let i=n+1;i<closes.length;i++){
  const d=closes[i]-closes[i-1];
  gains=(gains*(n-1)+Math.max(d,0))/n;
  losses=(losses*(n-1)+Math.max(-d,0))/n;
 }
 return gains===0&&losses===0?50:losses===0?100:gains===0?0:100-100/(1+gains/losses);
}
function atr(bars,n=14){
 if(bars.length<n+1)return null;
 const tr=[];
 for(let i=1;i<bars.length;i++)tr.push(Math.max(bars[i].high-bars[i].low,
   Math.abs(bars[i].high-bars[i-1].close),
   Math.abs(bars[i].low-bars[i-1].close)));
 let v=mean(tr.slice(0,n));
 for(let i=n;i<tr.length;i++)v=(v*(n-1)+tr[i])/n;
 return v;
}
function completedHours(bars){
 const map=new Map();
 for(const x of bars){
  const hour=Math.floor(x.time/H)*H;
  if(!map.has(hour))map.set(hour,[]);
  map.get(hour).push(x);
 }
 return [...map].filter(([hour,group])=>group.length===12&&
  group[0].time===hour&&group.every((c,i)=>c.time===hour+i*F))
  .map(([hour,group])=>({time:hour,close:group[11].close}));
}
const no=(reason,checks=[],metrics=null)=>({
 status:'WAIT',direction:'WAIT',reason,strength:'UNQUALIFIED',
 strategyVersion:BTC_CONFLUENCE_VERSION,checks,metrics,
 paperLevels:null,optionPlanQualified:false,orderSubmissionAllowed:false,
 realOrderPlaced:false
});
export function evaluateBtcTechnicalConfluence({candles=[],asOf=Date.now()}={}){
 const now=Number(new Date(asOf));
 if(!Number.isFinite(now)||!Array.isArray(candles)||candles.length<BTC_MIN_COMPLETED_BARS)
  return no('CRYPTO_TECHNICAL_HISTORY_INSUFFICIENT');
 const bars=candles.slice(-BTC_MIN_COMPLETED_BARS);
 const epoch=Math.floor(now/F)*F;
 if(now-epoch<12000||bars.at(-1).time!==epoch-F||
    bars.some((c,i)=>!c||!Number.isFinite(c.time)||
     c.time!==epoch-BTC_MIN_COMPLETED_BARS*F+i*F||
     ![c.open,c.high,c.low,c.close].every(pos)||
     c.low>c.high||c.open<c.low||c.open>c.high||
     c.close<c.low||c.close>c.high||
     !Number.isFinite(c.volume)||c.volume<0||
     !Number.isSafeInteger(c.trades)||c.trades<0))
  return no('CRYPTO_TECHNICAL_HISTORY_INVALID');
 const closes=bars.map(x=>x.close);
 const last=bars.at(-1),previous=bars.slice(-13,-1),
  rangeHigh=Math.max(...previous.map(x=>x.high)),
  rangeLow=Math.min(...previous.map(x=>x.low));
 const fast=ema(closes,21),slow=ema(closes,50);
 const momentum=rsi(closes,14),volatility=atr(bars,14);
 const ema12=emaSeries(closes,12),ema26=emaSeries(closes,26);
 // Both EMA streams are aligned at the original candle index.
 const macd=ema12.slice(14).map((value,i)=>value-ema26[i]);
 const macdSignal=emaAny(macd,9);
 const histogram=macd.at(-1)-macdSignal;
 const hourCloses=completedHours(bars).map(x=>x.close);
 if(hourCloses.length<21)return no('CRYPTO_HOURLY_HISTORY_INSUFFICIENT');
 const hour9=ema(hourCloses,9),hour21=ema(hourCloses,21);
 const lastDay=bars.slice(-288),totalVolume=lastDay.reduce((v,x)=>v+x.volume,0);
 if(!(totalVolume>0))return no('CRYPTO_VOLUME_HISTORY_UNAVAILABLE');
 // OHLC typical price used as a 24h VWAP approximation, not true trade VWAP.
 const approxVwap=lastDay.reduce((sum,x)=>
  sum+(x.high+x.low+x.close)/3*x.volume,0)/totalVolume;
 const averageVolume=mean(bars.slice(-21,-1).map(x=>x.volume));
 if(!(averageVolume>0)||!pos(volatility)||!pos(fast)||!pos(slow)||
    !Number.isFinite(momentum)||!Number.isFinite(histogram))
  return no('CRYPTO_INDICATOR_INPUT_INVALID');
 const buffer=Math.max(volatility*0.12,last.close*0.0001);
 const up=last.close>rangeHigh+buffer&&last.close>last.open;
 const down=last.close<rangeLow-buffer&&last.close<last.open;
 if(!up&&!down)return no('CRYPTO_NO_CONFIRMED_HOURLY_RANGE_BREAKOUT');
 const direction=up?'BULLISH':'BEARISH',bullish=direction==='BULLISH';
 const volumeMultiple=last.volume/averageVolume;
 const volatilityPct=100*volatility/last.close;
 const checks=[
  {code:'COMPLETED_1H_STRUCTURE',pass:true},
  {code:'VOLUME_CONFIRMATION',pass:last.trades>0&&volumeMultiple>=1.2},
  {code:'FIVE_MINUTE_EMA_TREND',pass:bullish?fast>slow&&last.close>fast:fast<slow&&last.close<fast},
  {code:'ONE_HOUR_EMA_TREND',pass:bullish?hour9>hour21:hour9<hour21},
  {code:'RSI_MOMENTUM_WINDOW',pass:bullish?momentum>=54&&momentum<=75:momentum>=25&&momentum<=46},
  {code:'MACD_HISTOGRAM_DIRECTION',pass:bullish?histogram>0:histogram<0},
  {code:'LAST_24H_VOLUME_WEIGHTED_PRICE',pass:bullish?last.close>approxVwap:last.close<approxVwap},
  {code:'VOLATILITY_AND_NO_CHASE',pass:volatilityPct>=0.03&&volatilityPct<=2.0&&
    Math.abs(last.close-fast)<=4*volatility}
 ];
 const metrics={
  ema21:rounded(fast),ema50:rounded(slow),hourEma9:rounded(hour9),
  hourEma21:rounded(hour21),rsi14:rounded(momentum),
  macdHistogram:rounded(histogram),atr14:rounded(volatility),
  atrPct:rounded(volatilityPct),vwap24hApprox:rounded(approxVwap),
  volumeMultiple:rounded(volumeMultiple),rangeHigh:rounded(rangeHigh),
  rangeLow:rounded(rangeLow),lastCompletedClose:rounded(last.close),
  completedCandleTime:new Date(last.time).toISOString(),
  completedCandleEnd:new Date(epoch).toISOString()
 };
 if(checks.some(c=>!c.pass))
  return no('CRYPTO_TECHNICAL_CONFLUENCE_NOT_MET',checks,metrics);
 const risk=1.5*volatility,entry=last.close;
 // Deliberately illustrative only: no bid/ask, fees, slippage, funding,
 // position sizing, margin or INR/USD conversion has been verified.
 const paperLevels={
  currency:'USD',type:'ILLUSTRATIVE_UNEXECUTABLE_ATR_LEVELS',
  referenceClose:rounded(entry),
  invalidation:rounded(entry+(bullish?-risk:risk)),
  target1:rounded(entry+(bullish?risk:-risk)),
  target2:rounded(entry+(bullish?2*risk:-2*risk)),
  target3:rounded(entry+(bullish?3*risk:-3*risk)),
  executed:false,approvedQuantity:0,feesVerified:false,
  bidAskVerified:false,slippageVerified:false,marginVerified:false
 };
 if(![paperLevels.referenceClose,paperLevels.invalidation,
  paperLevels.target1,paperLevels.target2,paperLevels.target3].every(pos))
  return no('CRYPTO_ILLUSTRATIVE_LEVELS_INVALID',checks,metrics);
 return {status:'HIGH_CONFLUENCE_DIRECTION',direction,strength:'HIGH_CONFLUENCE_UNVALIDATED',
  strategyVersion:BTC_CONFLUENCE_VERSION,reason:'ALL_EIGHT_TECHNICAL_CHECKS_PASSED',
  checks,metrics,paperLevels,
  optionPlanQualified:false,orderSubmissionAllowed:false,realOrderPlaced:false};
}
