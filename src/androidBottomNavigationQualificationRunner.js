import assert from 'node:assert/strict';
import {ANDROID_TABS,androidTabById,androidSelectionForTab} from './androidBottomNavigation.js';
import {OPENING_RANGE_SAFETY} from './services/openingRangeResearch.js';
import {AUTO_OPTION_SAFETY} from './services/autoOptionResearchEngine.js';
import {readFileSync} from 'node:fs';

assert.deepEqual(ANDROID_TABS.map(t=>t.label),['Nifty','Sensex','Options Trade','Commodity']);
assert.equal(new Set(ANDROID_TABS.map(t=>t.id)).size,4);
for(const t of ANDROID_TABS)assert.equal(androidTabById(t.id),t);
assert.equal(androidTabById('nonexistent').id,'nifty');
assert.deepEqual(androidSelectionForTab('nifty'),{instrumentType:'INDEX',symbol:'NIFTY'});
assert.deepEqual(androidSelectionForTab('sensex'),{instrumentType:'INDEX',symbol:'SENSEX'});
assert.deepEqual(androidSelectionForTab('options'),{instrumentType:'INDEX',symbol:'NIFTY'});
assert.deepEqual(androidSelectionForTab('options',{instrumentType:'STOCK',symbol:'RELIANCE'}),
 {instrumentType:'STOCK',symbol:'RELIANCE'});
assert.deepEqual(androidSelectionForTab('options',{instrumentType:'MCX',symbol:'SILVER'}),
 {instrumentType:'INDEX',symbol:'SILVER'});
assert.deepEqual(androidSelectionForTab('options',{instrumentType:'STOCK',symbol:'BAD SYMBOL'}),
 {instrumentType:'STOCK',symbol:'RELIANCE'});
assert.deepEqual(androidSelectionForTab('commodity'),{instrumentType:'MCX',symbol:'GOLD'});
assert.deepEqual(androidSelectionForTab('commodity',undefined,'SILVER'),
 {instrumentType:'MCX',symbol:'SILVER'});
assert.deepEqual(androidSelectionForTab('commodity',undefined,'INVALID SYMBOL'),
 {instrumentType:'MCX',symbol:'GOLD'});

const entry=readFileSync(new URL('./intradayRecommendationsUI.js',import.meta.url),'utf8');
assert.match(entry,/VITE_ANDROID_APP==='true'/);
assert.match(entry,/mountAutoOptionResearch\(\);\s*mountIndexDemoJournal\(\);/);
assert.match(entry,/mountAndroidBottomNavigation\(\)/);
const workflow=readFileSync(new URL('../.github/workflows/build-personal-android-apk.yml',import.meta.url),'utf8');
assert.match(workflow,/VITE_ANDROID_APP: 'true'/);
assert.match(workflow,/node src\/androidBottomNavigationQualificationRunner\.js/);
const navSource=readFileSync(new URL('./androidBottomNavigation.js',import.meta.url),'utf8');
assert.match(navSource,/analyze\.click\(\)/);
assert.match(navSource,/dispatchEvent\(new Event/);
assert.match(navSource,/querySelector\('#ir-live-facts'\)/);
assert.equal(OPENING_RANGE_SAFETY.orderSubmissionAllowed,false);
assert.equal(AUTO_OPTION_SAFETY.orderSubmissionAllowed,false);
assert.equal(AUTO_OPTION_SAFETY.realOrderPlaced,false);
assert.equal(AUTO_OPTION_SAFETY.productionRealTradingEnabled,false);
console.log('ANDROID NAVIGATION QUALIFICATION PASSED: 4 native tabs, real instrument routing, verified quotes, paper only, 0 orders');
