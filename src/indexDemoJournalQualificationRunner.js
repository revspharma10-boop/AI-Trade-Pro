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
const horizon=new Date(candleStart+1800000).toISOString();
const label=evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22060}],start+2400000);
assert.equal(label[0].status,'EVALUATED_30M_DIRECTION');
assert.equal(label[0].outcome.verdict,'WRONG_DIRECTION');
assert.equal(label[0].outcome.realizedPaperOptionPnL,null);
assert.equal(label[0].approvedRealLots,0);
assert.equal(evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22170}],start+2400000)[0].outcome.verdict,'CORRECT_DIRECTION');
assert.equal(evaluateDemoObservations(rows,'NIFTY',[{datetime:horizon,close:22105}],start+2400000)[0].outcome.verdict,'INCONCLUSIVE_NOISE');
const wait=createDemoObservation({symbol:'SENSEX',asOf:start,research:{valid:false,reasons:['INSUFFICIENT_INTRADAY_CANDLES']},
 quote:null,signal:{direction:'WAIT',reasons:['INSUFFICIENT_INTRADAY_CANDLES']}});
assert.equal(wait.status,'WAIT');
assert.equal(evaluateDemoObservations([wait],'SENSEX',[{datetime:horizon,close:99999}],start+2400000)[0].outcome,null);
const summary=demoSummary([...label,wait]);
assert.equal(summary.predictions,1);assert.equal(summary.wait,1);assert.equal(summary.wrong,1);assert.equal(summary.correct,0);
assert.equal(summary.blockers.INSUFFICIENT_INTRADAY_CANDLES,1);
assert.ok(demoCsv([entry]).includes('NOT_BACKTESTED'));
assert.deepEqual(DEMO_SYMBOLS,['NIFTY','BANKNIFTY','SENSEX']);
assert.equal(DEMO_SAFETY.autoStrategyUpdates,false);
console.log('INDEX DEMO JOURNAL QUALIFICATION PASSED: immutable snapshots, delayed outcome, WAIT, diagnostics, CSV and 0 orders');
