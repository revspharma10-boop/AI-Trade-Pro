import assert from 'node:assert/strict';
import {buildIndexPredictionReview} from './services/indexPredictionReview.js';
const recordedAt='2026-10-09T06:50:00Z';
const prediction={id:'2026-10-09/NIFTY/1',symbol:'NIFTY',direction:'CE',status:'EVALUATED_30M_DIRECTION',
 recordedAt,indexQuote:25000,ema9:25010,ema21:24990,rsi14:64,macdHistogram:8,vwap:null,
 atr14:40,optionBuyEntry:100,optionStop:90,optionTarget1:115,outcome:{
 verdict:'WRONG_DIRECTION',observedCandleAt:'2026-10-09T07:20:00Z',
 observedClose:24960,signedDirectionalMove:-40,noiseThreshold:12.5}};
const post={ema9:24980,ema21:25010,rsi14:40,macdHistogram:-5,vwap:null,close:24960};
const loss=buildIndexPredictionReview({prediction,postTechnical:post});
assert.equal(loss.verdict,'WRONG_DIRECTION');
assert.equal(loss.technical.status,'PREDICTION_VS_OUTCOME_VERIFIED');
assert.ok(loss.technical.checks.some(c=>c.test==='EMA9/EMA21 trend'&&c.reversed));
assert.ok(loss.technical.checks.some(c=>c.test==='MACD histogram'&&c.reversed));
assert.equal(loss.fundamental.status,'NOT_VERIFIED');
assert.equal(loss.actualOptionPnLVerified,false);
assert.equal(loss.optionTargetHitVerified,false);
assert.equal(loss.automaticallyTrained,false);
assert.equal(loss.orderSubmissionAllowed,false);
assert.equal(buildIndexPredictionReview({prediction:{...prediction,direction:'WAIT'}}),null);
assert.equal(buildIndexPredictionReview({prediction:{...prediction,status:'PENDING_30M_DIRECTION'}}),null);
const win=buildIndexPredictionReview({prediction:{...prediction,outcome:{...prediction.outcome,verdict:'CORRECT_DIRECTION'}},postTechnical:{
 ...post,ema9:25020,ema21:25010,rsi14:63,macdHistogram:3}});
assert.equal(win.verdict,'CORRECT_DIRECTION');
assert.equal(win.technical.checks.filter(c=>c.reversed&&['EMA9/EMA21 trend','MACD histogram'].includes(c.test)).length,0);
assert.match(win.summary,/direction label only/);
const unknown=buildIndexPredictionReview({prediction,postTechnical:null,
 fundamentalContext:{verified:true,summary:'Earnings grew',sourceUrl:'https://example.org',observedAt:'2026-10-09T08:30:00Z'}});
assert.equal(unknown.fundamental.status,'NOT_VERIFIED','Post-outcome fundamentals cannot be leaked backwards');
assert.equal(unknown.technical.status,'OUTCOME_INDICATORS_NOT_VERIFIED');
const verified=buildIndexPredictionReview({prediction,postTechnical:post,fundamentalContext:{
 verified:true,summary:'Point-in-time context',sourceUrl:'https://example.org/breadth',observedAt:'2026-10-09T06:45:00Z'}});
assert.equal(verified.fundamental.status,'PRE_PREDICTION_EVIDENCE_PRESENT');
console.log('INDEX PREDICTION SELF REVIEW QUALIFIED: predicted first, actual second, technical explanations, sourced fundamentals only, zero orders');
