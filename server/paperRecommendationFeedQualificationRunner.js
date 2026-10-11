import assert from 'node:assert/strict';
import {RECOMMENDATION_MARKETS,RECOMMENDATION_FEED_SAFETY,
 qualifyPaperRecommendation,presentRecommendation,createPaperRecommendationFeed,qualifyProvisionalDirection}
 from './paperRecommendationFeed.js';
import {readFileSync} from 'node:fs';
import {publishedEquitySession2026,EQUITY_CALENDAR_2026_VERSION}
 from '../src/services/intradayMarketClock.js';

const asOf=Date.parse('2026-10-09T12:30:18+05:30');
const contract={underlyingSymbol:'NIFTY',segment:'NSE_FO',instrumentType:'CE',
 strike:25000,expiry:'2026-10-15',lotSize:65,tradingSymbol:'NIFTY OCT 25000 CE'};
const plan={status:'UNVALIDATED_PAPER_LEVELS',optionType:'CE',direction:'CE',brokerMarginVerified:true,
 paperEnvelopeLots:1,entry:59,stopLoss:52,target1:70,target2:74,target3:80,
 riskPerLot:455,orderSubmissionAllowed:false,realOrderPlaced:false};
assert.deepEqual(Object.keys(RECOMMENDATION_MARKETS),['nifty','sensex','options','commodity']);
assert.deepEqual(Object.values(RECOMMENDATION_MARKETS).map(x=>x.symbol),
 ['NIFTY','SENSEX','INFY','GOLD']);
const qualified=qualifyPaperRecommendation(plan,contract,asOf);
assert.ok(qualified);
assert.equal(qualified.contract,'NIFTY OCT 25000 CE');
assert.equal(qualified.entry,59);
assert.equal(qualified.target,70);
assert.equal(qualified.stopLoss,52);
assert.equal(qualified.executionStatus,'NOT EXECUTED');
assert.equal(qualified.approvedLots,0);
assert.equal(qualified.date,'2026-10-09');
const blocked=[
 {...plan,brokerMarginVerified:false},
 {...plan,paperEnvelopeLots:0},
 {...plan,riskPerLot:501},
 {...plan,orderSubmissionAllowed:true},
 {...plan,realOrderPlaced:true},
 {...plan,entry:0},
 {...plan,stopLoss:59},
 {...plan,target1:58},
 {...plan,status:'WAIT'},
 {...plan,direction:'PE'},
 {...plan,optionType:'PE'}
];
for(const p of blocked)
 assert.equal(qualifyPaperRecommendation(p,contract,asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,expiry:'2026-10-09'},asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,lotSize:0},asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,instrumentType:'PE'},asOf),null);
const mcx={...contract,segment:'MCX_FO'};
assert.equal(qualifyPaperRecommendation({...plan,independentlyVerifiedContractMultiplier:false},mcx,asOf),null);

const view=presentRecommendation({tab:'nifty',last:qualified,
 result:{state:'PAPER_SETUP',message:'Verified paper evidence',checkedAt:new Date(asOf).toISOString()},asOf});
assert.equal(view.state,'PAPER_SETUP');
assert.equal(view.orderSubmissionAllowed,false);
assert.equal(view.realOrderPlaced,false);
assert.equal(view.last.executionStatus,'NOT EXECUTED');
for(const checkedAt of [null,'bad-time',
 new Date(asOf-7*60000).toISOString(),
 new Date(asOf+11000).toISOString(),
 new Date(asOf-11000).toISOString()]){
 const unsafe=presentRecommendation({tab:'nifty',last:qualified,
  result:{state:'PAPER_SETUP',checkedAt},asOf});
 assert.notEqual(unsafe.state,'PAPER_SETUP',
  'Backend must not claim a current setup with unverified or contradictory research time');
 assert.equal(unsafe.last.executionStatus,'NOT EXECUTED');
 assert.equal(unsafe.orderSubmissionAllowed,false);
}
const freshFrozen=presentRecommendation({tab:'nifty',last:qualified,
 result:{state:'PAPER_SETUP',checkedAt:new Date(asOf).toISOString()},asOf:asOf+30000});
assert.equal(freshFrozen.state,'PAPER_SETUP',
 'Frozen 5-minute paper idea remains current within its original time slot');
const later=presentRecommendation({tab:'nifty',last:qualified,
 result:{state:'WAIT',message:'No new setup'},asOf:asOf+6*60000});
assert.equal(later.state,'PAST_PAPER_IDEA');
assert.match(later.message,/not a current signal/i);
const waitWithContract=presentRecommendation({tab:'nifty',asOf,
 result:{state:'WAIT',stage:'OPTION_PREMIUM_AND_RISK',
 message:'Broker margin estimate unavailable',
 verifiedContract:{tradingSymbol:contract.tradingSymbol,optionType:'CE',
 strike:contract.strike,expiry:contract.expiry,paperOnly:true,orderSubmissionAllowed:false},
 blockers:[{code:'BROKER_MARGIN_QUOTE_REQUIRED',
 message:'Upstox option margin estimate is unavailable or unverified'}]}});
assert.equal(waitWithContract.state,'WAIT');
assert.equal(waitWithContract.verifiedContract.tradingSymbol,contract.tradingSymbol);
assert.equal(waitWithContract.last,null,'Verified contract alone must not create paper recommendation');
assert.equal(waitWithContract.blockers[0].code,'BROKER_MARGIN_QUOTE_REQUIRED');
assert.equal(waitWithContract.orderSubmissionAllowed,false);

const zero=presentRecommendation({tab:'options',asOf});
assert.equal(zero.state,'WAIT');
assert.equal(zero.last,null);

// Published regular-session calendar is only a schedule; it does not imply
// that Upstox is authenticated or that the market is actually open.
const atIST=(date,clock='12:30:18')=>Date.parse(date+'T'+clock+'+05:30');
const planned=publishedEquitySession2026({segment:'NSE_INDEX',asOf:atIST('2026-10-12')});
assert.equal(planned.regularSessionPlanned,true);
assert.equal(planned.liveSessionVerified,false);
assert.equal(planned.sourceVersion,EQUITY_CALENDAR_2026_VERSION);
assert.equal(publishedEquitySession2026({segment:'BSE_INDEX',asOf:atIST('2026-10-12')}).regularSessionPlanned,true);
for(const [day,reason] of [
 ['2026-10-11','EQUITY_MARKET_WEEKEND'],
 ['2026-10-20','EQUITY_EXCHANGE_HOLIDAY'],
 ['2026-11-08','EQUITY_SPECIAL_SESSION_UNVERIFIED'],
 ['2026-12-25','EQUITY_EXCHANGE_HOLIDAY'],
 ['2027-01-04','EQUITY_CALENDAR_YEAR_UNVERIFIED']
]){
 for(const segment of ['NSE_INDEX','BSE_INDEX']){
  const status=publishedEquitySession2026({segment,asOf:atIST(day)});
  assert.equal(status.regularSessionPlanned,false,day+' must fail closed');
  assert.equal(status.reason,reason);
 }
}
assert.equal(publishedEquitySession2026({segment:'MCX_FO',asOf}).reason,
 'EQUITY_CALENDAR_SEGMENT_UNSUPPORTED');
assert.equal(publishedEquitySession2026({segment:'NSE_EQ',asOf:'invalid'}).regularSessionPlanned,false);

let searches=0;
const mock={
 searchIndex:async()=>{searches++;throw Error('UPSTOX_REAUTHENTICATION_REQUIRED');},
 searchEquity:async()=>{throw Error('UPSTOX_REAUTHENTICATION_REQUIRED');},
 searchDerivatives:async()=>({contracts:[]}),
 getContracts:async()=>[],
 getCandles:async()=>({candles:[]}),
 getQuote:async()=>({}),
 getMargin:async()=>{throw Error('UPSTOX_MARGIN_ESTIMATE_UNAVAILABLE');}
};
const feed=createPaperRecommendationFeed(mock);
const [a,b]=await Promise.all([feed.getLatest('nifty',asOf),feed.getLatest('nifty',asOf)]);
assert.equal(searches,1,'concurrent requests share one backend call');
assert.equal((await feed.getLatest('nifty',asOf+30000)).state,'WAIT');
assert.equal(searches,1,'30-second polling uses cached data instead of repeated upstream calls');
assert.equal((await feed.getLatest('nifty',asOf+47000)).state,'WAIT');
assert.equal(searches,2,'retry after cache TTL');
// When closed, no broker instrument/quote request should even start.
for(const date of ['2026-10-11','2026-10-20','2027-01-04']){
 const priorSearches=searches;
 const result=await feed.getLatest('nifty',atIST(date));
 assert.equal(result.state,'WAIT');
 assert.equal(result.stage,'MARKET_SESSION');
 assert.equal(searches,priorSearches,'Closed/unverified schedule must not call broker');
 assert.equal(result.orderSubmissionAllowed,false);
}
const weekend=await feed.getLatest('sensex',atIST('2026-10-11'));
assert.equal(weekend.blockers[0].code,'EQUITY_MARKET_WEEKEND');
const bseHoliday=await feed.getLatest('sensex',atIST('2026-10-20'));
assert.equal(bseHoliday.blockers[0].code,'EQUITY_EXCHANGE_HOLIDAY');

assert.equal(a.state,'WAIT');assert.equal(b.state,'WAIT');
assert.equal(a.last,null);
assert.equal(a.stage,'UPSTOX_DATA');
assert.equal(a.blockers[0].code,'UPSTOX_REAUTHENTICATION_REQUIRED');
assert.match(a.message,/login has expired/);
assert.equal(a.blockerCount,1);
assert.equal(a.verifiedContract,null);


const regularDay=await feed.getLatest('sensex',atIST('2026-10-12'));
assert.equal(regularDay.stage,'UPSTOX_DATA',
 'Planned weekday may proceed to broker preflight, not fabricate a prediction');

assert.equal((await feed.getLatest('commodity',asOf)).state,'WAIT');
assert.equal((await feed.getLatest('sensex',Date.parse('2026-10-09T08:00:00+05:30'))).state,'WAIT');
await assert.rejects(feed.getLatest('unverified-tab',asOf),/UNSUPPORTED_RECOMMENDATION_TAB/);
assert.equal(RECOMMENDATION_FEED_SAFETY.orderSubmissionAllowed,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.realOrderPlaced,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.approvedLots,0);
// Synthetic-only integrated qualification of post-09:30 read-only direction.
const earlyAt=atIST('2026-10-09','09:30:18');
const idxKey='NSE_INDEX|Nifty 50';
const openingBars=[
 ['09:15:00',25000,25030,24990,25025],
 ['09:20:00',25025,25060,25020,25050],
 ['09:25:00',25050,25090,25045,25083]
].map(([clock,open,high,low,close])=>({
 datetime:new Date(atIST('2026-10-09',clock)).toISOString(),
 open,high,low,close,volume:123}));
let brokerReads=0,optionLookups=0,quoteIdentity=idxKey;
const directionalMock={
 searchIndex:async()=>{brokerReads++;return {instrumentKey:idxKey,tradingSymbol:'NIFTY'};},
 searchEquity:async()=>{throw Error('NOT_REQUESTED');},
 searchDerivatives:async()=>({contracts:[]}),
 getContracts:async()=>{optionLookups++;return [];},
 getCandles:async()=>({candles:openingBars}),
 getQuote:async()=>({mode:'READ_ONLY',instrumentKey:quoteIdentity,
  lastPrice:25085,timestamp:earlyAt}),
 getMargin:async()=>{throw Error('NOT_REQUESTED');}
};
const directionFeed=createPaperRecommendationFeed(directionalMock);
const first=await directionFeed.getLatest('nifty',earlyAt);
assert.equal(first.state,'WAIT','Early direction must not qualify a paper option setup');
assert.equal(first.stage,'OPENING_RANGE');
assert.equal(first.provisionalDirection?.direction,'BULLISH');
assert.equal(first.provisionalDirection?.kind,'PROVISIONAL_DIRECTION');
assert.equal(first.provisionalDirection?.optionPlanQualified,false);
assert.equal(first.provisionalDirection?.orderSubmissionAllowed,false);
assert.equal(first.provisionalDirection?.recordedDurably,false);
assert.equal(first.last,null);
assert.equal(first.verifiedContract,null);
assert.equal(first.realOrderPlaced,false);
assert.equal(optionLookups,0,'Early bias never invokes option contract selection');
assert.equal(brokerReads,1);
const frozen=await directionFeed.getLatest('nifty',earlyAt+61000);
assert.equal(frozen.provisionalDirection?.observedAt,first.provisionalDirection.observedAt,
 'Early directional snapshot freezes in its five-minute window');
assert.equal(brokerReads,1,'Frozen five-minute window does not requery broker');
const staleEarly=await directionFeed.getLatest('nifty',earlyAt+6*60000);
assert.equal(staleEarly.provisionalDirection,null,
 'Stale quote cannot be replayed as a new five-minute forecast');
assert.equal(staleEarly.state,'WAIT');
const beforeWeekend=brokerReads;
const closedEarly=await directionFeed.getLatest('nifty',atIST('2026-10-11','09:30:18'));
assert.equal(closedEarly.provisionalDirection,null);
assert.equal(brokerReads,beforeWeekend,'Closed market should not make broker calls');
quoteIdentity='BSE_INDEX|SENSEX';
const mismatchFeed=createPaperRecommendationFeed(directionalMock);
const mismatch=await mismatchFeed.getLatest('nifty',earlyAt);
assert.equal(mismatch.provisionalDirection,null,
 'Quote instrument mismatch must not be published as verified direction');
quoteIdentity=idxKey;
const forged={kind:'PROVISIONAL_DIRECTION',strategy:'OPENING_RANGE_15M',
 direction:'BEARISH',source:'UPSTOX_READ_ONLY',recordedDurably:false,
 observedAt:new Date(earlyAt).toISOString(),paperOnly:true,
 optionPlanQualified:false,orderSubmissionAllowed:false,realOrderPlaced:false};
const safePreview=presentRecommendation({tab:'nifty',result:{
 state:'WAIT',stage:'OPENING_RANGE',checkedAt:new Date(earlyAt).toISOString(),
 provisionalDirection:forged},asOf:earlyAt});
assert.equal(safePreview.provisionalDirection?.direction,'BEARISH');
for(const unsafe of [
 {...forged,orderSubmissionAllowed:true},
 {...forged,entry:99},
 {...forged,direction:'CE'},
 {...forged,observedAt:new Date(earlyAt-600000).toISOString()}
]){
 const bad=presentRecommendation({tab:'nifty',result:{
  state:'WAIT',stage:'OPENING_RANGE',checkedAt:new Date(earlyAt).toISOString(),
  provisionalDirection:unsafe},asOf:earlyAt});
 assert.equal(bad.provisionalDirection,null,'Forged or expired hypothesis must fail closed');
}
assert.equal(presentRecommendation({tab:'commodity',result:{
 state:'WAIT',stage:'OPENING_RANGE',checkedAt:new Date(earlyAt).toISOString(),
 provisionalDirection:forged},asOf:earlyAt}).provisionalDirection,null);
assert.equal(qualifyProvisionalDirection({
 early:{valid:true,strategy:'OPENING_RANGE_15M',status:'PROVISIONAL_OPENING_BIAS',
  direction:'CE',lastCompletedAt:openingBars[2].datetime,optionPlanQualified:false,
  paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false},
 quote:{mode:'READ_ONLY',instrumentKey:'BSE_INDEX|SENSEX',
  lastPrice:25085,timestamp:earlyAt},underlyingKey:idxKey,asOf:earlyAt
}),null,'Cross-instrument read-only quotes must be rejected before publication');

const source=readFileSync(new URL('./paperRecommendationFeed.js',import.meta.url),'utf8');
assert.match(source,/let marginLookupFailed=false/);
assert.match(source,/marginLookupFailed\?\['BROKER_MARGIN_ESTIMATE_UNAVAILABLE'\]/);
assert.match(source,/describePaperRejection\(\{stage:'UPSTOX_DATA'/);

const server=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(server,/body\?\.status!=='success'/,
 'Provider quote and candle endpoints must require actual successful Upstox responses');
assert.match(server,/const numberValue=/,
 'Provider must not coerce null OHLCV into valid numeric data');
assert.match(server,/\/api\/paper-recommendations\/latest/);
assert.match(server,/latestPaperRecommendations\.getLatest\(tab\)/);
assert.doesNotMatch(server,/\/v2\/order\/place|\/v3\/order\/place/);
console.log('BACKEND LAST RECOMMENDATION QUALIFICATION PASSED: verified pricing only, four tabs, 5-minute slot safety, stale history, cache, read-only, zero orders');
