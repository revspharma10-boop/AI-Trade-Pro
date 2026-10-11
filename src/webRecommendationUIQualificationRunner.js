import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ANDROID_TABS,safeRecommendationCard} from './androidBottomNavigation.js';
import {READ_ONLY_CLIENT_ORIGINS,readOnlyCorsHeaders} from '../server/readOnlyCorsPolicy.js';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const entry=read('./intradayRecommendationsUI.js');
const pageWorkflow=read('../.github/workflows/deploy-pages.yml');
const androidWorkflow=read('../.github/workflows/build-personal-android-apk.yml');
const ui=read('./androidBottomNavigation.js');
const css=read('./androidBottomNavigation.css');
const html=read('../index.html');

assert.match(entry,/VITE_ANDROID_APP!=='true'/,
 'Default page must use browser safe areas, not Android APK system insets');
assert.doesNotMatch(entry,/autoOptionResearchUI\.js/,
 'Detailed technical dashboard must not be imported into the production browser bundle');
assert.match(entry,/mountAndroidBottomNavigation\(\)/,
 'Browser site must mount the same four tabs used on Android');
assert.match(entry,/web-recommendation-shell/,
 'Web layout must distinguish browser chrome from Android status-bar insets');
assert.doesNotMatch(pageWorkflow,/VITE_ANDROID_APP: 'true'/,
 'Browser pages must not be built with native Android status-bar handling');
assert.match(pageWorkflow,/node src\/webRecommendationUIQualificationRunner\.js/,
 'GitHub Pages deploy must gate on web qualification tests');
assert.match(pageWorkflow,/node server\/paperRecommendationFeedQualificationRunner\.js/,
 'GitHub Pages deploy must gate on backend recommendation tests');
assert.match(androidWorkflow,/on:\s*\n\s*workflow_dispatch:/,
 'Android packaging must be manual only');
assert.doesNotMatch(androidWorkflow,/\n  pull_request:|\n  push:/,
 'Do not launch Android APK builds during ordinary web changes');
assert.deepEqual(ANDROID_TABS.map(x=>x.label),
 ['Nifty','Sensex','Options Trade','Commodity']);
assert.match(ui,/\/api\/paper-recommendations\/latest\?tab=/,
 'Only server-qualified paper recommendations belong in the browser UI');
assert.match(ui,/document\.hidden/,'Refresh only while browser page is visible');
assert.match(ui,/setInterval\(\(\)=>\{void refresh\(\);\},30000\)/,
 'Refresh interval should remain 30 seconds while visible');
assert.match(css,/web-recommendation-shell/,'Browser responsive style must be present');
assert.match(css,/@media\(min-width:720px\)/,'Desktop nav must be width constrained');
assert.match(html,/viewport-fit=cover/,'Browser viewport must support mobile safe areas');
assert.ok(READ_ONLY_CLIENT_ORIGINS.includes('https://revspharma10-boop.github.io'),
 'Allow exact GitHub Pages origin; do not introduce a wildcard');
assert.equal(readOnlyCorsHeaders('https://evil.example')['Access-Control-Allow-Origin'],undefined);
const now=Date.parse('2026-10-09T12:30:18+05:30');
const sample={
 tab:'nifty',state:'WAIT',paperOnly:true,realOrderPlaced:false,orderSubmissionAllowed:false,
 stage:'OPTION_PREMIUM_AND_RISK',
 verifiedContract:{tradingSymbol:'NIFTY 15 OCT 25000 CE',optionType:'CE',
  expiry:'2026-10-15',strike:25000,paperOnly:true,orderSubmissionAllowed:false},
 blockers:[{code:'BROKER_MARGIN_QUOTE_REQUIRED',
  message:'Upstox option margin estimate is unavailable or unverified'}],blockerCount:1
};
const view=safeRecommendationCard(sample,'nifty',now);
assert.equal(view.tag,'WAIT');
assert.equal(view.contract,'NIFTY 15 OCT 25000 CE');
assert.equal(view.entry,'—');
assert.equal(view.stopLoss,'—');
assert.equal(view.target,'—');
assert.equal(view.diagnosticStage,'OPTION PREMIUM AND RISK');
assert.equal(view.failedChecks.length,1);
assert.notEqual(view.status,'Executed');
assert.equal(safeRecommendationCard({...sample,orderSubmissionAllowed:true},'nifty',now).tag,'WAIT');
// A malformed/future-dated record must never show prices as a current
// paper BUY, even if the broker payload claims PAPER_SETUP.
const qualified={
 tab:'nifty',state:'PAPER_SETUP',paperOnly:true,
 realOrderPlaced:false,orderSubmissionAllowed:false,
 last:{optionType:'CE',contract:'NIFTY SYNTHETIC 25000 CE',
  entry:100,stopLoss:90,target:120,date:'2026-10-09',
  capturedAt:new Date(now).toISOString(),
  executionStatus:'NOT EXECUTED',approvedLots:0,paperOnly:true}
};
assert.equal(safeRecommendationCard(qualified,'nifty',now).tag,'PAPER BUY');
for(const capturedAt of ['not-a-timestamp',
 new Date(now+60000).toISOString(),null]){
 const bad=safeRecommendationCard({...qualified,last:{
  ...qualified.last,capturedAt
 }},'nifty',now);
 assert.equal(bad.tag,'WAIT','Malformed or future timestamp cannot claim active BUY');
 assert.equal(bad.entry,'—','Unverified time must hide the displayed entry');
 assert.equal(bad.target,'—');
 assert.equal(bad.stopLoss,'—');
 assert.equal(bad.contract,'NO VERIFIED OPTION CONTRACT');
}
const past=safeRecommendationCard({...qualified,last:{
 ...qualified.last,capturedAt:new Date(now-300000).toISOString()
}},'nifty',now);
assert.equal(past.tag,'PAST PAPER IDEA');
assert.equal(past.status,'Previous idea · Not executed');
assert.equal(safeRecommendationCard({...qualified,realOrderPlaced:true},
 'nifty',now).tag,'WAIT');
assert.match(ui,/android-simple-manual-refresh/,
 'Web research must offer a clearly labeled manual refresh');
assert.match(ui,/manualRefresh\.addEventListener\('click',\(\)=>\{void refresh\(true\);\}\)/,
 'Manual refresh must request read-only research, never submit a broker order');
assert.match(ui,/manualRefresh\.disabled=true/,
 'Disable repeated clicks while broker request is in flight');
assert.match(ui,/manualRefresh\.disabled=false/,
 'Re-enable manual refresh after request completion or timeout');
assert.match(css,/android-simple-manual-refresh:focus-visible/,
 'Keyboard users must see manual refresh focus');
assert.match(ui,/AbortSignal\.timeout\(12000\)/,
 'A stalled Render request must time out instead of freezing tab updates');
assert.match(ui,/pendingTabRefresh/,
 'Tab changes during an in-flight request must trigger a fresh fetch');
assert.match(ui,/timeZone:'Asia\/Kolkata'/,
 'Refresh timestamp must show IST, not ambiguous browser-local time');
console.log('WEB RECOMMENDATION UI QUALIFICATION PASSED: four tabs, responsive browser layout, 30-sec read-only updates, verified WAIT, zero real orders');
