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

assert.match(entry,/VITE_WEB_RECOMMENDATION_UI==='true'/,
 'A browser-specific flag must enable the same minimalist interface');
assert.match(entry,/mountAndroidBottomNavigation\(\)/,
 'Browser site must mount the same four tabs used on Android');
assert.match(entry,/web-recommendation-shell/,
 'Web layout must distinguish browser chrome from Android status-bar insets');
assert.match(pageWorkflow,/VITE_WEB_RECOMMENDATION_UI: 'true'/,
 'Public GitHub Pages must use the recommendation UI');
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
console.log('WEB RECOMMENDATION UI QUALIFICATION PASSED: four tabs, responsive browser layout, 30-sec read-only updates, verified WAIT, zero real orders');
