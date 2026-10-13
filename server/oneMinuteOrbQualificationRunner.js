// Deterministic synthetic fixtures. Not today's market prices or forecasts.
import assert from 'node:assert/strict';
import {qualifyOneMinuteOrbWatch} from './oneMinuteOrbPaperWatch.js';
import {qualifyEarlyPremiumPlan} from './earlyPaperOptionResearch.js';
import {createPaperRecommendationFeed} from './paperRecommendationFeed.js';
import {marketClockState} from '../src/services/intradayMarketClock.js';
const stamp=i=>new Date(Date.parse('2026-10-13T09:15:00+05:30')+60000*i).toISOString();
const asOf=Date.parse('2026-10-13T09:33:20+05:30');
const closes=[100.05,100.25,100.08,100.37,100.20,100.46,
 100.27,100.56,100.38,100.70,100.50,100.84,100.64,100.95,
 100.77,101.12,101.35,101.55];
const minuteCandles=closes.map((close,i)=>({
 datetime:stamp(i),open:i?closes[i-1]:100,
 high:Math.max(i?closes[i-1]:100,close)+.1,
 low:Math.min(i?closes[i-1]:100,close)-.1,close,volume:1000
}));
const key='NSE_INDEX|Nifty 50';
const indexQuote={mode:'READ_ONLY',instrumentKey:key,lastPrice:101.58,timestamp:asOf-1000};
const session=marketClockState({segment:'NSE_INDEX',asOf});
const watch=qualifyOneMinuteOrbWatch({candles:minuteCandles,quote:indexQuote,session,asOf});
assert.equal(watch.valid,true,JSON.stringify(watch));
assert.equal(watch.direction,'CE');
assert.equal(watch.modelBacktested,false);
assert.equal(watch.orderSubmissionAllowed,false);
const negatives=[
 {candles:minuteCandles.slice(0,16)},
 {candles:[...minuteCandles,...minuteCandles.slice(-1)]},
 {candles:minuteCandles.filter((_,i)=>i!==5)},
 {candles:minuteCandles.filter((_,i)=>i!==15)},
 {quote:{...indexQuote,timestamp:asOf-90000}},
 {quote:{...indexQuote,lastPrice:103}},
 {candles:minuteCandles.map(c=>({...c,close:100.05,open:100.05,high:100.15,low:99.95}))}
];
for(const change of negatives){
 const bad=qualifyOneMinuteOrbWatch({candles:minuteCandles,quote:indexQuote,session,asOf,...change});
 assert.equal(bad.valid,false,JSON.stringify(change).slice(0,250));
}
const contract={underlyingSymbol:'NIFTY',segment:'NSE_FO',instrumentType:'CE',
 underlyingKey:key,instrumentKey:'NSE_FO|TEST123',tradingSymbol:'SYNTHETIC NIFTY CE',
 expiry:'2026-10-15',strike:100,lotSize:65,tickSize:5};
const optionClose=[5.50,5.63,5.60,5.82,5.98,6.15,6.36,6.56];
const optionCandles=optionClose.map((close,i)=>({
 datetime:stamp(10+i),open:i?optionClose[i-1]:5.4,
 high:Math.max(i?optionClose[i-1]:5.4,close)+.1,
 low:Math.min(i?optionClose[i-1]:5.4,close)-.1,
 close,volume:1000
}));
const optionQuote={instrumentKey:contract.instrumentKey,valid:true,bid:6.72,ask:6.8,
 lastPrice:6.75,spreadPercent:1.1834,timestamp:asOf-1000,
 lastTradeTime:asOf-1000,openInterest:80000,tradedVolume:7000};
const greeks={delta:.56,gamma:.02,theta:-1,vega:1.3,iv:.18};
const args={contract,underlyingKey:key,direction:'CE',rawCandles:optionCandles,
 optionQuote,greeks,asOf,intervalMinutes:1};
const missingMargin=qualifyEarlyPremiumPlan(args);
assert.equal(missingMargin.status,'MARGIN_REQUIRED',JSON.stringify(missingMargin));
const margin={verified:true,requiredMargin:2500,instrumentKey:contract.instrumentKey,
 direction:'BUY',product:'I',quantity:65,price:missingMargin.entry,asOf:asOf-500};
const plan=qualifyEarlyPremiumPlan({...args,marginQuote:margin});
assert.equal(plan.status,'UNVALIDATED_PAPER_LEVELS',JSON.stringify(plan));
assert.ok(plan.riskPerLot>0&&plan.riskPerLot<=500);
for(const c of [
 {optionQuote:{...optionQuote,timestamp:asOf-40000}},
 {greeks:null},{marginQuote:{...margin,verified:false}},
 {contract:{...contract,lotSize:10000}},
 {rawCandles:optionCandles.slice(1)},
 {rawCandles:[{...optionCandles[0],datetime:stamp(9)},optionCandles[0],...optionCandles.slice(2)]},
 {rawCandles:[...optionCandles,...optionCandles.slice(-1)]}
]){
 const p=qualifyEarlyPremiumPlan({...args,marginQuote:margin,...c});
 assert.notEqual(p.status,'UNVALIDATED_PAPER_LEVELS',JSON.stringify(c).slice(0,250));
}
const fiveCandles=[];
for(let n=0;n<3;n++){
 const chunk=minuteCandles.slice(n*5,(n+1)*5);
 fiveCandles.push({
  datetime:chunk[0].datetime,open:chunk[0].open,close:chunk.at(-1).close,
  high:Math.max(...chunk.map(c=>c.high)),low:Math.min(...chunk.map(c=>c.low)),
  volume:chunk.reduce((s,c)=>s+c.volume,0)
 });
}
let quotes=0,contracts=0,marginRequests=0,minuteReads=0;
const feed=createPaperRecommendationFeed({
 searchIndex:async()=>({instrumentKey:key,tradingSymbol:'NIFTY'}),
 searchEquity:async()=>{throw Error('NOT_USED');},
 searchDerivatives:async()=>({contracts:[]}),
 getContracts:async()=>{contracts++;return [contract];},
 getCandles:async(instrument,interval)=>{
  if(interval==='1m')minuteReads++;
  return {candles:instrument===key?(interval==='1m'?minuteCandles:fiveCandles):optionCandles};
 },
 getQuote:async instrument=>{quotes++;
  return instrument===key?indexQuote:{...optionQuote,mode:'READ_ONLY'};},
 getGreeks:async()=>greeks,
 getMargin:async req=>{marginRequests++;return {...margin,price:req.price};}
});
const res=await feed.getLatest('nifty',asOf);
assert.equal(res.state,'PAPER_SETUP',JSON.stringify(res));
assert.equal(res.last.strategyVersion,'orb-1m-ema9-rsi14-v1');
assert.equal(res.last.approvedLots,0);
assert.equal(res.last.executionStatus,'NOT EXECUTED');
assert.equal(res.last.modelBacktested,false);
assert.equal(res.orderSubmissionAllowed,false);
assert.equal(res.realOrderPlaced,false);
assert.equal(marginRequests,1);
assert.equal(contracts,1);
assert.equal(minuteReads,2);
const frozen=await feed.getLatest('nifty',asOf+30000);
assert.equal(frozen.last.capturedAt,res.last.capturedAt);
const failGreeks=createPaperRecommendationFeed({
 searchIndex:async()=>({instrumentKey:key,tradingSymbol:'NIFTY'}),
 searchEquity:async()=>{throw Error('NOT_USED');},
 searchDerivatives:async()=>({contracts:[]}),
 getContracts:async()=>[contract],
 getCandles:async(instrument,interval)=>({candles:instrument===key?
  (interval==='1m'?minuteCandles:fiveCandles):optionCandles}),
 getQuote:async instrument=>instrument===key?indexQuote:{...optionQuote,mode:'READ_ONLY'},
 getGreeks:async()=>null,
 getMargin:async()=>{throw Error('MARGIN_SHOULD_NOT_BE_CALLED');}
});
const rejected=await failGreeks.getLatest('nifty',asOf);
assert.equal(rejected.state,'WAIT');
assert.equal(rejected.stage,'ONE_MINUTE_OPTION_WATCH');
assert.equal(rejected.last,null);
assert.equal(rejected.orderSubmissionAllowed,false);
assert.equal(rejected.provisionalDirection?.strategy,'ONE_MINUTE_ORB_EMA9_RSI14');
const missingMinuteSource=createPaperRecommendationFeed({
 searchIndex:async()=>({instrumentKey:key,tradingSymbol:'NIFTY'}),
 searchEquity:async()=>{throw Error('NOT_USED');},
 searchDerivatives:async()=>({contracts:[]}),
 getContracts:async()=>{throw Error('NO_CONTRACT_LOOKUP_WITHOUT_VALID_1M_DATA');},
 getCandles:async(instrument,interval)=>{
  if(instrument===key&&interval==='1m')throw Error('UPSTOX_INTRADAY_REQUEST_FAILED');
  return {candles:fiveCandles};
 },
 getQuote:async()=>indexQuote,
 getGreeks:async()=>null,
 getMargin:async()=>{throw Error('NO_MARGIN_WITHOUT_CONTRACT');}
});
const absent=await missingMinuteSource.getLatest('nifty',asOf);
assert.equal(absent.state,'WAIT');
assert.equal(absent.stage,'OPENING_RANGE');
assert.ok(absent.blockers.some(x=>x.code==='ONE_MINUTE_CANDLES_UNAVAILABLE'),
 'Missing one-minute provider feed must be disclosed ahead of generic 5m indicators');
assert.equal(absent.orderSubmissionAllowed,false);
assert.equal(absent.realOrderPlaced,false);
console.log('1M ORB EARLY PAPER WATCH QUALIFICATION PASS: no-lookahead, 15+2 candles, EMA9/RSI14, real bid-ask, Greeks, affordability, no order routes');
