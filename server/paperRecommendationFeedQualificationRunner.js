import assert from 'node:assert/strict';
import {RECOMMENDATION_MARKETS,RECOMMENDATION_FEED_SAFETY,
 qualifyPaperRecommendation,presentRecommendation,createPaperRecommendationFeed}
 from './paperRecommendationFeed.js';
import {readFileSync} from 'node:fs';

const asOf=Date.parse('2026-10-09T12:30:18+05:30');
const contract={underlyingSymbol:'NIFTY',segment:'NSE_FO',instrumentType:'CE',
 strike:25000,expiry:'2026-10-15',lotSize:65,tradingSymbol:'NIFTY OCT 25000 CE'};
const plan={status:'UNVALIDATED_PAPER_LEVELS',brokerMarginVerified:true,
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
 {...plan,status:'WAIT'}
];
for(const p of blocked)
 assert.equal(qualifyPaperRecommendation(p,contract,asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,expiry:'2026-10-09'},asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,lotSize:0},asOf),null);
assert.equal(qualifyPaperRecommendation(plan,{...contract,instrumentType:'PE'},asOf)?.optionType,'PE');
const mcx={...contract,segment:'MCX_FO'};
assert.equal(qualifyPaperRecommendation({...plan,independentlyVerifiedContractMultiplier:false},mcx,asOf),null);

const view=presentRecommendation({tab:'nifty',last:qualified,
 result:{state:'PAPER_SETUP',message:'Verified paper evidence',checkedAt:new Date(asOf).toISOString()},asOf});
assert.equal(view.state,'PAPER_SETUP');
assert.equal(view.orderSubmissionAllowed,false);
assert.equal(view.realOrderPlaced,false);
assert.equal(view.last.executionStatus,'NOT EXECUTED');
const later=presentRecommendation({tab:'nifty',last:qualified,
 result:{state:'WAIT',message:'No new setup'},asOf:asOf+6*60000});
assert.equal(later.state,'PAST_PAPER_IDEA');
assert.match(later.message,/not a current signal/i);
const zero=presentRecommendation({tab:'options',asOf});
assert.equal(zero.state,'WAIT');
assert.equal(zero.last,null);

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
assert.equal(a.state,'WAIT');assert.equal(b.state,'WAIT');
assert.equal(a.last,null);
assert.equal((await feed.getLatest('nifty',asOf+30000)).state,'WAIT');
assert.equal(searches,1,'30-second polling uses cached data instead of repeated upstream calls');
assert.equal((await feed.getLatest('nifty',asOf+47000)).state,'WAIT');
assert.equal(searches,2,'retry after cache TTL');
assert.equal((await feed.getLatest('commodity',asOf)).state,'WAIT');
assert.equal((await feed.getLatest('sensex',Date.parse('2026-10-09T08:00:00+05:30'))).state,'WAIT');
await assert.rejects(feed.getLatest('unverified-tab',asOf),/UNSUPPORTED_RECOMMENDATION_TAB/);
assert.equal(RECOMMENDATION_FEED_SAFETY.orderSubmissionAllowed,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.realOrderPlaced,false);
assert.equal(RECOMMENDATION_FEED_SAFETY.approvedLots,0);
const server=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(server,/\/api\/paper-recommendations\/latest/);
assert.match(server,/latestPaperRecommendations\.getLatest\(tab\)/);
assert.doesNotMatch(server,/\/v2\/order\/place|\/v3\/order\/place/);
console.log('BACKEND LAST RECOMMENDATION QUALIFICATION PASSED: verified pricing only, four tabs, 5-minute slot safety, stale history, cache, read-only, zero orders');
