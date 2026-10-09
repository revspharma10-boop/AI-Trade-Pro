import assert from 'node:assert/strict';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan,AUTO_OPTION_SAFETY} from './services/autoOptionResearchEngine.js';
const now=Date.parse('2026-10-08T12:00:00+05:30'),underlyingKey='NSE_INDEX|Nifty 50';
const call={segment:'NSE_FO',instrumentType:'CE',tradingSymbol:'NIFTY 25000 CE 15 OCT 26',
 instrumentKey:'NSE_FO|12345',underlyingKey,expiry:'2026-10-15',strike:25000,lotSize:65,tickSize:5};
const put={...call,instrumentType:'PE',tradingSymbol:'NIFTY 25000 PE 15 OCT 26',instrumentKey:'NSE_FO|12346'};
const research={valid:true,completedBars:90,snapshot:{close:25000,ema9:25010,ema21:24990,atr14:35,vwap:null,
 rsi14:61,macdHistogram:4,liquidityResearchPass:false}};
const underlyingQuote={instrumentKey:underlyingKey,lastPrice:25001,timestamp:now-4000};
const bullish=deriveAutoOptionDirection({research,underlyingQuote,underlyingSegment:'NSE_INDEX',session:{open:true},asOf:now});
assert.equal(bullish.direction,'CE');
const bearish=deriveAutoOptionDirection({research:{...research,snapshot:{...research.snapshot,ema9:24980,ema21:25010,rsi14:40,macdHistogram:-2}},underlyingQuote,underlyingSegment:'NSE_INDEX',session:{open:true},asOf:now});
assert.equal(bearish.direction,'PE');
assert.equal(deriveAutoOptionDirection({research,underlyingQuote,underlyingSegment:'NSE_INDEX',session:{open:false},asOf:now}).direction,'WAIT');
assert.equal(deriveAutoOptionDirection({research,underlyingQuote:{...underlyingQuote,timestamp:now-300000},underlyingSegment:'NSE_INDEX',session:{open:true},asOf:now}).direction,'WAIT');
const contracts=[{...call,expiry:'2026-10-08'}, {...call,expiry:'2026-11-05'},put,call,{...call,strike:25050,instrumentKey:'NSE_FO|12349'}];
assert.equal(chooseAutoOptionContract({contracts,underlyingKey,spot:25001,direction:'CE',asOf:now}).contract.instrumentKey,call.instrumentKey);
assert.equal(chooseAutoOptionContract({contracts,underlyingKey,spot:25001,direction:'PE',asOf:now}).contract.instrumentKey,put.instrumentKey);
assert.equal(chooseAutoOptionContract({contracts,underlyingKey:'NSE_EQ|WRONG',spot:25001,direction:'CE',asOf:now}).contract,null);
assert.equal(chooseAutoOptionContract({contracts:[],underlyingKey,spot:25001,direction:'CE',asOf:now}).contract,null);
const quote={valid:true,bid:100.0,ask:100.2,lastPrice:100.1,spreadPercent:0.2,openInterest:40000,tradedVolume:30000,
 timestamp:now-1000,lastTradeTime:now-1000};
const optionResearch={valid:true,completedBars:80,snapshot:{atr14:2,liquidityResearchPass:true}};
const args={direction:'CE',contract:call,underlyingKey,optionQuote:quote,optionResearch,asOf:now};
const initial=calculateAutoOptionPaperPlan(args);
assert.equal(initial.status,'UNVALIDATED_PAPER_LEVELS');
assert.equal(initial.entry,100.2);
assert.equal(initial.stopLoss,97.2);
assert.equal(initial.target1,104.7);
assert.equal(initial.target2,106.2);
assert.equal(initial.target3,109.2);
assert.equal(initial.riskPerLot,201.5);
assert.equal(initial.preliminaryRiskLots,2);
assert.equal(initial.paperEnvelopeLots,null,'No broker margin means no combined envelope');
assert.equal(initial.approvedLots,0);
const margin={instrumentKey:call.instrumentKey,direction:'BUY',product:'I',quantity:65,price:100.2,
 requiredMargin:8000,verified:true,asOf:now};
const verified=calculateAutoOptionPaperPlan({...args,marginQuote:margin});
assert.equal(verified.brokerMarginVerified,true);
assert.equal(verified.paperEnvelopeLots,2);
assert.equal(verified.approvedLots,0);
assert.equal(calculateAutoOptionPaperPlan({...args,marginQuote:{...margin,price:101}}).brokerMarginVerified,false);
assert.equal(calculateAutoOptionPaperPlan({...args,marginQuote:{...margin,quantity:1}}).brokerMarginVerified,false);
assert.equal(calculateAutoOptionPaperPlan({...args,optionQuote:{...quote,spreadPercent:3}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,optionQuote:{...quote,timestamp:now-400000}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,optionQuote:{...quote,lastTradeTime:null}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,contract:{...call,tickSize:null}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,contract:{...call,expiry:'2026-10-08'}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,optionResearch:{...optionResearch,valid:false}}).status,'WAIT');
assert.equal(calculateAutoOptionPaperPlan({...args,capital:100000}).status,'WAIT');
assert.deepEqual(AUTO_OPTION_SAFETY,{paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false});
console.log('AUTO CE/PE PAPER OPTION QUALIFICATION PASSED: expiry/ATM, directional candles, ₹500 risk, premium, quotes, broker margin, fail-closed, 0 orders');


const bseKey='BSE_INDEX|SENSEX';
const bseContract={...call,segment:'BSE_FO',underlyingKey:bseKey,instrumentKey:'BSE_FO|1234',
 tradingSymbol:'SENSEX 75000 CE',strike:75000,lotSize:20};
const bseQuote={...underlyingQuote,instrumentKey:bseKey,lastPrice:75000};
const bseResearch={...research,snapshot:{...research.snapshot,close:75000,ema9:75010,ema21:74990,atr14:90}};
assert.equal(deriveAutoOptionDirection({research:bseResearch,underlyingQuote:bseQuote,
 underlyingSegment:'BSE_INDEX',session:{open:true},asOf:now}).direction,'CE');
assert.equal(chooseAutoOptionContract({contracts:[call,bseContract],underlyingKey:bseKey,spot:75001,
 direction:'CE',asOf:now}).contract.instrumentKey,bseContract.instrumentKey);
assert.equal(chooseAutoOptionContract({contracts:[call],underlyingKey:bseKey,spot:75001,
 direction:'CE',asOf:now}).contract,null,'NSE instruments must not substitute for BSE');
const bsePlan=calculateAutoOptionPaperPlan({direction:'CE',contract:bseContract,underlyingKey:bseKey,
 optionQuote:quote,optionResearch,asOf:now});
assert.equal(bsePlan.status,'UNVALIDATED_PAPER_LEVELS');
assert.equal(bsePlan.approvedLots,0);
console.log('BSE SENSEX PAPER RESEARCH QUALIFICATION PASSED');
