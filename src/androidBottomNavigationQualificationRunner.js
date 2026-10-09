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
const historical=safeRecommendationCard({...paper,state:'PAST_PAPER_IDEA'},'options',time);
assert.equal(historical.state,'PAST_PAPER_IDEA');
assert.equal(historical.tag,'PAST PAPER IDEA');
assert.notEqual(historical.tag,'PAPER BUY');
const other=safeRecommendationCard(paper,'nifty',time);
assert.equal(other.state,'WAIT');
assert.equal(other.entry,'—','Never leak a paper value from a different tab');
assert.equal(safeRecommendationCard(paper,'options',time+6*60000).state,'PAST_PAPER_IDEA');
assert.equal(safeRecommendationCard({...paper,realOrderPlaced:true},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,orderSubmissionAllowed:true},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,executionStatus:'Executed'}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,approvedLots:1}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,entry:0}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({...paper,last:{...paper.last,stopLoss:61}},'options',time).state,'WAIT');
assert.equal(safeRecommendationCard({tab:'sensex',state:'WAIT',paperOnly:true,
 orderSubmissionAllowed:false,realOrderPlaced:false},'sensex').state,'WAIT');
const entry=readFileSync(new URL('./intradayRecommendationsUI.js',import.meta.url),'utf8');
assert.match(entry,/VITE_ANDROID_APP==='true'/);
assert.match(entry,/mountAndroidBottomNavigation\(\)/);
assert.match(entry,/import\('\.\/autoOptionResearchUI\.js'\)/,
 'Web research loaded only by the existing web interface');
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
assert.match(nav,/document\.addEventListener\('visibilitychange'/);
assert.doesNotMatch(nav,/getUpstoxIntradayCandles|deriveAutoOptionDirection|calculateAutoOptionPaperPlan/,
 'Sensitive engine calculations should be server-side, not in the APK interface');
console.log('ANDROID MINIMAL UI QUALIFICATION PASSED: four tabs, last recommendation, genuine paper prices, fail-closed, backend-only analysis');
