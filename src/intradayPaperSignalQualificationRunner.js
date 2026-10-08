import assert from 'node:assert/strict';
import {deriveIntradayPaperSignal,PAPER_SIGNAL_SAFETY} from './services/intradayPaperSignalEngine.js';
import {extractUpstoxLiveQuoteEvidence} from './services/intradayRiskEngine.js';
import {evaluateIntradayRecommendation} from './services/intradayRecommendationEngine.js';
const now=Date.parse('2026-10-08T14:30:00+05:30');
const instrument={segment:'MCX_FO',exchange:'MCX',instrumentType:'FUT',
 tradingSymbol:'GOLD FUT 04 DEC 26',underlyingSymbol:'GOLD',
 expiry:'2026-12-04',lotSize:1,tickSize:100,qtyMultiplier:100};
const quoteRaw={instrumentKey:'MCX_FO|495213',bid:149590,ask:149610,
 lastPrice:149600,timestamp:now-4000,lastTradeTime:now-15000,openInterest:17000};
const quote=extractUpstoxLiveQuoteEvidence(quoteRaw,'MCX_FO|495213',now);
const session={exchange:'MCX',open:true,holidayCalendarVerified:false,brokerSquareOffVerified:false};
const bullish={valid:true,completedBars:134,snapshot:{
 bias:'BULLISH',close:149550,vwap:149200,ema9:149500,ema21:149300,
 rsi14:62,macdHistogram:22,atr14:125,liquidityResearchPass:true,
 medianVolume20:90,lastVolumeRatio:1.2,averageTurnover20:2500000,
 lastCompletedAt:'2026-10-08T08:55:00.000Z',intervalMinutes:5
}};
const base={instrument,research:bullish,quote,session,asOf:now};
const buy=deriveIntradayPaperSignal(base);
assert.equal(buy.direction,'BUY');
assert.equal(buy.status,'PROVISIONAL_UNVALIDATED');
assert.equal(buy.observedLastPrice,149600);
assert.equal(buy.backtested,false);
assert.equal(buy.forwardValidated,false);
assert.equal(buy.winProbability,null);
assert.equal(buy.entry,null);
assert.equal(buy.stopLoss,null);
assert.deepEqual(buy.targets,[]);
assert.equal(buy.orderSubmissionAllowed,false);
const trade=evaluateIntradayRecommendation({instrument,candles:[],asOf:now,sessionOpen:true,
 spreadPercent:quote.spreadPercent,research:bullish,risk:{valid:false,reasons:['MCX_HOLIDAY_CALENDAR_NOT_VERIFIED']}});
assert.equal(trade.recommendation,'WAIT','Unvalidated BUY research must not become a qualified trade');
const bearish={...bullish,snapshot:{...bullish.snapshot,bias:'BEARISH',close:149630,
 vwap:149900,ema9:149550,ema21:149800,rsi14:38,macdHistogram:-18}};
const sell=deriveIntradayPaperSignal({...base,research:bearish});
assert.equal(sell.direction,'SELL');
assert.equal(sell.status,'PROVISIONAL_UNVALIDATED');
assert.equal(sell.orderSubmissionAllowed,false);
function wait(patch={},cause){
 const result=deriveIntradayPaperSignal({...base,...patch});
 assert.equal(result.direction,'WAIT',cause);
 assert.equal(result.observedLastPrice,null);
 assert.equal(result.entry,null);
 assert.equal(result.orderSubmissionAllowed,false);
 return result;
}
assert.ok(wait({session:{...session,open:false}},'closed MCX market').blocks.includes('SESSION_NOT_OPEN_FOR_PAPER_SIGNAL'));
assert.ok(wait({research:{...bullish,valid:false}},'unverified candles').blocks.includes('VALID_COMPLETED_CANDLES_REQUIRED'));
assert.ok(wait({research:{...bullish,completedBars:20}},'too few bars').blocks.includes('VALID_COMPLETED_CANDLES_REQUIRED'));
assert.ok(wait({research:{...bullish,snapshot:{...bullish.snapshot,bias:'MIXED'}}},'mixed trend').blocks.includes('NO_CLEAR_BUY_OR_SELL_SETUP'));
assert.ok(wait({research:{...bullish,snapshot:{...bullish.snapshot,liquidityResearchPass:false}}},'insufficient liquidity').blocks.includes('RESEARCH_LIQUIDITY_THRESHOLD_NOT_MET'));
assert.ok(wait({research:{...bullish,snapshot:{...bullish.snapshot,rsi14:85}}},'RSI overbought').blocks.includes('NO_CLEAR_BUY_OR_SELL_SETUP'));
assert.ok(wait({quote:{...quote,valid:false}},'invalid quote').blocks.includes('FRESH_LIVE_QUOTE_REQUIRED'));
assert.ok(wait({quote:{...quote,lastTradeTime:now-5*60000}},'stale last trade').blocks.includes('QUOTE_OR_LAST_TRADE_STALE'));
assert.ok(wait({quote:{...quote,timestamp:now-5*60000}},'stale quote response').blocks.includes('QUOTE_OR_LAST_TRADE_STALE'));
assert.ok(wait({quote:{...quote,spreadPercent:0.6}},'wide spread').blocks.includes('SPREAD_TOO_WIDE_OR_UNKNOWN'));
assert.ok(wait({quote:{...quote,lastPrice:155000}},'live price mismatch').blocks.includes('CANDLE_AND_LIVE_PRICE_DISAGREE'));
assert.ok(wait({instrument:{...instrument,expiry:'2026-10-08'}},'expiry-day contract').blocks.includes('FUTURE_EXPIRED_OR_EXPIRY_DAY'));
assert.ok(wait({instrument:{...instrument,instrumentType:'CE',strike:150000}},'option shorting unqualified').blocks.includes('PAPER_SIGNAL_INSTRUMENT_NOT_SUPPORTED'));
assert.ok(wait({instrument:{...instrument,lotSize:0}},'invalid lot').blocks.includes('VALID_LOT_SIZE_REQUIRED'));
assert.ok(wait({quote:null},'no quote').blocks.includes('FRESH_LIVE_QUOTE_REQUIRED'));
assert.deepEqual(PAPER_SIGNAL_SAFETY,{paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 productionRealTradingEnabled:false,strategyBacktested:false});
console.log('PAPER BUY/SELL RESEARCH QUALIFICATION PASSED: directional setups, stale/invalid quotes, expiry, liquidity, no orders, no unproven win rate');
