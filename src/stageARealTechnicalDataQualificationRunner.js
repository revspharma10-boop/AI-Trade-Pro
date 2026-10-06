import fs from 'node:fs';
const server=fs.readFileSync('server/upstoxOAuthCallbackServer.js','utf8');
const adapter=fs.readFileSync('src/services/upstoxReadOnlyMarketData.js','utf8');
const ui=fs.readFileSync('src/main.js','utf8');
const checks=[
 ['Upstox V3 historical route server-side',server.includes('/v3/historical-candle')&&server.includes('/days/1/')],
 ['history endpoint GET only',server.includes("url.pathname === '/api/upstox/history' && req.method === 'GET'")],
 ['browser token remains unavailable',!adapter.includes('UPSTOX_PRODUCTION_ACCESS_TOKEN')&&!adapter.includes('Authorization: \'Bearer')],
 ['browser history adapter present',adapter.includes('getUpstoxDailyHistory')],
 ['technical engine wired to history',ui.includes('analyzeTechnicalHistory(history.candles)')],
 ['stock analysis uses read-only history',ui.includes('getUpstoxDailyHistory')],
 ['fundamental absence keeps final trade WAIT',ui.includes('WAIT — FUNDAMENTALS PENDING')],
 ['no order placement route introduced',!server.includes('/v2/order/place')&&!server.includes('/v3/order/place')]
];
for(const [n,p] of checks)console.log((p?'PASS ':'FAIL ')+n);
const failed=checks.filter(x=>!x[1]).length;
console.log('STAGE_A_REAL_TECHNICAL_DATA_QUALIFICATION='+(failed?'FAILED':'PASSED'));
console.log('PAPER_ONLY=true');console.log('REAL_ORDER_PLACED=false');console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
process.exit(failed?1:0);
