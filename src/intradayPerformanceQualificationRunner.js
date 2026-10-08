import assert from 'node:assert/strict';
import {summarizeIntradayPerformance} from './services/intradayPerformanceQualification.js';

const days=[];
let day=Date.parse('2026-09-01T00:00:00+05:30');
while(days.length<20){
 const ist=new Date(day+330*60000);
 if(ist.getUTCDay()>=1&&ist.getUTCDay()<=5)days.push(ist.toISOString().slice(0,10));
 day+=86400000;
}
const trades=Array.from({length:200},(_,i)=>({
 entryAt:days[Math.floor(i/10)]+'T10:00:00+05:30',
 exitAt:days[Math.floor(i/10)]+'T10:05:00+05:30',
 entry:100,exit:101,quantity:1,fees:0.1,slippage:0.1,
 direction:'LONG',kind:'EQUITY'
}));
const provenance='VERIFIED_OUT_OF_SAMPLE_BACKTEST';
const full=summarizeIntradayPerformance({trades,provenance});
assert.equal(full.sampleSize,200);
assert.equal(full.distinctDays,20);
assert.equal(full.winRatePercent,100);
assert.ok(full.lower95Percent>90);
assert.equal(full.qualified,true);
assert.equal(full.verifiedSuccessProbability,null);
assert.equal(summarizeIntradayPerformance({trades:trades.slice(0,15),provenance}).qualified,false);
assert.equal(summarizeIntradayPerformance({trades,provenance:'UNVERIFIED'}).qualified,false);
assert.equal(summarizeIntradayPerformance({trades:trades.slice(0,20),provenance,minTrades:1}).qualified,false,'Minimum sample cannot be bypassed');
const negative=trades.map((x,i)=>i<195?x:{...x,exit:50});
const losing=summarizeIntradayPerformance({trades:negative,provenance});
assert.ok(losing.winRatePercent>90);
assert.ok(losing.lower95Percent>90);
assert.ok(losing.netProfit<0);
assert.equal(losing.qualified,false,'High win rate with loss-making trades must fail');
assert.ok(losing.reasons.includes('NET_PROFIT_AFTER_COSTS_NOT_POSITIVE'));
assert.equal(summarizeIntradayPerformance({trades:[{...trades[0],fees:undefined}],provenance}).qualified,false);
assert.ok(summarizeIntradayPerformance({trades:[{...trades[0],kind:'CALL_OPTION',direction:'SHORT',lotSize:1}],provenance}).reasons.includes('INVALID_OR_UNSAFE_TRADE_RECORD'));
assert.ok(summarizeIntradayPerformance({trades:[{...trades[0],entryAt:'2026-09-06T10:00:00+05:30',exitAt:'2026-09-06T10:05:00+05:30'}],provenance}).reasons.includes('INVALID_OR_UNSAFE_TRADE_RECORD'));
assert.ok(summarizeIntradayPerformance({trades:[{...trades[0],entryAt:'2026-09-01T15:40:00+05:30',exitAt:'2026-09-01T15:45:00+05:30'}],provenance}).reasons.includes('INVALID_OR_UNSAFE_TRADE_RECORD'));
console.log('INTRADAY PERFORMANCE VALIDATION: PASSED (costs, 90% goal, statistical bound, hours, contract safety, min sample)');
