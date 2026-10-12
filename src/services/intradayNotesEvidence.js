// Supplementary completed-candle evidence. Not a standalone trade signal.
const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
const ema=(values,n)=>{if(values.length<n)return null;let x=mean(values.slice(0,n));for(let i=n;i<values.length;i++)x=(2*values[i]+(n-1)*x)/(n+1);return x;};
const round=x=>Math.round(x*1000)/1000;
export function intradayNotesEvidence(bars=[]){
 if(!Array.isArray(bars)||bars.length<2||bars.some(b=>![b.open,b.high,b.low,b.close,b.volume].every(x=>typeof x==='number'&&Number.isFinite(x))||b.low<=0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||b.volume<0))
  return {status:'WAIT',reason:'INVALID_OR_INSUFFICIENT_CANDLES'};
 const closes=bars.map(b=>b.close),last=bars.at(-1),prev=bars.at(-2);
 const body=last.close-last.open,upperWick=last.high-Math.max(last.open,last.close);
 const lowerWick=Math.min(last.open,last.close)-last.low;
 const size=Math.abs(body),span=last.high-last.low;
 const engulfBull=prev.close<prev.open&&last.close>last.open&&last.open<=prev.close&&last.close>=prev.open;
 const engulfBear=prev.close>prev.open&&last.close<last.open&&last.open>=prev.close&&last.close<=prev.open;
 const pattern=engulfBull?'BULLISH_ENGULFING':engulfBear?'BEARISH_ENGULFING':
  span>0&&lowerWick>=2*Math.max(size,span*.05)&&upperWick<=span*.2?'HAMMER':
  span>0&&upperWick>=2*Math.max(size,span*.05)&&lowerWick<=span*.2?'SHOOTING_STAR':'NONE';
 const e9=ema(closes,9),e20=ema(closes,20),e50=ema(closes,50),e200=ema(closes,200);
 const stack=[e9,e20,e50].every(x=>x!==null)?e9>e20&&e20>e50?'BULLISH':e9<e20&&e20<e50?'BEARISH':'MIXED':'INSUFFICIENT_DATA';
 const prior=bars.slice(-21,-1),volumeAverage20=prior.length===20?mean(prior.map(b=>b.volume)):null;
 const ratio=volumeAverage20>0?last.volume/volumeAverage20:null;
 const highs=bars.slice(-4).map(b=>b.high),lows=bars.slice(-4).map(b=>b.low);
 const structure=bars.length>=4&&highs[2]>highs[0]&&highs[3]>highs[1]&&lows[2]>lows[0]&&lows[3]>lows[1]?'HH_HL':
  bars.length>=4&&highs[2]<highs[0]&&highs[3]<highs[1]&&lows[2]<lows[0]&&lows[3]<lows[1]?'LH_LL':'UNCONFIRMED';
 return {status:'EVIDENCE_ONLY',candle:{range:round(span),body:round(body),upperWick:round(upperWick),lowerWick:round(lowerWick),type:body>0?'BULLISH':body<0?'BEARISH':'DOJI'},
  pattern,ema:{ema9:e9===null?null:round(e9),ema20:e20===null?null:round(e20),ema50:e50===null?null:round(e50),ema200:e200===null?null:round(e200),stack},
  volume:{ratio20:ratio===null?null:round(ratio),strongBreakoutVolume:ratio===null?null:ratio>2},structure,
  caveat:'Patterns, EMA stacking and volume are descriptive; index volume may be unavailable or unsuitable. Option premium also depends on implied volatility and time decay.',
  paperOnly:true,orderSubmissionAllowed:false};
}
