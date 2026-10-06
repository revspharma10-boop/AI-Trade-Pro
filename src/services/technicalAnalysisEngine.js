// AI TRADE PRO — DETERMINISTIC TECHNICAL ANALYSIS ENGINE
// Input: chronological or reverse-chronological OHLCV candles.
// Output: evidence + candidate levels only. No broker execution.

const num=v=>Number(v);
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const clamp=v=>Math.max(0,Math.min(100,v));

function normalize(values=[]){
  return values.map(x=>({datetime:String(x.datetime||''),open:num(x.open),high:num(x.high),low:num(x.low),close:num(x.close),volume:num(x.volume)}))
    .filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)&&x.close>0)
    .sort((a,b)=>String(a.datetime).localeCompare(String(b.datetime)));
}
function ema(values,period){
  if(values.length<period)return null;
  const k=2/(period+1); let e=avg(values.slice(0,period));
  for(const v of values.slice(period))e=v*k+e*(1-k);
  return e;
}
function rsi(values,period=14){
  if(values.length<=period)return null;
  let gains=0,losses=0;
  for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1]; if(d>=0)gains+=d;else losses-=d;}
  if(losses===0)return 100; const rs=(gains/period)/(losses/period); return 100-(100/(1+rs));
}
function atr(candles,period=14){
  if(candles.length<=period)return null; const trs=[];
  for(let i=candles.length-period;i<candles.length;i++){const c=candles[i],p=candles[i-1];trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
  return avg(trs);
}
export function analyzeTechnicalHistory(values=[]){
  const c=normalize(values);
  if(c.length<55)return {valid:false,reasons:['MINIMUM_55_CANDLES_REQUIRED'],scores:null,levels:null,evidence:[]};
  const closes=c.map(x=>x.close), last=c.at(-1), e20=ema(closes,20),e50=ema(closes,50),r=rsi(closes),a=atr(c);
  const recent=c.slice(-20), support=Math.min(...recent.map(x=>x.low)), resistance=Math.max(...recent.map(x=>x.high));
  const vols=recent.map(x=>x.volume).filter(Number.isFinite), volumeAvg=avg(vols.slice(0,-1)), volumeRatio=Number.isFinite(last.volume)&&volumeAvg>0?last.volume/volumeAvg:null;
  const momentum=((last.close/closes.at(-11))-1)*100;
  const atrPct=a/last.close*100;
  const bullish=last.close>e20&&e20>e50;
  const trendScore=bullish?90:last.close>e50?65:35;
  const momentumScore=r>=50&&r<=70?85:r>70?60:r>=40?55:30;
  const volumeScore=volumeRatio===null?50:clamp(50+(volumeRatio-1)*50);
  const volatilityScore=atrPct<=3?80:atrPct<=5?60:35;
  const srScore=last.close>support&&last.close<=resistance?75:50;
  const entryLow=Math.max(support,last.close-a*0.25), entryHigh=last.close+a*0.15;
  const stopLoss=Math.min(support-a*0.15,entryLow-a);
  const risk=Math.max(entryLow-stopLoss,a*0.5);
  const target1=entryHigh+risk*1.5,target2=entryHigh+risk*2;
  const rr=(target2-entryHigh)/(entryHigh-stopLoss);
  return {
    valid:true,
    snapshot:{close:round(last.close),ema20:round(e20),ema50:round(e50),rsi14:round(r),atr14:round(a),atrPercent:round(atrPct),momentum10:round(momentum),volumeRatio:volumeRatio===null?null:round(volumeRatio),support20:round(support),resistance20:round(resistance)},
    scores:{trend:trendScore,momentum:momentumScore,adx:50,supertrend:bullish?80:40,volume:round(volumeScore),candlestick:50,chartPattern:50,supportResistance:srScore,vwap:50,atr:volatilityScore},
    levels:{entryZone:{low:round(entryLow),high:round(entryHigh)},stopLoss:round(stopLoss),targets:[round(target1),round(target2)],riskRewardRatio:round(rr)},
    gates:{technicalConfirmation:bullish&&r>=45,stopLossValid:stopLoss>0&&stopLoss<entryLow,volatilityAcceptable:atrPct<=5},
    evidence:[`Close ${round(last.close)} vs EMA20 ${round(e20)} / EMA50 ${round(e50)}`,`RSI(14) ${round(r)}; 10-period momentum ${round(momentum)}%`,`ATR(14) ${round(a)} (${round(atrPct)}%)`,`20-period support ${round(support)} / resistance ${round(resistance)}`,volumeRatio===null?'Volume evidence unavailable':`Latest volume ${round(volumeRatio)}x recent average`]
  };
}
