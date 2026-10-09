import assert from 'node:assert/strict';
import {createDemoObservation,evaluateDemoObservations,mergeDemoObservation,demoSummary,demoCsv,DEMO_SAFETY,DEMO_SYMBOLS} from './services/indexDemoJournal.js';
const start=Date.parse('2026-10-09T12:20:00+05:30'),candleStart=Date.parse('2026-10-09T12:10:00+05:30');
const snapshot={valid:true,completedBars:36,snapshot:{close:22100,ema9:22120,ema21:22090,
 rsi14:60,macdHistogram:5,atr14:40,vwap:null,lastCompletedAt:new Date(candleStart).toISOString()}};
const quote={lastPrice:22103,timestamp:start-3000};
const entry=createDemoObservation({symbol:'NIFTY',asOf:start,underlyingKey:'NSE_INDEX|Nifty 50',
 session:{open:true},research:snapshot,quote,signal:{direction:'CE',reasons:[]},
 contract:{instrumentKey:'NSE_FO|123',tradingSymbol:'NIFTY CE',strike:22100,lotSize:65},
 plan:{entry:100,stopLoss:90,target1:115,target2:120,paperEnvelopeLots:1,reasons:['NOT_BACKTESTED']}});
assert.equal(entry.direction,'CE');
assert.equal(entry.status,'PENDING_30M_DIRECTION');
assert.equal(entry.optionBuyEntry,100);
assert.equal(entry.approvedRealLots,0);
assert.equal(entry.orderSubmissionAllowed,false);
const rows=mergeDemoObservation(mergeDemoObservation([],entry),entry);
assert.equal(rows.length,1,'Duplicate candle must never overwrite original prediction');
assert.equal(evaluateDemoObservations(rows,'NIFTY',[],start+1800000)[0].status,'PENDING_30M_DIRECTION');
const horizon=new Date(start+1800000).toISOString();
const label=evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22060}],start+2400000);
const early=new Date(candleStart+1800000).toISOString();
assert.equal(evaluateDemoObservations(rows,'NIFTY',[{datetime:early,close:100}],start+2400000)[0].outcome,null,
 'Do not judge predictions using candles less than 30 minutes after prediction was recorded');
assert.equal(label[0].status,'EVALUATED_30M_DIRECTION');
assert.equal(label[0].outcome.verdict,'WRONG_DIRECTION');
assert.equal(label[0].review.verdict,'WRONG_DIRECTION');
assert.equal(label[0].review.prediction.price,22103);
assert.equal(label[0].review.fundamental.status,'NOT_VERIFIED');
assert.equal(label[0].review.technical.status,'OUTCOME_INDICATORS_NOT_VERIFIED');
assert.equal(label[0].review.automaticallyTrained,false);
assert.equal(label[0].review.orderSubmissionAllowed,false);
assert.equal(label[0].outcome.realizedPaperOptionPnL,null);
assert.equal(label[0].approvedRealLots,0);
const correct=evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22170}],start+2400000)[0];
assert.equal(correct.outcome.verdict,'CORRECT_DIRECTION');
assert.equal(correct.review.verdict,'CORRECT_DIRECTION');
assert.match(correct.review.summary,/direction label only/);
assert.equal(evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22105}],start+2400000)[0].outcome.verdict,'INCONCLUSIVE_NOISE');
const wait=createDemoObservation({symbol:'SENSEX',asOf:start,research:{valid:false,reasons:['INSUFFICIENT_INTRADAY_CANDLES']},
 quote:null,signal:{direction:'WAIT',reasons:['INSUFFICIENT_INTRADAY_CANDLES']}});
assert.equal(wait.status,'WAIT');
assert.equal(evaluateDemoObservations([wait],'SENSEX',[{datetime:horizon,close:99999}],start+2400000)[0].outcome,null);
assert.equal(wait.review,null);
const summary=demoSummary([...label,wait]);
assert.equal(summary.predictions,1);assert.equal(summary.wait,1);assert.equal(summary.wrong,1);assert.equal(summary.correct,0);
assert.equal(summary.blockers.INSUFFICIENT_INTRADAY_CANDLES,1);
assert.ok(demoCsv([entry]).includes('NOT_BACKTESTED'));
assert.ok(demoCsv(label).includes('WRONG_DIRECTION'));
assert.ok(demoCsv(label).includes('NOT_VERIFIED'));
assert.equal(label[0].recordedAt,entry.recordedAt,'Initial evidence must remain immutable');

const earliest=Date.parse('2026-10-09T09:30:16+05:30');
const openingRange={valid:true,strategy:'OPENING_RANGE_15M',direction:'CE',
 lastCompletedAt:new Date(Date.parse('2026-10-09T09:25:00+05:30')).toISOString(),
 openingOHLC:{open:25000,high:25090,low:24990,close:25083},
 openingRangeHigh:25090,openingRangeLow:24990,range:100,
 breakoutConfirmedByQuote:false,evidence:['09:15–09:30 OHLC verified'],
 reasons:['EARLY_UNVALIDATED_15M_BIAS_NO_OPTION_TRADE']};
const earlyPrediction=createDemoObservation({symbol:'NIFTY',asOf:earliest,
 underlyingKey:'NSE_INDEX|Nifty 50',openingRange,quote:{lastPrice:25085,timestamp:earliest-1000},
 signal:{direction:'CE',reasons:openingRange.reasons},session:{open:true}});
assert.equal(earlyPrediction.direction,'CE','Must allow strict opening range signals without 35 candles');
assert.equal(earlyPrediction.predictionType,'EARLY_OPENING_RANGE_15M');
assert.equal(earlyPrediction.atr14,null,'Never disguise 15-minute range as ATR');
assert.equal(earlyPrediction.optionBuyEntry,null,'No early fake premium');
assert.equal(earlyPrediction.approvedRealLots,0);
assert.equal(earlyPrediction.openingOHLC.high,25090);
const earlyFuture=new Date(earliest+30*60*1000).toISOString();
const evaluatedEarly=evaluateDemoObservations([earlyPrediction],'NIFTY',
 [{datetime:earlyFuture,close:25160}],earliest+38*60*1000)[0];
assert.equal(evaluatedEarly.outcome.verdict,'CORRECT_DIRECTION');
assert.equal(evaluatedEarly.review.technical.status,'OPENING_RANGE_ENDPOINT_VERIFIED');
assert.match(evaluatedEarly.review.technical.conclusion,/above the opening high/);
assert.equal(evaluatedEarly.review.fundamental.status,'NOT_VERIFIED');
assert.equal(evaluatedEarly.review.optionTargetHitVerified,false);
assert.equal(evaluatedEarly.review.orderSubmissionAllowed,false);
assert.equal(evaluateDemoObservations([earlyPrediction],'NIFTY',[
 {datetime:new Date(earliest+25*60*1000).toISOString(),close:24000}],earliest+38*60*1000)[0].outcome,null);
assert.ok(demoCsv([earlyPrediction]).includes('openingOHLC.high'));

assert.deepEqual(DEMO_SYMBOLS,['NIFTY','BANKNIFTY','SENSEX']);
assert.equal(DEMO_SAFETY.autoStrategyUpdates,false);
console.log('INDEX DEMO JOURNAL QUALIFICATION PASSED: immutable snapshots, delayed outcome, WAIT, diagnostics, CSV and 0 orders');
