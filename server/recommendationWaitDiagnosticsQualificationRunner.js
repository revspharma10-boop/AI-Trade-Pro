import assert from 'node:assert/strict';
import {brokerVerifiedContractSummary,describePaperRejection}
 from './recommendationWaitDiagnostics.js';
import {readFileSync} from 'node:fs';
const at=Date.parse('2026-10-09T13:16:00+05:30');
const contract={segment:'NSE_FO',instrumentType:'CE',instrumentKey:'NSE_FO|50001',
 tradingSymbol:'NIFTY 15 OCT 25000 CE',strike:25000,expiry:'2026-10-15',lotSize:65};
const summary=brokerVerifiedContractSummary(contract,at);
assert.deepEqual(summary,{
 tradingSymbol:'NIFTY 15 OCT 25000 CE',optionType:'CE',strike:25000,
 expiry:'2026-10-15',paperOnly:true,orderSubmissionAllowed:false
});
assert.equal(Object.hasOwn(summary,'instrumentKey'),false,'Never expose exchange identifiers to Android');
for(const mutation of [
 {expiry:'2026-10-09'},{expiry:'INVALID'},{tradingSymbol:''},
 {segment:'NSE_EQ'},{instrumentType:'FUT'},
 {strike:0},{lotSize:0},{instrumentKey:'INVALID'}
])assert.equal(brokerVerifiedContractSummary({...contract,...mutation},at),null);

const rejected=describePaperRejection({stage:'OPTION_PREMIUM_AND_RISK',asOf:at,
 contract,codes:[
 'FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED',
 'OPTION_OPEN_INTEREST_OR_VOLUME_UNVERIFIED',
 'FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED',
 'BROKER_MARGIN_QUOTE_REQUIRED',
 'STRATEGY_NOT_BACKTESTED_OR_FORWARD_VALIDATED',
 'REAL_ORDER_LOTS_LOCKED_ZERO'
]});
assert.equal(rejected.state,'WAIT');
assert.equal(rejected.stage,'OPTION_PREMIUM_AND_RISK');
assert.equal(rejected.blockers.length,4,'Backend retains every known blocker for accurate diagnostics');
assert.equal(rejected.blockerCount,4);
assert.deepEqual(rejected.blockers.map(x=>x.code),[
 'FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED',
 'OPTION_OPEN_INTEREST_OR_VOLUME_UNVERIFIED',
 'FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED',
 'BROKER_MARGIN_QUOTE_REQUIRED'
]);
assert.match(rejected.message,/bid\/ask/i);
assert.match(rejected.message,/open interest/i);
assert.equal(rejected.verifiedContract.tradingSymbol,contract.tradingSymbol);
assert.equal(Object.hasOwn(rejected,'entry'),false);
assert.equal(Object.hasOwn(rejected,'target'),false);
assert.equal(Object.hasOwn(rejected,'stopLoss'),false);
const risk=describePaperRejection({stage:'OPTION_PREMIUM_AND_RISK',asOf:at,
 contract,codes:['ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET']});
assert.match(risk.message,/₹500/);
assert.equal(risk.state,'WAIT');
const margin=describePaperRejection({stage:'OPTION_PREMIUM_AND_RISK',asOf:at,
 contract,codes:['BROKER_MARGIN_QUOTE_REQUIRED']});
assert.match(margin.message,/Upstox option margin estimate/);
const broker=describePaperRejection({stage:'UPSTOX_DATA',asOf:at,
 codes:['UPSTOX_REAUTHENTICATION_REQUIRED']});
assert.equal(broker.blockers[0].code,'UPSTOX_REAUTHENTICATION_REQUIRED');
assert.match(broker.message,/Upstox login has expired/);
const rateLimit=describePaperRejection({stage:'UPSTOX_DATA',asOf:at,
 codes:['UPSTOX_RATE_LIMITED']});
assert.match(rateLimit.message,/rate limit/i);
const unavailable=describePaperRejection({stage:'UPSTOX_DATA',asOf:at,
 codes:['UPSTOX_RESEARCH_DATA_UNAVAILABLE']});
assert.match(unavailable.message,/could not be completed/);
const many=describePaperRejection({stage:'OPTION_PREMIUM_AND_RISK',asOf:at,
 codes:['FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED','OPTION_SPREAD_TOO_WIDE_OR_UNKNOWN',
  'OPTION_OPEN_INTEREST_OR_VOLUME_UNVERIFIED','FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED',
  'ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET','BROKER_MARGIN_QUOTE_REQUIRED',
  'BROKER_MARGIN_ESTIMATE_UNAVAILABLE']});
assert.equal(many.blockerCount,7);
assert.equal(many.blockers.length,7);

const noContract=describePaperRejection({stage:'OPTION_CONTRACT',asOf:at,
 codes:['NO_VERIFIED_FUTURE_EXPIRY_OPTION_CONTRACT']});
assert.equal(noContract.verifiedContract,null);
assert.match(noContract.message,/No exchange-listed option contract/);
const technical=describePaperRejection({stage:'UNDERLYING_TECHNICAL',asOf:at,
 codes:['FRESH_UNDERLYING_PRICE_REQUIRED','NO_CLEAR_TECHNICAL_DIRECTION']});
assert.match(technical.message,/underlying market quote/);
assert.match(technical.message,/EMA/);
const unknown=describePaperRejection({stage:'UNKNOWN',codes:['BROKER_SUPER_SECRET_RANDOM_VALUE'],
 contract,asOf:at});
assert.deepEqual(unknown.blockers.map(x=>x.code),['RECOMMENDATION_REJECTED']);
assert.doesNotMatch(unknown.message,/SUPER_SECRET/,'Unknown broker text must not leak to Android');
const mcx=describePaperRejection({stage:'MCX_OPTION_QUALIFICATION',
 codes:['MCX_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED'],asOf:at});
assert.match(mcx.message,/multiplier.*independently/i);
const server=readFileSync(new URL('./paperRecommendationFeed.js',import.meta.url),'utf8');
assert.match(server,/selected\.reasons/,'Surface broker-verified option selection blockers');
assert.match(server,/\.\.\.\(plan\.reasons\?\?\[\]\)/,'Use original risk engine reason codes');
assert.match(server,/verifiedContract:result\?\.verifiedContract/,'Persist verified metadata');
assert.match(server,/Promise\.allSettled\(\[\s*getCandles\(contract\.instrumentKey/,'Report quote missing without losing contract');
assert.doesNotMatch(server,/orderSubmissionAllowed:true|approvedLots:1/);
console.log('ANDROID PAPER REJECTION DIAGNOSTICS PASSED: precise option quote, liquidity, risk, margin and contract blockers with zero executable prices/orders');
