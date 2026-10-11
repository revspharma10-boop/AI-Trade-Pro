import assert from 'node:assert/strict';
import {ANDROID_TABS,androidTabById,safeRecommendationCard} from './androidBottomNavigation.js';
import {readFileSync} from 'node:fs';

assert.deepEqual(ANDROID_TABS.map(t=>t.label),['Nifty','Sensex','Options Trade','Commodity']);
assert.deepEqual(ANDROID_TABS.map(t=>t.id),['nifty','sensex','options','commodity']);
assert.equal(new Set(ANDROID_TABS.map(x=>x.id)).size,4);
for(const tab of ANDROID_TABS)assert.equal(androidTabById(tab.id),tab);
assert.equal(androidTabById('missing').id,'nifty');
const time=Date.parse('2026-10-09T12:30:18+05:30');
const paper={tab:'options',state:'PAPER_SETUP',message:'Backend paper setup',
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 lastCheckedAt:new Date(time).toISOString(),
 last:{contract:'INFY OCT 960 CE',optionType:'CE',entry:59,target:70,stopLoss:52,
  capturedAt:new Date(time).toISOString(),date:'2026-10-09',
  executionStatus:'NOT EXECUTED',approvedLots:0,paperOnly:true}};
const card=safeRecommendationCard(paper,'options',time);
assert.equal(card.state,'PAPER_SETUP');
assert.equal(card.tag,'PAPER BUY');
assert.equal(card.entry,'₹59.00');
assert.equal(card.target,'₹70.00');
assert.equal(card.stopLoss,'₹52.00');
assert.equal(card.date,'09/10/2026');
assert.equal(card.contract,'INFY OCT 960 CE');
assert.match(card.status,/Not executed/);
assert.match(card.backendStatus,/Backend research checked/);
assert.equal(safeRecommendationCard(paper,'options',time+30000).state,'PAPER_SETUP',
 'Frozen idea remains valid during the same five-minute slot');
assert.equal(safeRecommendationCard({...paper,lastCheckedAt:null},'options',time).state,'WAIT',
 'Missing backend research timestamp must never show PAPER BUY');
assert.equal(safeRecommendationCard({...paper,lastCheckedAt:'invalid'},'options',time).state,'WAIT',
 'Malformed backend research timestamp must fail closed');
assert.equal(safeRecommendationCard({...paper,
 lastCheckedAt:new Date(time+15000).toISOString()},'options',time).state,'WAIT',
 'Future-dated backend research must fail closed');
assert.equal(safeRecommendationCard({...paper,
 lastCheckedAt:new Date(time-7*60000).toISOString()},'options',time).state,'WAIT',
 'Stale backend research must not be branded as freshly refreshed');
assert.equal(safeRecommendationCard({...paper,
 lastCheckedAt:new Date(time-11000).toISOString()},'options',time).state,'WAIT',
 'Server check before signal capture indicates inconsistent research chronology');
assert.match(safeRecommendationCard({...paper,lastCheckedAt:null},'options',time).explanation,
 /timestamp missing, stale, or inconsistent/);
const historical=safeRecommendationCard({...paper,state:'PAST_PAPER_IDEA'},'options',time);
assert.equal(historical.state,'PAST_PAPER_IDEA');
assert.equal(historical.tag,'PAST PAPER IDEA');
assert.notEqual(historical.tag,'PAPER BUY');
const incomplete={tab:'nifty',state:'WAIT',
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 message:'Option 5-minute candles or liquidity are not qualified (35 fresh bars required)',
 stage:'OPTION_PREMIUM_AND_RISK',
 verifiedContract:{tradingSymbol:'NIFTY 15 OCT 25000 CE',optionType:'CE',strike:25000,
  expiry:'2026-10-15',paperOnly:true,orderSubmissionAllowed:false}};
const waiting=safeRecommendationCard(incomplete,'nifty',time);
assert.equal(waiting.state,'WAIT');
assert.equal(waiting.tag,'WAIT');
assert.equal(waiting.contract,'NIFTY 15 OCT 25000 CE');
assert.equal(waiting.entry,'—','Verified contract does NOT qualify a premium');
assert.equal(waiting.stopLoss,'—');
assert.equal(waiting.target,'—');
assert.equal(waiting.date,'—');
assert.match(waiting.status,/Setup WAIT/);
assert.match(waiting.explanation,/35 fresh bars/);
assert.equal(waiting.diagnosticStage,'OPTION PREMIUM AND RISK');
assert.deepEqual(waiting.failedChecks,[],'Unstructured legacy WAIT must not fabricate blockers');
const detailed=safeRecommendationCard({
 ...incomplete,blockerCount:5,blockers:[
 {code:'FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED',message:'Option bid/ask is not current'},
 {code:'FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED',message:'Option candles need 35 fresh bars'},
 {code:'ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET',message:'One lot exceeds ₹500 risk'},
 {code:'BROKER_MARGIN_QUOTE_REQUIRED',message:'Broker margin unavailable'},
 {code:'OPTION_SPREAD_TOO_WIDE_OR_UNKNOWN',message:'Option spread too wide'}
]},'nifty',time);
assert.equal(detailed.state,'WAIT');
assert.equal(detailed.contract,'NIFTY 15 OCT 25000 CE');
assert.equal(detailed.entry,'—');
assert.equal(detailed.failedChecks.length,3,'Only first three reasons appear in compact UI');
assert.equal(detailed.otherChecks,2,'Remaining blockers remain counted');
assert.deepEqual(detailed.failedChecks.map(x=>x.code),[
 'FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED',
 'FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED',
 'ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET'
]);
const beforeSelection=safeRecommendationCard({
 ...incomplete,stage:'UNDERLYING_TECHNICAL',verifiedContract:null,
 blockers:[{code:'NO_CLEAR_TECHNICAL_DIRECTION',message:'EMA / RSI / MACD disagree'}],
 blockerCount:1},'nifty',time);
assert.equal(beforeSelection.contract,'OPTION CONTRACT NOT CHECKED');
assert.equal(beforeSelection.diagnosticStage,'FIVE-MINUTE TECHNICAL SIGNAL');
assert.equal(beforeSelection.failedChecks[0].message,'EMA / RSI / MACD disagree');
const closed=safeRecommendationCard({...incomplete,stage:'MARKET_SESSION',
 verifiedContract:null,blockers:[{code:'MARKET_SESSION_CLOSED',
 message:'Exchange session is closed or not verified'}],
 blockerCount:1},'nifty',time);
assert.equal(closed.contract,'OPTION CONTRACT NOT CHECKED');
assert.equal(closed.failedChecks[0].code,'MARKET_SESSION_CLOSED');
assert.equal(safeRecommendationCard({...incomplete,
 blockers:[{code:'INVALID CODE',message:'Bad code'},{code:'VALID_CODE',message:''}]},
 'nifty',time).failedChecks.length,0,'Malformed API diagnostics are not shown');

assert.equal(safeRecommendationCard({...incomplete,verifiedContract:{
 ...incomplete.verifiedContract,orderSubmissionAllowed:true}},'nifty',time).contract,
 'NO VERIFIED OPTION CONTRACT');
assert.equal(safeRecommendationCard({...incomplete,verifiedContract:{
 ...incomplete.verifiedContract,expiry:'2026-10-09'}},'nifty',time).contract,
 'NO VERIFIED OPTION CONTRACT');
assert.equal(safeRecommendationCard(incomplete,'sensex',time).contract,
 'NO VERIFIED OPTION CONTRACT','Never leak a different tab contract');

const other=safeRecommendationCard(paper,'nifty',time);
assert.equal(other.state,'WAIT');
assert.equal(other.entry,'—','Never leak a paper value from a different tab');
assert.equal(safeRecommendationCard(paper,'options',time+6*60000).state,'PAST_PAPER_IDEA');
assert.equal(safeRecommendationCard({...paper,realOrderPlaced:true},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,orderSubmissionAllowed:true},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,executionStatus:'Executed'}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,approvedLots:1}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,orderSubmissionAllowed:true}},
 'options',time).state,'WAIT','Nested order capability flag must suppress paper BUY');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,realOrderPlaced:true}},
 'options',time).state,'WAIT','Nested execution flag must suppress paper BUY');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,entry:0}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,stopLoss:61}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({tab:'sensex',state:'WAIT',paperOnly:true,
 orderSubmissionAllowed:false,realOrderPlaced:false},'sensex').state,'WAIT');
// Directional research has its own read-only presentation; never paper BUY.
const early={kind:'PROVISIONAL_DIRECTION',strategy:'OPENING_RANGE_15M',
 direction:'BULLISH',observedAt:new Date(time).toISOString(),
 source:'UPSTOX_READ_ONLY',recordedDurably:false,optionPlanQualified:false,
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false};
const forecastFeed={tab:'nifty',state:'WAIT',stage:'OPENING_RANGE',
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 lastCheckedAt:new Date(time).toISOString(),provisionalDirection:early};
const hypothesis=safeRecommendationCard(forecastFeed,'nifty',time);
assert.equal(hypothesis.tag,'WAIT');
assert.equal(hypothesis.entry,'—');
assert.equal(hypothesis.target,'—');
assert.equal(hypothesis.stopLoss,'—');
assert.equal(hypothesis.provisionalDirection?.label,'BULLISH');
assert.match(hypothesis.provisionalDirection?.observedAt??'',/IST/);
assert.equal(safeRecommendationCard({...forecastFeed,provisionalDirection:{
 ...early,direction:'BEARISH'}},'nifty',time).provisionalDirection?.label,'BEARISH');
for(const bad of [
 {...early,direction:'CE'}, {...early,entry:100}, {...early,orderSubmissionAllowed:true},
 {...early,observedAt:new Date(time-6*60000).toISOString()}
])assert.equal(safeRecommendationCard({...forecastFeed,provisionalDirection:bad},
 'nifty',time).provisionalDirection,null);
assert.equal(safeRecommendationCard(forecastFeed,'sensex',time).provisionalDirection,null,
 'One tab must not display a different market hypothesis');
assert.equal(safeRecommendationCard({...forecastFeed,
 lastCheckedAt:new Date(time-7*60000).toISOString()},'nifty',time).provisionalDirection,null);
assert.equal(safeRecommendationCard(forecastFeed,'nifty',time+5*60000)
 .provisionalDirection,null,'Old five-minute preview must expire');
assert.equal(safeRecommendationCard({...forecastFeed,realOrderPlaced:true},
 'nifty',time).provisionalDirection,null);
const entry=readFileSync(new URL('./intradayRecommendationsUI.js',import.meta.url),'utf8');
assert.match(entry,/VITE_ANDROID_APP!=='true'/,
 'Only legacy native Android builds should get extra status-bar spacing');
assert.match(entry,/mountAndroidBottomNavigation\(\)/);
assert.match(entry,/web-recommendation-shell/,
 'Web browser must use the same minimalist recommendation interface');
assert.doesNotMatch(entry,/import\('\.\/autoOptionResearchUI\.js'\)/,
 'Do not ship detailed trading research as the public frontend interface');
const workflow=readFileSync(new URL('../.github/workflows/build-personal-android-apk.yml',import.meta.url),'utf8');
assert.match(workflow,/VITE_ANDROID_APP: 'true'/);
assert.match(workflow,/node src\/androidBottomNavigationQualificationRunner\.js/);
const config=JSON.parse(readFileSync(new URL('../capacitor.config.json',import.meta.url),'utf8'));
assert.deepEqual(config.plugins?.SystemBars,
 {insetsHandling:'css',style:'LIGHT',hidden:false},
 'Android 16 light status bar needs proper icons and injected safe-area insets');
const layout=readFileSync(new URL('./androidBottomNavigation.css',import.meta.url),'utf8');
assert.match(layout,/--safe-area-inset-top/);
assert.match(layout,/max\(42px, calc\(18px/,'At least 42px separates the app header from system icons on first paint');
assert.match(layout,/--safe-area-inset-bottom/);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/viewport-fit=cover/,'WebView must expose real viewport safe areas');
const nav=readFileSync(new URL('./androidBottomNavigation.js',import.meta.url),'utf8');
assert.match(nav,/\/api\/paper-recommendations\/latest\?tab=/);
assert.match(nav,/document\.hidden/);
assert.match(nav,/if\(version===sequence&&!document\.hidden\)/,
 'A hidden browser must never render an obsolete broker response');
assert.match(nav,/if\(!document\.hidden\)void refresh\(true\)/,
 'A hidden browser must not recursively launch a stale tab refresh');
assert.match(nav,/Browser received/,
 'Browser polling status must not imply fresh broker analysis');
assert.match(nav,/directional\.hidden=!view\.provisionalDirection/,
 'Only independently qualified provisional direction is shown to the user');
assert.match(nav,/Not a CE\/PE entry/,
 'Directional research must explicitly disclaim an option entry');
assert.match(nav,/backendChecked\.textContent=view\.backendStatus/,
 'Server research freshness must be displayed separately from browser polling');
assert.match(nav,/Paused while browser is hidden/,
 'The user should see an explicit paused refresh status');
assert.match(nav,/document\.addEventListener\('visibilitychange'/);
assert.doesNotMatch(nav,/getUpstoxIntradayCandles|deriveAutoOptionDirection|calculateAutoOptionPaperPlan/,
 'Sensitive engine calculations should be server-side, not in the APK interface');
console.log('ANDROID MINIMAL UI QUALIFICATION PASSED: four tabs, last recommendation, genuine paper prices, fail-closed, backend-only analysis');
