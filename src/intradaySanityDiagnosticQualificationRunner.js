import assert from 'node:assert/strict';
import { normalizeReadOnlyFailure } from './services/upstoxReadOnlyErrorCodes.js';
import { extractUpstoxLiveQuoteEvidence } from './services/intradayRiskEngine.js';
const tests=[
  [401,{},'UPSTOX_REAUTHENTICATION_REQUIRED'],
  [429,{},'UPSTOX_RATE_LIMITED'],
  [404,{},'BACKEND_ROUTE_NOT_DEPLOYED'],
  [403,{},'UPSTOX_PERMISSION_DENIED'],
  [502,{error:'UPSTOX_DERIVATIVE_SEARCH_FAILED'},'UPSTOX_DERIVATIVE_SEARCH_FAILED'],
  [502,{error:'UPSTOX_LIVE_QUOTE_FAILED'},'UPSTOX_LIVE_QUOTE_FAILED'],
  [502,{error:'UPSTOX_OPTION_GREEKS_UNAVAILABLE'},'UPSTOX_OPTION_GREEKS_UNAVAILABLE'],
  [502,{error:'UPSTOX_INTRADAY_DATA_EMPTY'},'UPSTOX_INTRADAY_DATA_EMPTY'],
  [502,{error:'UPSTOX_INTRADAY_REQUEST_FAILED'},'UPSTOX_INTRADAY_REQUEST_FAILED'],
  [502,{error:'private token abc123'},'UPSTOX_MARKET_DATA_UNAVAILABLE'],
  [500,{error:'database hostname /private/path'},'UPSTOX_BACKEND_SERVER_ERROR'],
  [400,{error:'INVALID_DERIVATIVE_SEARCH'},'INVALID_DERIVATIVE_SEARCH'],
  [400,{error:'unknown internal'},'UPSTOX_READ_ONLY_API_FAILED']
];
for(const [status,body,expected] of tests)assert.equal(normalizeReadOnlyFailure(status,body),expected);
const key='MCX_FO|test',now=Date.parse('2026-10-08T15:00:00+05:30');
const mk=(lastTradeTime)=>({instrumentKey:key,bid:50000,ask:50001,lastPrice:50000.5,timestamp:now,lastTradeTime});
assert.equal(extractUpstoxLiveQuoteEvidence(mk(now),key,now).valid,true);
const stale=extractUpstoxLiveQuoteEvidence(mk(now-300000),key,now);
assert.equal(stale.valid,false);
assert.ok(stale.reasons.includes('LAST_TRADE_STALE_OR_UNDATED'));
const missing=extractUpstoxLiveQuoteEvidence(mk(null),key,now);
assert.equal(missing.valid,false,'Last actual trade must be present');
assert.ok(missing.reasons.includes('LAST_TRADE_STALE_OR_UNDATED'));
const staleResponse=extractUpstoxLiveQuoteEvidence({...mk(now),timestamp:now-300000},key,now);
assert.equal(staleResponse.valid,false);
assert.ok(staleResponse.reasons.includes('QUOTE_STALE_OR_UNDATED'));
console.log('SANITY DIAGNOSTICS PASSED: '+tests.length+' HTTP cases + four quote timestamp safeguards');
