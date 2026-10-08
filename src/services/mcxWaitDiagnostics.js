// MCX directional checklist from the same completed-bar snapshot as the signal.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function describeMcxTechnicalSetup({future=null,research=null,quote=null,signal=null,session=null}={}){
 const s=research?.valid?research.snapshot:null;
 const valid=!!s&&[s.close,s.vwap,s.ema9,s.ema21,s.rsi14,s.macdHistogram].every(finite);
 const checks=valid?[
  {name:'EMA9 versus EMA21',observed:s.ema9+' / '+s.ema21,
   call:s.ema9>s.ema21,put:s.ema9<s.ema21},
  {name:'Completed close versus VWAP',observed:s.close+' / '+s.vwap,
   call:s.close>s.vwap,put:s.close<s.vwap},
  {name:'RSI14',observed:String(s.rsi14),
   call:s.rsi14>=55&&s.rsi14<=75,put:s.rsi14>=25&&s.rsi14<=45},
  {name:'MACD histogram',observed:String(s.macdHistogram),
   call:s.macdHistogram>0,put:s.macdHistogram<0}
 ]:[];
 return {instrument:future?.tradingSymbol??null,completedBars:research?.completedBars??null,
  lastCompletedAt:s?.lastCompletedAt??research?.latestCompletedAt??null,
  close:s?.close??null,vwap:s?.vwap??null,ema9:s?.ema9??null,ema21:s?.ema21??null,
  rsi14:s?.rsi14??null,macdHistogram:s?.macdHistogram??null,atr14:s?.atr14??null,
  quoteLast:finite(quote?.lastPrice)?quote.lastPrice:null,
  quoteValid:quote?.valid===true,spreadPercent:finite(quote?.spreadPercent)?quote.spreadPercent:null,
  preliminaryLiquidity:s?.liquidityResearchPass===true,sessionOpen:session?.open===true,
  callConfirmations:checks.filter(c=>c.call).length,putConfirmations:checks.filter(c=>c.put).length,
  checks,direction:signal?.direction??'WAIT',paperOnly:true,orderSubmissionAllowed:false};
}
