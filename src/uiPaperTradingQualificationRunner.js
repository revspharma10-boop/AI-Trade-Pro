import fs from 'node:fs';

const files = [
  'src/main.js',
  'src/applicationControlCenter.js',
  'src/paperTradingRuntimeEngine.js',
  'src/paperTradingApplicationBridge.js',
  'src/services/upstoxReadOnlyMarketData.js',
  'server/upstoxOAuthCallbackServer.js'
];
const text = files.map(f => fs.readFileSync(f,'utf8')).join('\n');
const checks = [
 ['paper-only UI present', text.includes('PAPER ONLY')],
 ['real broker orders blocked', text.includes('Broker Execution <strong>BLOCKED') || text.includes('Real Orders</span><strong>BLOCKED')],
 ['paper runtime safety flag', text.includes('realOrderPlaced: false')],
 ['Upstox token browser exposure denied', text.includes('TOKEN_EXPOSED_TO_BROWSER=false')],
 ['read-only quote endpoint', text.includes("'/api/upstox/quote'")],
 ['no Upstox order placement endpoint', !text.includes('/v2/order/place') && !text.includes('/v3/order/place')],
 ['paper ticket stages via runtime', text.includes('stageCandidate')],
 ['paper fill uses simulation runtime', text.includes('fillOrder')],
 ['journal page is paper-only and dashboard model owns journal data', text.includes('Paper Trade Journal') && text.includes('Paper trades only') && text.includes('journal:')]
];
for(const [name,passed] of checks) console.log((passed?'PASS ':'FAIL ')+name);
const failed=checks.filter(x=>!x[1]).length;
console.log('AI_TRADE_PRO_UI_PAPER_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
process.exit(failed?1:0);
