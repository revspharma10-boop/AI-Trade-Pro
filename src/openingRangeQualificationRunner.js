import assert from 'node:assert/strict';
import {deriveOpeningRangeBias,openingRangeProgress,OPENING_RANGE_SAFETY} from './services/openingRangeResearch.js';
const today='2026-10-09',ist=t=>Date.parse(today+'T'+t+'+05:30');
const sample=(ohlc)=>ohlc.map(([time,open,high,low,close])=>({
 datetime:new Date(ist(time)).toISOString(),open,high,low,close,volume:0}));
const rising=sample([
 ['09:15:00',25000,25030,24990,25025],
 ['09:20:00',25025,25060,25020,25050],
 ['09:25:00',25050,25090,25045,25083]]);
const session={open:true,exchange:'NSE'};
const q=(price,ts=ist('09:30:14'))=>({lastPrice:price,timestamp:ts});
const test=(bars=rising,quote=q(25085),time='09:30:15',s=session)=>
 deriveOpeningRangeBias({candles:bars,quote,session:s,asOf:ist(time)});
const pre=test(rising,q(25085),'09:29:55');
assert.equal(pre.direction,'WAIT');
assert.ok(pre.reasons.includes('OPENING_RANGE_NOT_FINISHED'));
const after=test();
assert.equal(after.direction,'CE');assert.equal(after.status,'PROVISIONAL_OPENING_BIAS');
assert.deepEqual(after.openingOHLC,{open:25000,high:25090,low:24990,close:25083});
assert.equal(after.openingRangeHigh,25090);assert.equal(after.openingRangeLow,24990);
assert.equal(after.breakoutConfirmedByQuote,false);
assert.equal(after.optionPlanQualified,false);
assert.equal(after.orderSubmissionAllowed,false);
assert.equal(test(rising,q(25100)).breakoutConfirmedByQuote,true);
assert.ok(test(rising,q(24980)).direction==='WAIT','Quote against bullish opening cannot publish bullish direction');
// Regression: a bullish trend can emerge AFTER the 09:30 range even if opening bars were mixed.
const mixed=sample([
 ['09:15:00',25000,25038,24985,25030],
 ['09:20:00',25030,25040,24970,24980],
 ['09:25:00',24980,25028,24965,25010]
]);
const neutral=test(mixed,q(25015));
assert.equal(neutral.direction,'WAIT','Mixed first 15m bars should not force a CE');
const firstBreak=sample([['09:30:00',25010,25070,25003,25062]]);
const mixedUp=test([...mixed,...firstBreak],q(25065,ist('09:35:15')),'09:35:16');
assert.equal(mixedUp.direction,'CE','Completed 5m breakout above initial range must qualify as early CE');
assert.equal(mixedUp.signalBasis,'COMPLETED_5M_UPSIDE_RANGE_BREAKOUT');
assert.equal(mixedUp.breakoutConfirmedByCompletedCandle,true);
assert.equal(mixedUp.lastCompletedAt,firstBreak[0].datetime,'Journal timestamp must advance after 09:30');
assert.equal(mixedUp.orderSubmissionAllowed,false);
assert.equal(mixedUp.breakoutDiagnostics.candleAt,firstBreak[0].datetime);
assert.deepEqual(mixedUp.breakoutDiagnostics.candleOHLC,{open:25010,high:25070,low:25003,close:25062});
assert.equal(mixedUp.breakoutDiagnostics.upsideCloseThreshold,25042.25);
assert.equal(mixedUp.breakoutDiagnostics.checks.bullishCloseBeyondBuffer,true);
assert.equal(mixedUp.breakoutDiagnostics.checks.bullishCandleBody,true);
assert.equal(mixedUp.breakoutDiagnostics.checks.bullishQuoteAboveRange,true);
assert.equal(mixedUp.breakoutDiagnostics.checks.bearishCloseBeyondBuffer,false);
assert.equal(mixedUp.breakoutDiagnostics.quoteAgeSeconds,1);
assert.equal(mixedUp.breakoutDiagnostics.candleAgeAfterCompletionSeconds,16);
assert.equal(mixedUp.optionPlanQualified,false);

const stalePost=test([...mixed,...firstBreak],q(25065,ist('09:55:14')),'09:55:16');
assert.equal(stalePost.direction,'WAIT','Never reuse a 09:30 completed breakout candle at 09:55');
assert.ok(stalePost.reasons.includes('POST_OPENING_CANDLE_STALE'));

assert.equal(test([...mixed,...firstBreak],q(25065,ist('09:34:50')),'09:34:59').direction,'WAIT',
 'Never look ahead to a still-in-progress breakout candle');
assert.equal(test([...mixed,...firstBreak],q(25025,ist('09:35:15')),'09:35:16').direction,'WAIT',
 'A completed breakout that has already reversed in the live quote is not current');
assert.equal(test([...mixed,...firstBreak],q(25065,ist('09:35:15')),'09:35:16',
 {open:false,exchange:'NSE'}).direction,'WAIT','No closed-market forecasts');
const nextBar=sample([['09:35:00',25062,25082,25053,25076]]);
const secondBreak=test([...mixed,...firstBreak,...nextBar],q(25078,ist('09:40:15')),'09:40:16');
assert.equal(secondBreak.direction,'CE');
assert.notEqual(secondBreak.lastCompletedAt,mixedUp.lastCompletedAt,
 'The next 5m snapshot must have a unique completed candle timestamp');
const quoteOnly=test(mixed,q(25090,ist('09:40:15')),'09:40:16');
assert.equal(quoteOnly.direction,'WAIT','A quote above range without completed breakout is not confirmation');
assert.equal(quoteOnly.breakoutDiagnostics.checks.postOpeningCompletedCandleAvailable,false);
assert.equal(quoteOnly.breakoutDiagnostics.checks.bullishQuoteAboveRange,true);
assert.equal(quoteOnly.breakoutDiagnostics.checks.bullishCloseBeyondBuffer,false);
assert.equal(quoteOnly.breakoutDiagnostics.candleOHLC,null);
assert.equal(quoteOnly.orderSubmissionAllowed,false);

const mixedDownCandle=sample([['09:30:00',25010,25011,24938,24941]]);
const mixedDown=test([...mixed,...mixedDownCandle],q(24940,ist('09:35:15')),'09:35:16');
assert.equal(mixedDown.direction,'PE');
assert.equal(mixedDown.breakoutConfirmedByCompletedCandle,true);
assert.equal(mixedDown.signalBasis,'COMPLETED_5M_DOWNSIDE_RANGE_BREAKOUT');
assert.equal(test([...mixed,...firstBreak,...firstBreak],q(25065,ist('09:35:15')),'09:35:16').direction,'WAIT',
 'Duplicate post-opening timestamps must not create research');
const falling=sample([
 ['09:15:00',25000,25010,24975,24980],
 ['09:20:00',24980,24984,24940,24945],
 ['09:25:00',24945,24946,24915,24920]]);
assert.equal(test(falling,q(24918)).direction,'PE');
assert.equal(test(falling,q(24910)).breakoutConfirmedByQuote,true);
assert.equal(test(rising,q(25085), '09:30:15',{open:false,exchange:'NSE'}).direction,'WAIT');
assert.equal(test(rising,q(25085,ist('09:20:00'))).direction,'WAIT');
assert.equal(test(rising,q(25085),'09:30:15',{open:true,exchange:'UNKNOWN'}).direction,'WAIT');
assert.equal(test(rising.slice(1),q(25085)).direction,'WAIT');
assert.equal(test([...rising,rising[0]],q(25085)).direction,'WAIT','Duplicate opening candles must fail closed');
const otherDay=sample([['09:15:00',25000,25030,24990,25025]]).map(x=>({...x,datetime:'2026-10-08T03:45:00.000Z'}));
assert.equal(test(otherDay,q(25085)).direction,'WAIT','No prior day opening data');
assert.equal(openingRangeProgress({candles:[],asOf:ist('09:15:38')}).completed,0);
assert.equal(openingRangeProgress({candles:[],asOf:ist('09:15:38')}).status,'COLLECTING_OPENING_RANGE');
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:15:38')}).completed,0,'No active unfinished candle counts');
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:20:12')}).completed,1);
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:25:12')}).completed,2);
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:30:12')}).completed,3);
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:30:12')}).status,'OPENING_RANGE_CANDLES_READY');
assert.equal(openingRangeProgress({candles:[],asOf:ist('09:30:20')}).status,'OPENING_RANGE_DATA_MISSING');
assert.equal(openingRangeProgress({candles:rising,asOf:ist('09:30:20')}).orderSubmissionAllowed,false);
assert.equal(OPENING_RANGE_SAFETY.realOrderPlaced,false);
console.log('OPENING RANGE 09:30 QUALIFICATION PASSED: 3 completed OHLC candles, CE/PE/WAIT, quote freshness, no orders');
