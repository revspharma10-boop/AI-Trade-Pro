// AI Trade Pro 2.0 Phase 0: executable baseline, not a trading strategy.
// All candles, prices and contracts in this test are synthetic fixtures used to
// reproduce the existing software behavior. They MUST NOT be shown as live data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketClockState} from './services/intradayMarketClock.js';
import {analyzeIntradayCandles} from './services/intradayTechnicalEngine.js';
import {deriveOpeningRangeBias} from './services/openingRangeResearch.js';
import {deriveAutoOptionDirection,calculateAutoOptionPaperPlan,
  AUTO_OPTION_SAFETY} from './services/autoOptionResearchEngine.js';
import {RECOMMENDATION_FEED_SAFETY,createPaperRecommendationFeed,
  qualifyPaperRecommendation} from '../server/paperRecommendationFeed.js';

const asOf=Date.parse('2026-10-09T09:40:20+05:30');
const timestamp=hhmm=>`2026-10-09T${hhmm}:00+05:30`;
const candles=[
  {datetime:timestamp('09:15'),open:100,high:100.9,low:99.2,close:100.5,volume:10000},
  {datetime:timestamp('09:20'),open:100.5,high:101.4,low:100.2,close:101.1,volume:11000},
  {datetime:timestamp('09:25'),open:101.1,high:101.8,low:100.8,close:101.6,volume:10500},
  {datetime:timestamp('09:30'),open:101.6,high:102.4,low:101.5,close:102.2,volume:12000},
  {datetime:timestamp('09:35'),open:102.2,high:103,low:102,close:102.7,volume:11000}
];
const quote={lastPrice:102.85,timestamp:asOf-1000};
const session=marketClockState({segment:'NSE_INDEX',asOf});
assert.equal(session.open,true,'Fixture must be within NSE clock hours');
const opening=deriveOpeningRangeBias({candles,quote,session,asOf});
assert.equal(opening.valid,true,'Repro fixture must verify completed opening range');
assert.equal(opening.direction,'CE','Opening range can be bullish after 09:30');
assert.equal(opening.breakoutConfirmedByCompletedCandle,true,
 'Repro fixture must include a confirmed 5-minute upside breakout');
assert.equal(opening.optionPlanQualified,false,
 'Early market direction is NOT an option purchase recommendation');

const technical=analyzeIntradayCandles(candles,{asOf,session,intervalMinutes:5});
assert.equal(technical.valid,false,'Original full technical strategy requires 35 bars');
assert.equal(technical.completedBars,5);
assert.ok(technical.reasons.includes('INSUFFICIENT_COMPLETED_TODAY_CANDLES'));
const full=deriveAutoOptionDirection({research:technical,underlyingQuote:quote,
 underlyingSegment:'NSE_INDEX',session,asOf});
assert.equal(full.direction,'WAIT',
 'Full technical output is WAIT even when earlier completed opening-range bias is CE');
assert.ok(full.reasons.includes('FRESH_UNDERLYING_5M_CANDLES_REQUIRED'));

const underlyingKey='NSE_INDEX|Fixture Nifty';
const called={search:0,candles:0,quote:0,options:0,margin:0};
const feed=createPaperRecommendationFeed({
  searchIndex:async symbol=>{
   assert.equal(symbol,'NIFTY');called.search++;
   return {instrumentKey:underlyingKey,tradingSymbol:'NIFTY'};
  },
  searchEquity:async()=>{throw Error('EQUITY_NOT_NEEDED_FOR_FIXTURE');},
  searchDerivatives:async()=>{throw Error('MCX_NOT_NEEDED_FOR_FIXTURE');},
  getContracts:async()=>{called.options++;throw Error('OPTION_NOT_REACHED_FOR_EARLY_BIAS');},
  getCandles:async(key,interval)=>{
   assert.equal(key,underlyingKey);assert.equal(interval,'5m');called.candles++;
   return {candles};
  },
  getQuote:async key=>{
   assert.equal(key,underlyingKey);called.quote++;
   return quote;
  },
  getMargin:async()=>{called.margin++;throw Error('MARGIN_NOT_REACHED_FOR_EARLY_BIAS');}
});
const response=await feed.getLatest('nifty',asOf);
assert.equal(response.state,'WAIT',
 'Current backend hides the positive opening-range direction from its output');
assert.equal(response.stage,'OPENING_RANGE');
assert.ok(response.blockers.some(x=>x.code==='OPENING_RANGE_BIAS_ONLY'),
 'Current backend acknowledges early CE bias only as a WAIT blocker');
assert.equal(response.last,null);
assert.equal(response.orderSubmissionAllowed,false);
assert.equal(response.realOrderPlaced,false);
assert.equal(called.options,0,'No option chain selected from provisional direction');
assert.equal(called.margin,0,'No broker margin checked from provisional direction');

// A valid broker-verified paper envelope is a SEPARATE requirement.
// These synthetic values merely test fail-closed gates, not model profitability.
const fakeContract={
 segment:'NSE_FO',underlyingSymbol:'NIFTY',instrumentType:'CE',
 instrumentKey:'NSE_FO|12345',tradingSymbol:'NIFTY FIXTURE CE',
 expiry:'2026-10-15',strike:101,lotSize:65,tickSize:5
};
const unverifiedPlan={
 status:'UNVALIDATED_PAPER_LEVELS',optionType:'CE',direction:'CE',
 entry:50,stopLoss:46,target1:56,target2:58,target3:62,
 riskPerLot:260,brokerMarginVerified:false,paperEnvelopeLots:1,
 orderSubmissionAllowed:false,realOrderPlaced:false
};
assert.equal(qualifyPaperRecommendation(unverifiedPlan,fakeContract,asOf),null,
 'Missing broker margin must block paper BUY');
assert.equal(qualifyPaperRecommendation({...unverifiedPlan,brokerMarginVerified:true,
 riskPerLot:550},fakeContract,asOf),null,
 '₹500 paper risk limit must block oversized loss');
assert.equal(qualifyPaperRecommendation({...unverifiedPlan,brokerMarginVerified:true,
 paperEnvelopeLots:0},fakeContract,asOf),null,
 'Zero affordable paper lots must block paper BUY');
assert.equal(AUTO_OPTION_SAFETY.orderSubmissionAllowed,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.productionRealTradingEnabled,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.realOrderPlaced,false);

const feedSource=readFileSync(new URL('../server/paperRecommendationFeed.js',import.meta.url),'utf8');
const uiSource=readFileSync(new URL('./androidBottomNavigation.js',import.meta.url),'utf8');
const serverSource=readFileSync(new URL('../server/upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(feedSource,/const lastByTab=new Map\(\),cache=new Map\(\),pending=new Map\(\)/,
 'Baseline: last recommendation/cache are in-process memory, not durable storage');
assert.match(feedSource,/if\(!session\.open\)return rejected/);
assert.match(uiSource,/setInterval\(\(\)=>\{void refresh\(\);\},30000\)/,
 'Baseline: frontend initiates 30-second polling');
assert.match(uiSource,/if\(document\.hidden\|\|loading\)return/,
 'Baseline: closed/hidden web page does not poll');
assert.match(serverSource,/\/api\/paper-recommendations\/latest/,
 'Baseline: read-only request-triggered recommendation endpoint exists');
assert.doesNotMatch(feedSource,/\/v2\/order\/place|\/v3\/order\/place/);
console.log('PHASE 0 BASELINE PASSED: synthetic 09:40 confirmed CE opening bias hidden behind WAIT, 35-bar full gate, separate risk/margin qualification, transient in-memory results, browser-led polling, paper-only');
