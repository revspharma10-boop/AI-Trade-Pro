import assert from 'node:assert/strict';
import {MARKET_QUOTE_POLL_MS,MARKET_QUOTE_SAFETY,MARKET_QUOTE_MAX_AGE_MS,
 assessMarketQuote,mayPollMarketQuote} from './services/marketQuoteRefreshPolicy.js';
const now=Date.parse('2026-10-09T09:45:00+05:30'),key='NSE_INDEX|Nifty 50';
const q={instrumentKey:key,lastPrice:25000,timestamp:now-1000};
assert.equal(MARKET_QUOTE_POLL_MS,30000);
assert.equal(MARKET_QUOTE_MAX_AGE_MS,120000);
assert.equal(assessMarketQuote({quote:q,expectedInstrumentKey:key,asOf:now}).fresh,true);
assert.equal(assessMarketQuote({quote:{...q,timestamp:now-200000},expectedInstrumentKey:key,asOf:now}).state,'STALE');
assert.equal(assessMarketQuote({quote:{...q,timestamp:now+20000},expectedInstrumentKey:key,asOf:now}).state,'STALE');
assert.equal(assessMarketQuote({quote:{...q,instrumentKey:'BSE_INDEX|SENSEX'},expectedInstrumentKey:key,asOf:now}).fresh,false);
const option={instrumentKey:'BSE_FO|123',lastPrice:100,bid:99.9,ask:100.1,
 timestamp:now-1000,lastTradeTime:now-2000};
const valid=assessMarketQuote({quote:option,expectedInstrumentKey:'BSE_FO|123',asOf:now,option:true});
assert.equal(valid.fresh,true);assert.equal(valid.bid,99.9);assert.equal(valid.ask,100.1);
assert.equal(assessMarketQuote({quote:{...option,lastTradeTime:now-300000},
 expectedInstrumentKey:'BSE_FO|123',asOf:now,option:true}).fresh,false);
assert.equal(assessMarketQuote({quote:{...option,ask:99},expectedInstrumentKey:'BSE_FO|123',
 asOf:now,option:true}).fresh,false);
assert.equal(mayPollMarketQuote({visible:true,session:{open:true},hasInstrument:true}),true);
assert.equal(mayPollMarketQuote({visible:false,session:{open:true},hasInstrument:true}),false);
assert.equal(mayPollMarketQuote({visible:true,session:{open:false},hasInstrument:true}),false);
assert.equal(mayPollMarketQuote({visible:true,session:{open:true},hasInstrument:true,alreadyRunning:true}),false);
assert.equal(MARKET_QUOTE_SAFETY.orderSubmissionAllowed,false);
console.log('30-SECOND READ-ONLY QUOTE REFRESH POLICY PASSED: freshness, exact key, option depth, market session, zero orders');
