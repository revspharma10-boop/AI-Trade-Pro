import assert from 'node:assert/strict';
import {marketClockState} from '../src/services/intradayMarketClock.js';
import {deriveOpeningRangeBias} from '../src/services/openingRangeResearch.js';
import {qualifyEarlyIndexConfluence,qualifyEarlyPremiumPlan} from './earlyPaperOptionResearch.js';
import {createPaperRecommendationFeed} from './paperRecommendationFeed.js';
const stamp=(min)=>new Date(Date.parse('2026-10-12T09:15:00+05:30')+min*60000).toISOString();
const at=Date.parse('2026-10-12T10:35:20+05:30');
const close=[100.5,101.1,101.6,101.42,101.62,101.40,101.65,101.43,101.68,
 101.47,101.71,101.5,101.65,101.8,102.02,102.2];
const candles=close.map((value,i)=>{
 const open=i?close[i-1]:100,high=Math.max(open,value)+.12,low=Math.min(open,value)-.12;
 return {datetime:stamp(5*i),open,high,low,close:value,volume:12000};
});
const session=marketClockState({segment:'NSE_INDEX',asOf:at});
const key='NSE_INDEX|Nifty 50';
const quote={instrumentKey:key,mode:'READ_ONLY',lastPrice:102.25,timestamp:at-1000};
const opening=deriveOpeningRangeBias({candles,quote,session,asOf:at});
assert.equal(opening.valid,true);
assert.equal(opening.breakoutConfirmedByCompletedCandle,true);
assert.equal(opening.direction,'CE');
const signal=qualifyEarlyIndexConfluence({candles,quote,opening,session,asOf:at});
assert.equal(signal.valid,true,JSON.stringify(signal));
assert.equal(signal.direction,'CE');
assert.equal(signal.strategyValidated,false);
for(const change of [
 {candles:candles.slice(0,14)},
 {candles:[...candles,...candles.slice(-1)]},
 {candles:[...candles.slice(0,-1),{...candles.at(-1),close:101.5,high:102.4}]},
 {quote:{...quote,timestamp:at-45000}},
 {opening:{...opening,breakoutConfirmedByCompletedCandle:false}}
]){
 const bad=qualifyEarlyIndexConfluence({candles,quote,opening,session,asOf:at,...change});
 assert.equal(bad.valid,false,JSON.stringify(change));
}
const contract={underlyingKey:key,underlyingSymbol:'NIFTY',instrumentType:'CE',
 instrumentKey:'NSE_FO|12345',tradingSymbol:'NIFTY FUTURE EXPIRY TEST CE',
 segment:'NSE_FO',expiry:'2026-10-15',lotSize:65,strike:100,tickSize:5};
const closeOption=[7.2,7.5,7.3,7.6,7.9,8.1,8.4,8.7];
const optionBars=closeOption.map((c,i)=>{
 const open=i?closeOption[i-1]:7,high=Math.max(open,c)+.22,low=Math.min(open,c)-.22;
 return {datetime:stamp(40+i*5),open,high,low,close:c,volume:1500};
});
const optionQuote={valid:true,instrumentKey:contract.instrumentKey,bid:8.9,ask:9,
 lastPrice:8.9,spreadPercent:1.12,timestamp:at-1000,lastTradeTime:at-1000,
 openInterest:45000,tradedVolume:9000};
const greeks={delta:.56,gamma:.02,theta:-1,vega:1.3,iv:.18};
const args={contract,underlyingKey:key,direction:'CE',rawCandles:optionBars,
 optionQuote,greeks,asOf:at};
const withoutMargin=qualifyEarlyPremiumPlan(args);
assert.equal(withoutMargin.status,'MARGIN_REQUIRED',JSON.stringify(withoutMargin));
assert.equal(withoutMargin.orderSubmissionAllowed,false);
const marginQuote={instrumentKey:contract.instrumentKey,direction:'BUY',product:'I',
 quantity:65,price:withoutMargin.entry,requiredMargin:3500,
 asOf:at-1000,verified:true};
const plan=qualifyEarlyPremiumPlan({...args,marginQuote});
assert.equal(plan.status,'UNVALIDATED_PAPER_LEVELS',JSON.stringify(plan));
assert.ok(plan.riskPerLot<=500);
assert.ok(plan.target1>=plan.entry+2*(plan.entry-plan.stopLoss));
assert.equal(plan.modelBacktested,false);
for(const bad of [
 {greeks:null},{greeks:{...greeks,iv:null}},{greeks:{...greeks,delta:.1}},
 {optionQuote:{...optionQuote,lastTradeTime:at-200000}},
 {rawCandles:[...optionBars,...optionBars.slice(-1)]},
 {rawCandles:optionBars.map(c=>({...c,volume:0}))},
 {contract:{...contract,lotSize:3000}},
 {marginQuote:{...marginQuote,verified:false}}
]){
 const p=qualifyEarlyPremiumPlan({...args,marginQuote,...bad});
 assert.notEqual(p.status,'UNVALIDATED_PAPER_LEVELS',JSON.stringify(bad));
}
let marginRequests=0,greekRequests=0;
const feed=createPaperRecommendationFeed({
 searchIndex:async()=>({instrumentKey:key,tradingSymbol:'NIFTY'}),
 searchEquity:async()=>{throw Error('NOT_NEEDED');},
 searchDerivatives:async()=>{throw Error('NOT_NEEDED');},
 getContracts:async()=>[contract],
 getCandles:async instrument=>({candles:instrument===key?candles:optionBars}),
 getQuote:async instrument=>instrument===key?quote:{
  ...optionQuote,mode:'READ_ONLY'
 },
 getGreeks:async()=>{greekRequests++;return greeks;},
 getMargin:async req=>{marginRequests++;
  assert.equal(req.quantity,65);
  return {...marginQuote,price:req.price};
 }
});
const result=await feed.getLatest('nifty',at);
assert.equal(result.state,'PAPER_SETUP',JSON.stringify(result));
assert.equal(result.last?.strategyValidated,false);
assert.equal(result.last?.modelBacktested,false);
assert.equal(result.last?.executionStatus,'NOT EXECUTED');
assert.equal(result.last?.approvedLots,0);
assert.equal(result.realOrderPlaced,false);
assert.equal(result.orderSubmissionAllowed,false);
assert.equal(marginRequests,1);
assert.equal(greekRequests,1);
assert.equal((await feed.getLatest('nifty',at+30000)).last?.capturedAt,result.last?.capturedAt);
console.log('EARLY EXPERIMENTAL PAPER WATCH PASS: 15-bar EMA9 RSI14 ORB, 8-bar option ATR, broker Greeks and margin, risk and abstain gates');
