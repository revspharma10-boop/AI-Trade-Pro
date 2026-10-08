// Deterministic research indicators. Not a qualified trading strategy.
// Uses completed same-day NSE candles only. Missing OHLCV is never imputed.
const round=(n,d=3)=>Number(n.toFixed(d));
const avg=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const tzDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
export const IST_MARKET_SESSION=Object.freeze({open:'09:15',close:'15:30',timeZone:'Asia/Kolkata'});
export function nseSessionState(now=Date.now()){
  const ms=Number(new Date(now));
  if(!Number.isFinite(ms))return {open:false,date:null,reason:'INVALID_CLOCK'};
  const ist=new Date(ms+330*60000);
  const weekday=ist.getUTCDay(),mins=ist.getUTCHours()*60+ist.getUTCMinutes();
  const open=weekday>=1&&weekday<=5&&mins>=555&&mins<930;
  return {open,date:tzDate(ms),minutesSinceMidnight:mins,reason:open?'SESSION_CLOCK_OPEN':'SESSION_CLOCK_CLOSED',holidayCalendarVerified:false};
}
function ema(values,period){
  if(values.length<period)return null;
  const weight=2/(period+1);let result=avg(values.slice(0,period));
  for(let i=period;i<values.length;i++)result=values[i]*weight+result*(1-weight);
  return result;
}
function emaSeries(values,period){
  if(values.length<period)return [];
  const result=Array(period-1).fill(null);let e=avg(values.slice(0,period));result.push(e);
  for(let i=period;i<values.length;i++){e=values[i]*2/(period+1)+e*(1-2/(period+1));result.push(e);}
  return result;
}
function rsi(values,period=14){
  if(values.length<period+1)return null;
  let gains=0,losses=0;
  for(let i=values.length-period;i<values.length;i++){const delta=values[i]-values[i-1];gains+=Math.max(0,delta);losses+=Math.max(0,-delta);}
  if(gains===0&&losses===0)return 50;
  if(losses===0)return 100;
  return 100-100/(1+gains/losses);
}
function macd(values){
  const e12=emaSeries(values,12),e26=emaSeries(values,26);
  const series=[];
  for(let i=25;i<values.length;i++)series.push(e12[i]-e26[i]);
  if(series.length<9)return null;
  const signal=ema(series,9),line=series.at(-1);
  return {line,signal,histogram:line-signal};
}
function atr(bars,period=14){
  if(bars.length<period+1)return null;
  const tr=[];
  for(let i=bars.length-period;i<bars.length;i++){
    const b=bars[i],prev=bars[i-1];
    tr.push(Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)));
  }
  return avg(tr);
}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;};
export function analyzeIntradayCandles(raw=[],{asOf=Date.now(),intervalMinutes=5,minBars=35}={}){
  const now=Number(new Date(asOf)),reasons=[];
  if(![1,5,15].includes(intervalMinutes))reasons.push('INVALID_INTERVAL');
  if(!Number.isFinite(now))reasons.push('INVALID_CLOCK');
  if(!Array.isArray(raw)||raw.length<minBars)reasons.push('INSUFFICIENT_INTRADAY_CANDLES');
  const original=Array.isArray(raw)?raw:[];
  const bars=[];
  for(const b of original){
    const timestamp=Date.parse(b?.datetime);
    if(!Number.isFinite(timestamp)||![b.open,b.high,b.low,b.close,b.volume].every(finite)||
       b.low<=0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||b.volume<0){
      reasons.push('INVALID_OHLCV');break;
    }
    bars.push({...b,timestamp});
  }
  if(reasons.includes('INVALID_OHLCV'))return {valid:false,reasons:[...new Set(reasons)],snapshot:null,completedBars:0};
  bars.sort((a,b)=>a.timestamp-b.timestamp);
  if(bars.some((b,i)=>i>0&&b.timestamp===bars[i-1].timestamp))reasons.push('DUPLICATE_CANDLE_TIMESTAMP');
  const date=Number.isFinite(now)?tzDate(now):null;
  const today=bars.filter(b=>tzDate(b.timestamp)===date);
  const intervalMs=intervalMinutes*60000;
  const completed=today.filter(b=>b.timestamp+intervalMs+10000<=now);
  const last=completed.at(-1);
  if(!last)reasons.push('NO_COMPLETED_TODAY_CANDLE');
  if(completed.length<minBars)reasons.push('INSUFFICIENT_COMPLETED_TODAY_CANDLES');
  if(last&&(now-(last.timestamp+intervalMs)>intervalMs+120000))reasons.push('STALE_INTRADAY_CANDLES');
  const state=nseSessionState(now);
  if(!state.open)reasons.push(state.reason);
  // Holiday calendars are not verified: never assert exchange holiday validation.
  if(reasons.length)return {valid:false,reasons:[...new Set(reasons)],snapshot:null,completedBars:completed.length,latestCompletedAt:last?.datetime??null,session:state};
  const closes=completed.map(b=>b.close),lastClose=closes.at(-1);
  const ema9=ema(closes,9),ema21=ema(closes,21),rsi14=rsi(closes),macdValues=macd(closes),atr14=atr(completed);
  const totalVolume=completed.reduce((s,b)=>s+b.volume,0);
  const vwap=totalVolume?completed.reduce((s,b)=>s+((b.high+b.low+b.close)/3)*b.volume,0)/totalVolume:null;
  const previousVolumes=completed.slice(-21,-1).map(b=>b.volume);
  const medianVolume20=median(previousVolumes);
  const lastVolumeRatio=medianVolume20>0?last.volume/medianVolume20:null;
  const averageTurnover20=avg(completed.slice(-20).map(b=>b.close*b.volume));
  const liquidityResearchPass=medianVolume20>=1000&&averageTurnover20>=1000000&&lastVolumeRatio>=0.3;
  const bullish=lastClose>vwap&&ema9>ema21&&rsi14>=55&&macdValues.histogram>0;
  const bearish=lastClose<vwap&&ema9<ema21&&rsi14<=45&&macdValues.histogram<0;
  const bias=bullish?'BULLISH':bearish?'BEARISH':'MIXED';
  const snapshot={
    lastCompletedAt:last.datetime,intervalMinutes,close:round(lastClose),ema9:round(ema9),ema21:round(ema21),
    rsi14:round(rsi14),macdHistogram:round(macdValues.histogram,5),vwap:vwap===null?null:round(vwap),
    atr14:round(atr14),medianVolume20:round(medianVolume20),lastVolumeRatio:lastVolumeRatio===null?null:round(lastVolumeRatio),
    averageTurnover20:round(averageTurnover20),liquidityResearchPass,bias
  };
  return {valid:true,reasons:[],snapshot,completedBars:completed.length,session:state,
    evidence:['Completed '+intervalMinutes+'m candles: '+completed.length,'Close '+snapshot.close+'; VWAP '+snapshot.vwap,
      'EMA9 '+snapshot.ema9+'; EMA21 '+snapshot.ema21,'RSI14 '+snapshot.rsi14+'; MACD histogram '+snapshot.macdHistogram,
      'ATR14 '+snapshot.atr14+'; last/median volume '+(snapshot.lastVolumeRatio??'N/A')+'x']};
}
