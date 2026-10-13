// Experimental early 1-minute ORB confluence. Completed intraday candles only.
// A research hypothesis, never a broker instruction, order, simulated fill, or
// guarantee of direction/premium profitability.
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const positive=x=>valid(x)&&x>0;
const istDay=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const istMinutes=ms=>{const d=new Date(ms+330*60000);return d.getUTCHours()*60+d.getUTCMinutes();};
const blocked=(...reasons)=>({valid:false,direction:'WAIT',reasons:[...new Set(reasons)],
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
const average=ns=>ns.reduce((a,b)=>a+b,0)/ns.length;
const ema=(v,p)=>{let e=average(v.slice(0,p));for(let i=p;i<v.length;i++)e+=(v[i]-e)*2/(p+1);return e;};
const rsi=(v,p=14)=>{let up=0,down=0;for(let i=v.length-p;i<v.length;i++){
 const diff=v[i]-v[i-1];up+=Math.max(0,diff);down+=Math.max(0,-diff);
}return up===0&&down===0?50:down===0?100:100-100/(1+up/down);};
export function qualifyOneMinuteOrbWatch({candles=[],quote=null,session=null,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),issues=[];
 if(!valid(now)||!session?.open||!['NSE','BSE'].includes(session.exchange))
  return blocked('ONE_MINUTE_INDEX_SESSION_UNVERIFIED');
 if(!Array.isArray(candles))return blocked('ONE_MINUTE_CANDLES_UNAVAILABLE');
 const bars=[];
 for(const c of candles){
  const time=Date.parse(c?.datetime??'');
  if(!valid(time)||![c?.open,c?.high,c?.low,c?.close,c?.volume].every(valid)||
   c.low<=0||c.volume<0||c.high<c.low||c.open<c.low||c.open>c.high||
   c.close<c.low||c.close>c.high)
   return blocked('INVALID_ONE_MINUTE_CANDLE');
  if(istDay(time)!==istDay(now)||istMinutes(time)<555||istMinutes(time)>=930)continue;
  if(time+72000>now)continue; // at least 12s after a completed minute.
  bars.push({...c,time,minute:istMinutes(time)});
 }
 bars.sort((a,b)=>a.time-b.time);
 if(bars.some((c,i)=>i&&c.time===bars[i-1].time))
  return blocked('DUPLICATE_ONE_MINUTE_CANDLE');
 if(bars.some((c,i)=>i&&c.time-bars[i-1].time!==60000))
  return blocked('GAPPED_ONE_MINUTE_INDEX_CANDLES');
 const opening=bars.filter(c=>c.minute>=555&&c.minute<570);
 if(opening.length!==15||opening.some((c,i)=>c.minute!==555+i))
  issues.push('FIFTEEN_OPENING_ONE_MINUTE_CANDLES_REQUIRED');
 const after=bars.filter(c=>c.minute>=570),last=after.at(-1),prior=after.at(-2);
 if(!last||!prior||last.time-prior.time!==60000)
  issues.push('TWO_COMPLETED_POST_OPENING_MINUTE_CANDLES_REQUIRED');
 if(last&&now-(last.time+60000)>90000)issues.push('ONE_MINUTE_COMPLETED_CANDLE_STALE');
 if(quote?.mode!=='READ_ONLY'||!positive(quote.lastPrice)||!valid(quote.timestamp)||
   quote.timestamp>now+10000||now-quote.timestamp>30000)
  issues.push('ONE_MINUTE_INDEX_QUOTE_STALE');
 const high=opening.length===15?Math.max(...opening.map(b=>b.high)):null,
 low=opening.length===15?Math.min(...opening.map(b=>b.low)):null;
 const start=opening[0]?.open;
 if(!positive(start)||!positive(high)||!positive(low)||high<=low||
   (high-low)/start<.0003||(high-low)/start>.03)
  issues.push('ONE_MINUTE_ORB_RANGE_UNVERIFIED');
 if(issues.length)return blocked(...issues);
 const closes=bars.filter(c=>c.minute>=555&&c.minute<=last.minute).map(c=>c.close);
 if(closes.length<17)return blocked('ONE_MINUTE_EMA_RSI_INPUT_MISSING');
 const fast=ema(closes,9),fastPrior=ema(closes.slice(0,-1),9),strength=rsi(closes);
 const buffer=Math.max(start*.00005,(high-low)*.03);
 const bull=last.close>high+buffer&&prior.close>high+buffer&&
  last.close>last.open&&prior.close>prior.open&&quote.lastPrice>high&&
  last.close>fast&&fast>fastPrior&&strength>=55&&strength<=75;
 const bear=last.close<low-buffer&&prior.close<low-buffer&&
  last.close<last.open&&prior.close<prior.open&&quote.lastPrice<low&&
  last.close<fast&&fast<fastPrior&&strength>=25&&strength<=45;
 if(!bull&&!bear)return blocked('ONE_MINUTE_ORB_EMA_RSI_NOT_CONFIRMED');
 if(Math.abs(quote.lastPrice-last.close)/last.close>.0035)
  return blocked('ONE_MINUTE_QUOTE_CANDLE_MISMATCH');
 return {valid:true,direction:bull?'CE':'PE',strategyVersion:'orb-1m-ema9-rsi14-v1',
   openingHigh:Number(high.toFixed(3)),openingLow:Number(low.toFixed(3)),
   latestCompletedAt:new Date(last.time).toISOString(),completedBars:bars.length,
   indexEma9:Number(fast.toFixed(3)),indexRsi14:Number(strength.toFixed(2)),
   experimental:true,modelBacktested:false,strategyValidated:false,
   paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,reasons:[]};
}
