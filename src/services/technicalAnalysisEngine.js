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

function vwap(candles,period=20){const x=candles.slice(-period);let pv=0,v=0;for(const q of x){if(Number.isFinite(q.volume)&&q.volume>0){pv+=((q.high+q.low+q.close)/3)*q.volume;v+=q.volume;}}return v?pv/v:null;}
function adx(candles,period=14){if(candles.length<=period)return null;let tr=0,pdm=0,mdm=0;for(let i=candles.length-period;i<candles.length;i++){const q=candles[i],p=candles[i-1],up=q.high-p.high,down=p.low-q.low;tr+=Math.max(q.high-q.low,Math.abs(q.high-p.close),Math.abs(q.low-p.close));pdm+=up>down&&up>0?up:0;mdm+=down>up&&down>0?down:0;}if(!tr)return 0;const pdi=100*pdm/tr,mdi=100*mdm/tr,sum=pdi+mdi;return sum?100*Math.abs(pdi-mdi)/sum:0;}
function supertrendDirection(candles,period=10,mult=3){const a=atr(candles,period);if(!a)return null;const last=candles.at(-1),mid=(last.high+last.low)/2;return {direction:last.close>=mid-mult*a?'BULLISH':'BEARISH',band:last.close>=mid-mult*a?mid-mult*a:mid+mult*a};}
function candleScore(candles){const q=candles.at(-1),p=candles.at(-2),body=Math.abs(q.close-q.open),range=Math.max(q.high-q.low,Number.EPSILON),bull=q.close>q.open;let s=bull?65:35;if(bull&&q.close>p.high)s+=20;if(!bull&&q.close<p.low)s-=20;if(body/range<.2)s=50;return clamp(s);}

export function analyzeTechnicalHistory(values=[]){
  const c=normalize(values);
  if(c.length<55)return {valid:false,reasons:['MINIMUM_55_CANDLES_REQUIRED'],scores:null,levels:null,evidence:[]};
  const closes=c.map(x=>x.close), last=c.at(-1), e20=ema(closes,20),e50=ema(closes,50),r=rsi(closes),a=atr(c);
  const recent=c.slice(-20), support=Math.min(...recent.map(x=>x.low)), resistance=Math.max(...recent.map(x=>x.high));
  const vols=recent.map(x=>x.volume).filter(Number.isFinite), volumeAvg=avg(vols.slice(0,-1)), volumeRatio=Number.isFinite(last.volume)&&volumeAvg>0?last.volume/volumeAvg:null;
  const momentum=((last.close/closes.at(-11))-1)*100;
  const atrPct=a/last.close*100;
  const adx14=adx(c), vw=vwap(c), st=supertrendDirection(c), candle=candleScore(c);
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
    snapshot:{close:round(last.close),ema20:round(e20),ema50:round(e50),rsi14:round(r),atr14:round(a),atrPercent:round(atrPct),adx14:round(adx14),vwap20:vw===null?null:round(vw),supertrend:st?.direction||'UNKNOWN',supertrendBand:st?round(st.band):null,momentum10:round(momentum),volumeRatio:volumeRatio===null?null:round(volumeRatio),support20:round(support),resistance20:round(resistance)},
    scores:{trend:trendScore,momentum:momentumScore,adx:round(clamp(adx14)),supertrend:st?.direction==='BULLISH'?85:25,volume:round(volumeScore),candlestick:candle,chartPattern:50,supportResistance:srScore,vwap:vw===null?50:(last.close>vw?80:35),atr:volatilityScore},
    levels:{entryZone:{low:round(entryLow),high:round(entryHigh)},stopLoss:round(stopLoss),targets:[round(target1),round(target2)],riskRewardRatio:round(rr)},
    gates:{technicalConfirmation:bullish&&r>=45,stopLossValid:stopLoss>0&&stopLoss<entryLow,volatilityAcceptable:atrPct<=5},
    evidence:[`Close ${round(last.close)} vs EMA20 ${round(e20)} / EMA50 ${round(e50)}`,`RSI(14) ${round(r)}; 10-period momentum ${round(momentum)}%`,`ATR(14) ${round(a)} (${round(atrPct)}%); ADX(14) ${round(adx14)}`,`VWAP(20) ${vw===null?'unavailable':round(vw)}; Supertrend ${st?.direction||'UNKNOWN'}`,`20-period support ${round(support)} / resistance ${round(resistance)}`,volumeRatio===null?'Volume evidence unavailable':`Latest volume ${round(volumeRatio)}x recent average`]
  };
}
