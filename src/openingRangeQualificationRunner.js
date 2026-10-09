import assert from 'node:assert/strict';
import {deriveOpeningRangeBias,OPENING_RANGE_SAFETY} from './services/openingRangeResearch.js';
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
assert.equal(OPENING_RANGE_SAFETY.realOrderPlaced,false);
console.log('OPENING RANGE 09:30 QUALIFICATION PASSED: 3 completed OHLC candles, CE/PE/WAIT, quote freshness, no orders');
