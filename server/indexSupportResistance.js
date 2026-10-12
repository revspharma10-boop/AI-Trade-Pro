// Deterministic read-only index pivot levels from a completed daily candle.
const wait=(tab,reason)=>({tab,state:'WAIT',reason,levels:null,method:'PREVIOUS_SESSION_CLASSIC_PIVOTS',paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false});
export function indexSupportResistance({tab,candles,asOf=Date.now()}={}){
 if(!['nifty','sensex'].includes(tab))return wait(tab,'UNSUPPORTED_TAB');
 const now=new Date(asOf);if(!Number.isFinite(now.getTime()))return wait(tab,'INVALID_CLOCK');
 const istDate=new Date(now.getTime()+330*60000).toISOString().slice(0,10);
 const valid=Array.isArray(candles)?candles.filter(c=>{
  const d=String(c?.datetime||'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d<istDate&&
   [c.open,c.high,c.low,c.close].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0)&&
   c.high>=c.low&&c.open>=c.low&&c.open<=c.high&&c.close>=c.low&&c.close<=c.high;
 }):[];
 if(!valid.length)return wait(tab,'NO_VERIFIED_COMPLETED_SESSION');
 valid.sort((a,b)=>b.datetime.localeCompare(a.datetime));
 const c=valid[0],h=c.high,l=c.low,close=c.close;
 if(h===l)return wait(tab,'INVALID_ZERO_RANGE');
 const p=(h+l+close)/3,range=h-l,round=x=>Math.round(x*100)/100;
 return {...wait(tab,null),state:'READY',sessionDate:c.datetime.slice(0,10),
  levels:{pivot:round(p),s1:round(2*p-h),s2:round(p-range),s3:round(l-2*(h-p)),
   r1:round(2*p-l),r2:round(p+range),r3:round(h+2*(p-l)),
   previousHigh:round(h),previousLow:round(l),previousClose:round(close)}};
}
