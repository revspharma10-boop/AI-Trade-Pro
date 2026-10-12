// Experimental, non-executable early-session option paper WATCH.
// Independent completed-candle confluence is required; never turns a 15m bias
// alone into a BUY. No broker order calls and no claims of validated profitability.
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const istDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const istMinute=ms=>{const d=new Date(ms+330*60000);return 60*d.getUTCHours()+d.getUTCMinutes();};
const tickPrice=c=>positive(c?.tickSize)?Number((c.tickSize/100).toFixed(4)):null;
const round=n=>Number(n.toFixed(3));
const floorTick=(n,t)=>Math.floor(n/t+1e-8)*t;
const ceilTick=(n,t)=>Math.ceil(n/t-1e-8)*t;
const no=(...reasons)=>({valid:false,reasons:[...new Set(reasons)],paperOnly:true,orderSubmissionAllowed:false});
function completedCandles(raw,asOf,min){
 if(!Array.isArray(raw)||!finite(asOf))return {bars:[],reasons:['CANDLE_DATA_UNAVAILABLE']};
 const bars=[],reasons=[];
 for(const c of raw){
  const at=Date.parse(c?.datetime??'');
  if(!finite(at)||![c?.open,c?.high,c?.low,c?.close,c?.volume].every(finite)||
     c.low<=0||c.volume<0||c.high<c.low||c.open<c.low||c.open>c.high||
     c.close<c.low||c.close>c.high)return {bars:[],reasons:['INVALID_EARLY_OHLCV']};
  if(istDate(at)!==istDate(asOf)||at+312000>asOf)continue;
  const minute=istMinute(at);
  if(minute<555||minute>=930||minute%5!==0)
   return {bars:[],reasons:['INVALID_EARLY_CANDLE_SESSION']};
  bars.push({...c,at});
 }
 bars.sort((a,b)=>a.at-b.at);
 if(bars.some((x,i)=>i&&x.at===bars[i-1].at))
  reasons.push('DUPLICATE_EARLY_CANDLE');
 if(bars.length<min)reasons.push('INSUFFICIENT_EARLY_CANDLES');
 if(bars.length&&asOf-(bars.at(-1).at+300000)>420000)
  reasons.push('STALE_EARLY_CANDLES');
 if(bars.length>=2&&bars.at(-1).at-bars.at(-2).at!==300000)
  reasons.push('GAPPED_LATEST_EARLY_CANDLES');
 return {bars,reasons};
}
const ema=(v,n)=>{
 if(v.length<n)return null;
 let e=v.slice(0,n).reduce((a,b)=>a+b)/n;
 for(let i=n;i<v.length;i++)e=e+(v[i]-e)*2/(n+1);
 return e;
};
const rsi=(values,p=14)=>{
 if(values.length<p+1)return null;
 let gain=0,loss=0;
 for(let i=values.length-p;i<values.length;i++){
  const d=values[i]-values[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);
 }
 if(!gain&&!loss)return 50;
 return !loss?100:100-100/(1+gain/loss);
};
const atr=(v,p=7)=>{
 if(v.length<p+1)return null;
 let sum=0;
 for(let i=v.length-p;i<v.length;i++){
  const c=v[i],prior=v[i-1];
  sum+=Math.max(c.high-c.low,Math.abs(c.high-prior.close),Math.abs(c.low-prior.close));
 }
 return sum/p;
};
export function qualifyEarlyIndexConfluence({candles=[],quote=null,opening=null,session=null,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),read=completedCandles(candles,now,15);
 const issues=[...read.reasons],bars=read.bars;
 if(!session?.open||!['NSE','BSE'].includes(session.exchange))issues.push('EARLY_SESSION_CLOSED');
 if(!opening?.valid||!['CE','PE'].includes(opening.direction)||
    !opening.breakoutConfirmedByCompletedCandle||!opening.breakoutConfirmedByQuote)
  issues.push('COMPLETED_ORB_BREAKOUT_REQUIRED');
 if(quote?.mode!=='READ_ONLY'||!positive(quote.lastPrice)||!finite(quote.timestamp)||
   quote.timestamp>now+10000||now-quote.timestamp>30000)
  issues.push('FRESH_EARLY_INDEX_QUOTE_REQUIRED');
 const last=bars.at(-1),prior=bars.at(-2),closes=bars.map(c=>c.close);
 const e9=ema(closes,9),priorE9=ema(closes.slice(0,-1),9),strength=rsi(closes);
 if(!positive(e9)||!positive(priorE9)||!finite(strength))
  issues.push('EARLY_EMA_RSI_REQUIRED');
 const ce=opening?.direction==='CE',pe=opening?.direction==='PE';
 const range=opening?.openingOHLC;
 if(!positive(range?.high)||!positive(range?.low)||range.high<=range.low)
  issues.push('OPENING_RANGE_LEVELS_REQUIRED');
 const beyond=last&&prior&&range&&(ce?
   last.close>range.high&&prior.close>range.high&&last.close>last.open:
   pe?last.close<range.low&&prior.close<range.low&&last.close<last.open:false);
 if(!beyond)issues.push('TWO_CONFIRMED_5M_BREAKOUT_CLOSES_REQUIRED');
 const momentum=(ce&&e9>priorE9&&strength>=55&&strength<=75&&last?.close>e9)||
  (pe&&e9<priorE9&&strength>=25&&strength<=45&&last?.close<e9);
 if(!momentum)issues.push('EARLY_EMA9_RSI_CONFLUENCE_REQUIRED');
 if(positive(quote?.lastPrice)&&positive(last?.close)&&
    Math.abs(quote.lastPrice-last.close)>last.close*0.0035)
  issues.push('EARLY_QUOTE_CANDLE_MISMATCH');
 return issues.length?no(...issues):{
  valid:true,direction:opening.direction,strategyVersion:'orb-ema9-rsi14-early-v1',
  latestCompletedAt:new Date(last.at).toISOString(),completedBars:bars.length,
  ema9:round(e9),rsi14:round(strength),orbHigh:range.high,orbLow:range.low,
  modelBacktested:false,strategyValidated:false,paperOnly:true,orderSubmissionAllowed:false,
  reasons:[]
 };
}
export function qualifyEarlyPremiumPlan({contract,underlyingKey,direction,rawCandles=[],optionQuote=null,
 greeks=null,marginQuote=null,asOf=Date.now(),capital=50000,riskBudget=500}={}){
 const now=Number(new Date(asOf)),read=completedCandles(rawCandles,now,8),bars=read.bars,
 issues=[...read.reasons],tick=tickPrice(contract);
 const base={status:'WAIT',reasons:[],paperOnly:true,orderSubmissionAllowed:false,
  realOrderPlaced:false,productionRealTradingEnabled:false,approvedLots:0,
  modelBacktested:false,strategyValidated:false};
 if(!['CE','PE'].includes(direction)||contract?.instrumentType!==direction||
  contract?.underlyingKey!==underlyingKey||
  contract?.segment!==(underlyingKey?.startsWith('BSE_INDEX|')?'BSE_FO':'NSE_FO')||
  !/^(NSE_FO|BSE_FO)\|[A-Za-z0-9_]+$/.test(contract?.instrumentKey??'')||
  !positive(contract?.strike)||!Number.isSafeInteger(contract?.lotSize)||contract.lotSize<1||
  !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(contract?.expiry??'')||
  contract.expiry<=istDate(now)||!positive(tick))
  issues.push('EXACT_EARLY_OPTION_CONTRACT_REQUIRED');
 if(capital!==50000||riskBudget!==500)issues.push('EARLY_RISK_BUDGET_NOT_VERIFIED');
 if(!optionQuote?.valid||!positive(optionQuote.ask)||!positive(optionQuote.bid)||
    !positive(optionQuote.lastPrice)||!finite(optionQuote.timestamp)||!finite(optionQuote.lastTradeTime)||
    optionQuote.timestamp>now+10000||now-optionQuote.timestamp>30000||
    optionQuote.lastTradeTime>now+10000||now-optionQuote.lastTradeTime>90000||
    !finite(optionQuote.spreadPercent)||optionQuote.spreadPercent>1.5)
  issues.push('FRESH_EARLY_OPTION_BID_ASK_REQUIRED');
 if(!positive(optionQuote?.openInterest)||!positive(optionQuote?.tradedVolume))
  issues.push('EARLY_OPTION_VOLUME_OI_REQUIRED');
 if(!bars.length||bars.slice(-8).some(c=>c.volume<=0)||
    bars.at(-1)?.close<=bars.at(-2)?.close||
    bars.at(-2)?.close<=bars.at(-3)?.close)
  issues.push('EARLY_OPTION_PREMIUM_UPTREND_REQUIRED');
 const volatility=atr(bars,7);
 if(!positive(volatility))issues.push('EARLY_OPTION_ATR_REQUIRED');
 // Greeks must be supplied by broker; absence is not estimated or filled.
 if(!greeks||!positive(greeks.iv)||!finite(greeks.delta)||!positive(greeks.gamma)||
    !finite(greeks.theta)||greeks.theta>=0||!positive(greeks.vega)||
    !(direction==='CE'?greeks.delta>=0.3&&greeks.delta<=0.8:
      greeks.delta<=-0.3&&greeks.delta>=-0.8))
  issues.push('BROKER_OPTION_GREEKS_IV_REQUIRED');
 if(issues.length)return {...base,reasons:[...new Set(issues)]};
 const entry=Number(ceilTick(optionQuote.ask,tick).toFixed(2));
 const stop=Number(floorTick(entry-Math.max(1.2*volatility,4*tick),tick).toFixed(2));
 if(!positive(stop)||stop>=entry)return {...base,reasons:['EARLY_PREMIUM_STOP_INVALID']};
 const riskDistance=entry-stop;
 const t1=Number(ceilTick(entry+2*riskDistance,tick).toFixed(2));
 const t2=Number(ceilTick(entry+2.5*riskDistance,tick).toFixed(2));
 const t3=Number(ceilTick(entry+3*riskDistance,tick).toFixed(2));
 const feeReserve=100; // deliberately conservative *placeholder*, not broker-verified fees
 const perLotRisk=Number(((riskDistance+2*tick)*contract.lotSize+feeReserve).toFixed(2));
 const premiumCost=Number((entry*contract.lotSize).toFixed(2));
 if(perLotRisk>500||!positive(perLotRisk)||premiumCost>capital)
  return {...base,reasons:['EARLY_SINGLE_LOT_EXCEEDS_RISK_OR_CAPITAL']};
 const required=marginQuote?.requiredMargin,verified=marginQuote?.verified===true&&
  marginQuote.instrumentKey===contract.instrumentKey&&marginQuote.direction==='BUY'&&
  marginQuote.product==='I'&&marginQuote.quantity===contract.lotSize&&
  finite(marginQuote.price)&&Math.abs(marginQuote.price-entry)<1e-6&&
  positive(required)&&finite(marginQuote.asOf)&&marginQuote.asOf<=now+10000&&
  now-marginQuote.asOf<180000;
 if(!verified)return {...base,reasons:['BROKER_MARGIN_QUOTE_REQUIRED']};
 const lots=Math.min(Math.floor(500/perLotRisk),Math.floor(capital/premiumCost),
    Math.floor(capital/Math.max(premiumCost,required)));
 if(lots<1)return {...base,reasons:['EARLY_AFFORDABLE_PAPER_LOTS_ZERO']};
 return {...base,status:'UNVALIDATED_PAPER_LEVELS',optionType:direction,direction,
  entry,stopLoss:stop,target1:t1,target2:t2,target3:t3,riskPerLot:perLotRisk,
  brokerMarginVerified:true,paperEnvelopeLots:lots,
  strategyVersion:'orb-ema9-rsi14-early-v1',
  estimatedCostReserveInr:feeReserve,
  feesAndGapsIncluded:false,availableBrokerFundsVerified:false,
  reasons:['EXPERIMENTAL_EARLY_SETUP_NOT_BACKTESTED','ESTIMATED_COST_RESERVE_NOT_FEE_QUOTE',
    'GAP_SLIPPAGE_AND_AVAILABLE_FUNDS_NOT_VERIFIED']
 };
}
