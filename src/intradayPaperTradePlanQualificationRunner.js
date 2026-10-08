import assert from 'node:assert/strict';
import {calculateIntradayPaperTradePlan,instrumentPriceTick} from './services/intradayPaperTradePlan.js';

const now=Date.parse('2026-10-08T15:30:00+05:30');
const gold={segment:'MCX_FO',instrumentType:'FUT',tradingSymbol:'GOLD FUT 04 DEC 26',
  underlyingSymbol:'GOLD',expiry:'2026-12-04',instrumentKey:'MCX_FO|495213',
  lotSize:1,qtyMultiplier:100,tickSize:100};
const mini={...gold,tradingSymbol:'GOLDM FUT 05 NOV 26',underlyingSymbol:'GOLDM',
  expiry:'2026-11-05',instrumentKey:'MCX_FO|55555',qtyMultiplier:10};
const research={valid:true,snapshot:{atr14:125,close:149600},completedBars:134};
const signal={direction:'BUY',status:'PROVISIONAL_UNVALIDATED'};
const quote={valid:true,lastPrice:149600,bid:149599,ask:149601,
 timestamp:now-5000,lastTradeTime:now-7000};
assert.equal(instrumentPriceTick(gold),1,'MCX raw tick size 100 maps to ₹1');
assert.equal(instrumentPriceTick({...gold,tickSize:5}),0.05);
const base={instrument:gold,research,quote,signal,capital:50000,riskPercent:1,asOf:now};
const buy=calculateIntradayPaperTradePlan(base);
assert.equal(buy.status,'PAPER_LEVELS_ONLY');
assert.equal(buy.direction,'BUY');
assert.equal(buy.capital,50000);
assert.equal(buy.riskBudget,500);
assert.equal(buy.entry,149601);
assert.ok(buy.stopLoss<buy.entry);
assert.ok(buy.target1>buy.entry);
assert.ok(buy.target2>buy.target1);
assert.ok(buy.grossLossPerLot>18000);
assert.equal(buy.qtyMultiplier,100);
assert.equal(buy.lotSize,1);
assert.equal(buy.preliminaryRiskBasedLots,0,'Standard GOLD 1-lot SL must exceed ₹500');
assert.equal(buy.approvedLots,0);
assert.equal(buy.marginEstimateVerified,false);
assert.equal(buy.brokerAvailableMarginVerified,false);
assert.equal(buy.brokerMarginPerLot,null);
assert.ok(buy.reasons.includes('ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET'));
assert.ok(buy.reasons.includes('REAL_TRADE_LOTS_LOCKED_AT_ZERO'));
assert.ok(!Number.isFinite(buy.brokerAvailableMargin));
const sell=calculateIntradayPaperTradePlan({...base,signal:{direction:'SELL',status:'PROVISIONAL_UNVALIDATED'}});
assert.equal(sell.direction,'SELL');
assert.equal(sell.entry,149599);
assert.ok(sell.stopLoss>sell.entry);
assert.ok(sell.target1<sell.entry);
assert.ok(sell.target2<sell.target1);
assert.equal(sell.approvedLots,0);
const miniResearch={valid:true,snapshot:{atr14:20,close:149600}};
const minQuote={...quote,bid:149599.5,ask:149600.5};
const miniSignal=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,quote:minQuote});
assert.equal(miniSignal.preliminaryRiskBasedLots,1);
const freshMargin={instrumentKey:mini.instrumentKey,direction:'BUY',quantity:1,product:'I',
 requiredMargin:20000,asOf:now+1000,verified:true};
const margin=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:freshMargin});
assert.equal(margin.marginEstimateVerified,true);
assert.equal(margin.brokerMarginPerLot,20000);
assert.equal(margin.theoreticalBudgetMarginLots,2);
assert.equal(margin.riskAndMarginEnvelopeLots,1);
assert.equal(margin.approvedLots,0,'Broker margin estimate does not prove account funds');
assert.ok(margin.reasons.includes('ACTUAL_UPSTOX_AVAILABLE_FUNDS_NOT_VERIFIED'));
const notEnough=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:{...freshMargin,requiredMargin:100000}});
assert.equal(notEnough.theoreticalBudgetMarginLots,0);
assert.equal(notEnough.riskAndMarginEnvelopeLots,0);
const staleMargin=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:{...freshMargin,asOf:now-1000000}});
assert.equal(staleMargin.marginEstimateVerified,false);
const wrongContract=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:{...freshMargin,instrumentKey:'MCX_FO|BAD'}});
assert.equal(wrongContract.marginEstimateVerified,false);
const mismatchedSide=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:{...freshMargin,direction:'SELL'}});
assert.equal(mismatchedSide.marginEstimateVerified,false);
const verifiedFunds=calculateIntradayPaperTradePlan({...base,instrument:mini,research:miniResearch,
 quote:minQuote,marginQuote:freshMargin,brokerAvailableMargin:50000,
 brokerAvailableMarginVerified:true});
assert.equal(verifiedFunds.brokerFundsMathematicalLots,1);
assert.equal(verifiedFunds.approvedLots,0,'Execution stays disabled even when funds metadata provided');
const cases=[
 {signal:{direction:'WAIT',status:'BLOCKED'},expected:'PROVISIONAL_BUY_OR_SELL_SIGNAL_REQUIRED'},
 {research:{valid:false,snapshot:{atr14:125,close:149600}},expected:'VALID_ATR_REQUIRED'},
 {quote:{...quote,timestamp:now-200000},expected:'FRESH_VERIFIED_QUOTE_REQUIRED'},
 {quote:{...quote,lastTradeTime:now-200000},expected:'FRESH_VERIFIED_QUOTE_REQUIRED'},
 {instrument:{...gold,qtyMultiplier:null},expected:'LOT_SIZE_OR_QUANTITY_MULTIPLIER_UNVERIFIED'},
 {instrument:{...gold,tickSize:null},expected:'UPSTOX_EXCHANGE_TICK_REQUIRED'},
 {instrument:{...gold,expiry:'2026-10-08'},expected:'FUTURE_EXPIRED_OR_EXPIRY_DAY'},
 {riskPercent:2,expected:'FIFTY_THOUSAND_ONE_PERCENT_CAP_REQUIRED'},
 {capital:500000,expected:'FIFTY_THOUSAND_ONE_PERCENT_CAP_REQUIRED'},
 {instrument:{...gold,instrumentType:'CE',strike:148000},expected:'POSITION_CALCULATOR_SUPPORTS_EQUITY_AND_FUTURES_ONLY'}
];
for(const {expected,...change} of cases){
 const p=calculateIntradayPaperTradePlan({...base,...change});
 assert.equal(p.status,'WAIT',expected);
 assert.equal(p.entry,null);
 assert.equal(p.approvedLots,0);
 assert.ok(p.reasons.includes(expected),expected+' missing: '+p.reasons.join(','));
 assert.equal(p.orderSubmissionAllowed,false);
}
assert.equal(buy.orderSubmissionAllowed,false);
assert.equal(buy.realOrderPlaced,false);
assert.equal(buy.netRiskIncludesBrokerage,false);
assert.equal(buy.performanceValidated,false);
console.log('PAPER INTRADAY PLAN QUALIFICATION PASSED: ₹500 cap, GOLD/MINI multiplier, BUY/SELL levels, margin constraints, risk lots, fail-closed cases, no orders');
