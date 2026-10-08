// Performance research only. A high historical win rate never guarantees future success.
// Requires records of actual fills plus costs. Does not generate or execute trades.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const istDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const round=(n,d=4)=>Number(n.toFixed(d));
export function summarizeIntradayPerformance({trades=[],provenance='UNVERIFIED',minTrades=200}={}){
  const reasons=[];
  if(!Array.isArray(trades)||trades.length===0)reasons.push('NO_TRADE_RECORDS');
  const acceptedProvenance=['VERIFIED_OUT_OF_SAMPLE_BACKTEST','VERIFIED_FORWARD_PAPER'];
  if(!acceptedProvenance.includes(provenance))reasons.push('VERIFIED_PROVENANCE_REQUIRED');
  let pnl=0,wins=0,losses=0,breakeven=0,maxDrawdown=0,peak=0,equity=0;
  const dates=new Set();
  for(const t of Array.isArray(trades)?trades:[]){
    const entryAt=Date.parse(t?.entryAt),exitAt=Date.parse(t?.exitAt);
    const qty=t?.quantity,entry=t?.entry,exit=t?.exit,fees=t?.fees,slippage=t?.slippage;
    const direction=t?.direction;
    const kind=t?.kind;
    if(!Number.isFinite(entryAt)||!Number.isFinite(exitAt)||exitAt<=entryAt||istDate(entryAt)!==istDate(exitAt)||
       !finite(entry)||entry<=0||!finite(exit)||exit<=0||!Number.isInteger(qty)||qty<=0||
       !finite(fees)||fees<0||!finite(slippage)||slippage<0||!['LONG','SHORT'].includes(direction)||
       !['EQUITY','FUTURE','CALL_OPTION','PUT_OPTION'].includes(kind)||
       (kind.includes('OPTION')&&direction==='SHORT')||
       (kind!=='EQUITY'&&(!Number.isInteger(t.lotSize)||t.lotSize<=0||qty%t.lotSize!==0))){
      reasons.push('INVALID_OR_UNSAFE_TRADE_RECORD');break;
    }
    const signedDirection=direction==='LONG'?1:-1;
    const net=(exit-entry)*qty*signedDirection-fees-slippage;
    pnl+=net;equity+=net;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak-equity);
    if(net>0)wins++;else if(net<0)losses++;else breakeven++;
    dates.add(istDate(entryAt));
  }
  if(reasons.includes('INVALID_OR_UNSAFE_TRADE_RECORD'))return {qualified:false,verifiedSuccessProbability:null,
    sampleSize:0,winRatePercent:null,lower95Percent:null,netProfit:null,reasons:[...new Set(reasons)],paperOnly:true};
  const n=wins+losses+breakeven,p=n?wins/n:0,z=1.96,z2=z*z;
  const wilson=n?(p+z2/(2*n)-z*Math.sqrt(p*(1-p)/n+z2/(4*n*n)))/(1+z2/n):0;
  if(n<minTrades)reasons.push('INSUFFICIENT_OUTCOME_SAMPLE');
  if(dates.size<20)reasons.push('INSUFFICIENT_DISTINCT_TRADING_DAYS');
  if(p<0.90)reasons.push('WIN_RATE_BELOW_90_PERCENT_TARGET');
  if(wilson<0.90)reasons.push('LOWER_95_CONFIDENCE_BOUND_BELOW_90_PERCENT');
  if(pnl<=0)reasons.push('NET_PROFIT_AFTER_COSTS_NOT_POSITIVE');
  // Historical qualification is never a calibrated per-signal probability or a guarantee.
  return {qualified:reasons.length===0,verifiedSuccessProbability:null,provenance,
    sampleSize:n,distinctDays:dates.size,wins,losses,breakeven,winRatePercent:n?round(100*p,2):null,
    lower95Percent:n?round(100*wilson,2):null,netProfit:n?round(pnl,2):null,
    maximumRealizedDrawdown:n?round(maxDrawdown,2):null,reasons:[...new Set(reasons)],paperOnly:true};
}
