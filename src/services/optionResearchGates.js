// Explain *why* a paper CALL/PUT or option premium setup has not qualified.
// No fabricated index candles, predictions, broker prices or trade authorization.
export const GATE_SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const unique=x=>[...new Set(x.filter(Boolean))];
export function describeIndexOptionGates({asOf=Date.now(),intradayCandles=[],
 underlyingResearch=null,openingRange=null,signal=null,contract=null,plan=null,
 dataErrors=[]}={}){
 const now=Number(new Date(asOf)),today=finite(now)?new Date(now+330*60000):null;
 const minute=today?today.getUTCHours()*60+today.getUTCMinutes():null;
 const bars=finite(underlyingResearch?.completedBars)?underlyingResearch.completedBars:0;
 const visibleErrors=unique((Array.isArray(dataErrors)?dataErrors:[]).map(String));
 const candleFailure=visibleErrors.some(x=>/INTRADAY_DATA_EMPTY|CANDLES_UNAVAILABLE|INTRADAY_REQUEST_FAILED|INTRADAY_UNAVAILABLE/i.test(x));
 const verifiedFull=underlyingResearch?.valid===true&&bars>=35;
 const earlyEligible=minute!==null&&minute>=570;
 const openingReady=openingRange?.valid===true&&openingRange?.openingOHLC!==null;
 const earlyDirection=['CE','PE'].includes(openingRange?.direction)?openingRange.direction:'WAIT';
 const fullDirection=verifiedFull&&['CE','PE'].includes(signal?.direction)?signal.direction:'WAIT';
 const selected=fullDirection!=='WAIT'?fullDirection:earlyDirection;
 const isExactContract=contract&&typeof contract.tradingSymbol==='string'&&contract.tradingSymbol.length>0&&
   ['CE','PE'].includes(contract.instrumentType)&&finite(contract.strike)&&contract.strike>0;
 const premiumValid=plan?.status==='UNVALIDATED_PAPER_LEVELS'&&
   [plan.entry,plan.stopLoss,plan.target1,plan.target2,plan.target3].every(x=>finite(x)&&x>0);
 const gates=[
  {label:'Upstox 5-minute OHLC',status:candleFailure?'MISSING':bars===0?'WAIT':'AVAILABLE',
   explanation:candleFailure?'Broker intraday candle request returned no usable candles. A fresh quote alone cannot create OHLC.':
    bars+' completed intraday candles; Upstox quote and 5-minute candles are separate feeds.'},
  {label:'09:15–09:30 opening range',status:!earlyEligible?'COLLECTING':openingReady?
   earlyDirection!=='WAIT'?'EARLY_BIAS':'WAIT':'BLOCKED',
   explanation:!earlyEligible?'First early paper direction can be assessed after 09:30 IST.':
    !openingReady?'Three actual completed candles beginning 09:15, 09:20 and 09:25 must be available.':
    earlyDirection==='WAIT'?'Opening range lacks aligned candle direction/close location; no forced CE or PE.':
    'Provisional '+earlyDirection+' directional bias; not yet a qualified option contract/premium trade.'},
  {label:'Full 5-minute EMA/RSI/MACD confirmation',status:verifiedFull?
    fullDirection!=='WAIT'?'PASS':'WAIT':'NOT_READY',
   explanation:!verifiedFull?bars+'/35 completed same-day candles. Full qualification cannot occur before about 12:10 IST.':
    fullDirection==='WAIT'?'EMA9/21, RSI14 and MACD or other evidence did not qualify simultaneously.':
     'Confirmed research direction '+fullDirection+'; strategy is still not backtested.'},
  {label:'Exact exchange-listed option contract',status:isExactContract?'VERIFIED':'NOT_CHECKED',
   explanation:isExactContract?contract.tradingSymbol+' • strike '+contract.strike+' • expiry '+contract.expiry:
    'The full strategy only attempts option-chain selection after its technical direction qualifies; an early index bias alone does not select a trade.'},
  {label:'Option premium, stop/targets & ₹500 risk',status:premiumValid?'PAPER_LEVELS':'NOT_VERIFIED',
   explanation:premiumValid?'Premium evidence supports provisional paper entry/SL/T1/T2/T3. Approved real lots: 0.':
    'Verified premium bid/ask, option candles, contract multiplier and risk checks are required; no invented BUY/SL/targets.'}
 ];
 return {gates,earlyDirection,fullDirection,selectedDirection:selected,
  mainBlocker:candleFailure?'UPSTOX_INTRADAY_DATA_EMPTY':
   !earlyEligible?'COLLECTING_OPENING_RANGE':
   !openingReady?'THREE_OPENING_CANDLES_UNAVAILABLE':
   earlyDirection==='WAIT'&&!verifiedFull?'NO_CLEAR_OPENING_DIRECTION':
   !verifiedFull?'FULL_TECHNICAL_NOT_READY':
   fullDirection==='WAIT'?'NO_CLEAR_FULL_DIRECTION':
   !isExactContract?'OPTION_CONTRACT_NOT_VERIFIED':
   !premiumValid?'OPTION_PREMIUM_OR_RISK_NOT_VERIFIED':'PAPER_LEVELS_PROVISIONAL',
  errors:visibleErrors,...GATE_SAFETY};
}
