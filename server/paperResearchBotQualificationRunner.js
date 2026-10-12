import assert from 'node:assert/strict';
import {createPaperResearchBot,PAPER_BOT_SAFETY} from './paperResearchBot.js';
const at=(date,time)=>Date.parse(date+'T'+time+'+05:30');
let clock=at('2026-10-12','09:30:18'),calls=[],callback;
const feed={getLatest:async(tab,asOf)=>{
 calls.push({tab,asOf});
 return {state:'WAIT',stage:'OPENING_RANGE',blockerCount:1,
  lastCheckedAt:new Date(asOf).toISOString()};
}};
const bot=createPaperResearchBot({feed,now:()=>clock,
 setIntervalFn:fn=>{callback=fn;return {unref(){}};},clearIntervalFn:()=>{}});
assert.equal(bot.getStatus().state,'NOT_STARTED');
assert.equal(bot.start().state,'RUNNING_WHILE_SERVER_AWAKE');
await bot.tick();
assert.equal(calls.length,2);
assert.equal(bot.getStatus().completedCycles,1);
assert.equal(bot.getStatus().latest.nifty.state,'WAIT');
assert.equal(bot.getStatus().latest.sensex.stage,'OPENING_RANGE');
await bot.tick();
assert.equal(calls.length,2,'same 5m slot must not duplicate data retrieval');
clock=at('2026-10-12','09:35:18');await bot.tick();
assert.equal(calls.length,4);
clock=at('2026-10-12','09:37:30');await bot.tick();
assert.equal(calls.length,4,'late cron slots must fail closed');
clock=at('2026-10-12','15:25:18');await bot.tick();
assert.equal(calls.length,4,'near-close must refuse new paper research');
clock=at('2026-10-11','09:30:18');await bot.tick();
assert.equal(calls.length,4,'weekend must not call broker');
clock=at('2026-10-20','09:30:18');await bot.tick();
assert.equal(calls.length,4,'published holiday must not call broker');
clock=at('2026-10-12','09:40:18');callback();await Promise.resolve();
assert.equal(bot.getStatus().orderSubmissionAllowed,false);
assert.equal(bot.getStatus().realOrderPlaced,false);
assert.equal(bot.getStatus().recordedDurably,false);
assert.equal(bot.getStatus().processLocal,true);
assert.equal(PAPER_BOT_SAFETY.approvedLots,0);
assert.equal(bot.stop().state,'NOT_STARTED');
console.log('PAPER RESEARCH BOT PASS: one research attempt per 5-minute slot, both indices, session safety, ephemeral status, no orders');
