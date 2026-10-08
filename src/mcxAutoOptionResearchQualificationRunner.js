import assert from 'node:assert/strict';
import {chooseMcxOptionUnderlying,deriveMcxOptionDirection,chooseMcxOptionContract,calculateMcxOptionPaperPlan,MCX_OPTION_SAFETY} from './services/mcxAutoOptionResearchEngine.js';
const now=Date.parse('2026-10-08T12:00:00+05:30');
const future={segment:'MCX_FO',instrumentType:'FUT',instrumentKey:'MCX_FO|F123',
 underlyingSymbol:'GOLDM',tradingSymbol:'GOLDM FUT 04 DEC 26',expiry:'2026-12-04',lotSize:1,qtyMultiplier:10,tickSize:100};
const call={...future,instrumentType:'CE',instrumentKey:'MCX_FO|C123',
 underlyingKey:future.instrumentKey,tradingSymbol:'GOLDM 100000 CE 05 NOV 26',
 expiry:'2026-11-05',strike:100000,lotSize:1,qtyMultiplier:10,tickSize:5};
const put={...call,instrumentType:'PE',instrumentKey:'MCX_FO|P123',tradingSymbol:'GOLDM 100000 PE 05 NOV 26'};
const futures=[{...future,expiry:'2026-10-08',instrumentKey:'MCX_FO|OLD'},
 {...future,instrumentKey:'MCX_FO|OTHER',expiry:'2026-11-04'},future];
const options=[{...call,underlyingKey:'MCX_FO|OTHER',expiry:'2026-10-08'},
 {...call,instrumentKey:'MCX_FO|COLD',expiry:'2026-10-08'},call,put,
 {...call,instrumentKey:'MCX_FO|C125',strike:100100},
 {...call,underlyingSymbol:'SILVER',instrumentKey:'MCX_FO|WRONG'}];
const linked=chooseMcxOptionUnderlying({futures,options,symbol:'GOLDM',asOf:now});
assert.equal(linked.future.instrumentKey,future.instrumentKey,'Exact option underlying key must select matched future, not nearest unrelated expiry');
assert.equal(chooseMcxOptionUnderlying({futures,options:options.map(x=>({...x,underlyingKey:''})),symbol:'GOLDM',asOf:now}).future,null);
assert.equal(chooseMcxOptionUnderlying({futures,options,symbol:'GOLD',asOf:now}).future,null);
const research={valid:true,completedBars:70,snapshot:{
 bias:'BULLISH',close:100050,vwap:100020,ema9:100040,ema21:100010,
 rsi14:61,macdHistogram:5,atr14:100,liquidityResearchPass:true
}};
const quote={valid:true,lastPrice:100050,bid:100049,ask:100051,spreadPercent:0.002,
 timestamp:now-1000,lastTradeTime:now-1500};
const session={exchange:'MCX',open:true,holidayCalendarVerified:false};
const ce=deriveMcxOptionDirection({future,research,quote,session,asOf:now});
assert.equal(ce.direction,'CE');
const pe=deriveMcxOptionDirection({future,research:{...research,snapshot:{...research.snapshot,
 bias:'BEARISH',close:99950,vwap:99970,ema9:99920,ema21:99980,rsi14:37,macdHistogram:-4}},
 quote,session,asOf:now});
assert.equal(pe.direction,'PE');
assert.equal(deriveMcxOptionDirection({future,research,quote:{...quote,lastTradeTime:now-300000},session,asOf:now}).direction,'WAIT');
assert.equal(deriveMcxOptionDirection({future,research,quote,session:{...session,open:false},asOf:now}).direction,'WAIT');
const chosen=chooseMcxOptionContract({options,future,spot:100009,direction:'CE',asOf:now});
assert.equal(chosen.contract.instrumentKey,call.instrumentKey);
assert.equal(chooseMcxOptionContract({options,future,spot:100009,direction:'PE',asOf:now}).contract.instrumentKey,put.instrumentKey);
assert.equal(chooseMcxOptionContract({options:options.map(x=>({...x,underlyingKey:null})),future,spot:100009,direction:'CE',asOf:now}).contract,null);
assert.equal(chooseMcxOptionContract({options,future,spot:100009,direction:'SELL',asOf:now}).contract,null);
const optionQuote={valid:true,bid:20,ask:20.05,lastPrice:20.03,spreadPercent:0.25,
 openInterest:2000,tradedVolume:3000,timestamp:now-1000,lastTradeTime:now-1500};
const premiumResearch={valid:true,completedBars:67,snapshot:{atr14:1,liquidityResearchPass:true}};
const input={contract:call,future,direction:'CE',quote:optionQuote,research:premiumResearch,asOf:now};
const plan=calculateMcxOptionPaperPlan(input);
assert.equal(plan.status,'UNVALIDATED_PAPER_LEVELS');
assert.equal(plan.entry,20.05);
assert.equal(plan.stopLoss,18.55);
assert.equal(plan.target1,22.3);
assert.equal(plan.target2,23.05);
assert.equal(plan.exposureUnitsPerLot,10);
assert.equal(plan.riskPerLot,16);
assert.equal(plan.preliminaryRiskLots,31);
assert.equal(plan.approvedLots,0);
assert.equal(plan.brokerMarginVerified,false);
assert.equal(plan.paperEnvelopeLots,null);
assert.equal(plan.orderSubmissionAllowed,false);
const margin={instrumentKey:call.instrumentKey,direction:'BUY',quantity:1,product:'I',
 price:20.05,requiredMargin:1000,verified:true,asOf:now};
const quoted=calculateMcxOptionPaperPlan({...input,marginQuote:margin});
assert.equal(quoted.brokerMarginVerified,true);
assert.equal(quoted.paperEnvelopeLots,31);
assert.equal(quoted.approvedLots,0);
assert.equal(calculateMcxOptionPaperPlan({...input,marginQuote:{...margin,quantity:10}}).brokerMarginVerified,false);
assert.equal(calculateMcxOptionPaperPlan({...input,marginQuote:{...margin,instrumentKey:'MCX_FO|OTHER'}}).brokerMarginVerified,false);
assert.equal(calculateMcxOptionPaperPlan({...input,marginQuote:{...margin,asOf:now-400000}}).brokerMarginVerified,false);
const oversized=calculateMcxOptionPaperPlan({...input,contract:{...call,qtyMultiplier:1000}});
assert.equal(oversized.status,'WAIT');
assert.ok(oversized.reasons.includes('ONE_MCX_OPTION_LOT_EXCEEDS_500_RISK_BUDGET'));
assert.equal(oversized.entry,null);
const missingMultiplier=calculateMcxOptionPaperPlan({...input,contract:{...call,qtyMultiplier:null}});
assert.equal(missingMultiplier.status,'WAIT');
const wrongFuture=calculateMcxOptionPaperPlan({...input,future:{...future,instrumentKey:'MCX_FO|WRONG'}});
assert.equal(wrongFuture.status,'WAIT');
assert.equal(calculateMcxOptionPaperPlan({...input,contract:{...call,expiry:'2026-10-08'}}).status,'WAIT');
assert.equal(calculateMcxOptionPaperPlan({...input,quote:{...optionQuote,timestamp:now-400000}}).status,'WAIT');
assert.equal(calculateMcxOptionPaperPlan({...input,research:{...premiumResearch,valid:false}}).status,'WAIT');
assert.equal(calculateMcxOptionPaperPlan({...input,capital:60000}).status,'WAIT');
assert.equal(calculateMcxOptionPaperPlan({...input,quote:{...optionQuote,spreadPercent:5}}).status,'WAIT');
assert.deepEqual(MCX_OPTION_SAFETY,{paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false});
console.log('MCX AUTO CE/PE PAPER QUALIFICATION PASSED: exact futures link, 5m direction, expiry, multiplier exposure, premium entry/SL/targets, ₹500 cap, margin, fail-closed, zero orders');
