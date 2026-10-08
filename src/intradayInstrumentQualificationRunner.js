import assert from 'node:assert/strict';
import { evaluateIntradayRecommendation } from './services/intradayRecommendationEngine.js';
import { classifyIntradayInstrument } from './services/intradayInstrumentContract.js';
assert.equal(classifyIntradayInstrument({segment:'NSE_EQ',tradingSymbol:'RELIANCE'}).kind,'EQUITY');
assert.equal(classifyIntradayInstrument({segment:'NSE_FO',instrumentType:'FUT',tradingSymbol:'NIFTY FUT',expiry:'2026-10-29',lotSize:65}).kind,'FUTURE');
assert.equal(classifyIntradayInstrument({segment:'NSE_FO',instrumentType:'CE',tradingSymbol:'NIFTY CE',expiry:'2026-10-29',lotSize:65,strike:25000}).kind,'CALL_OPTION');
assert.equal(classifyIntradayInstrument({segment:'NSE_FO',instrumentType:'PE',tradingSymbol:'NIFTY PE',expiry:'2026-10-29',lotSize:65,strike:25000}).kind,'PUT_OPTION');
assert.equal(classifyIntradayInstrument({segment:'NSE_FO',instrumentType:'PE',tradingSymbol:'NIFTY PE'}).valid,false);
const now=Date.now();const candles=Array.from({length:35},(_,i)=>({datetime:new Date(now-(34-i)*300000).toISOString(),open:100,high:101,low:99,close:100,volume:1000}));
for(const kind of ['EQUITY','FUTURE','CALL_OPTION','PUT_OPTION']){
 const instrument=kind==='EQUITY'?{segment:'NSE_EQ',tradingSymbol:'TEST'}:{segment:'NSE_FO',instrumentType:kind==='FUTURE'?'FUT':kind==='CALL_OPTION'?'CE':'PE',tradingSymbol:'TEST',expiry:'2026-10-29',lotSize:65,strike:25000};
 const result=evaluateIntradayRecommendation({instrument,candles,asOf:now,sessionOpen:true,spreadPercent:0.1});
 assert.equal(result.recommendation,'WAIT');assert.equal(result.orderSubmissionAllowed,false);assert.equal(result.estimatedSuccessProbability,null);
}
console.log('Intraday equity/futures/options fail-closed unit tests PASSED');
