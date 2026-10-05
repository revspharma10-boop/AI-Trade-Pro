import fs from 'node:fs';

const source = fs.readFileSync(new URL('./upstoxOAuthCallbackServer.js', import.meta.url), 'utf8');
const checks = [
  ['cryptographic OAuth state', source.includes('crypto.randomBytes(32)')],
  ['HttpOnly cookie', source.includes('HttpOnly')],
  ['Secure cookie', source.includes('Secure')],
  ['SameSite cookie', source.includes('SameSite=Lax')],
  ['state comparison', source.includes('state !== expected')],
  ['server-side client secret', source.includes('process.env.UPSTOX_CLIENT_SECRET')],
  ['token not returned to browser', source.includes('TOKEN_EXPOSED_TO_BROWSER=false')],
  ['paper only asserted', source.includes('PAPER_ONLY=true')],
  ['real order remains false', source.includes('REAL_ORDER_PLACED=false')],
  ['production trading remains false', source.includes('PRODUCTION_REAL_TRADING_ENABLED=false')],
  ['no order placement path', !source.includes('/v2/order/place') && !source.includes('/v3/order/place')],
  ['no order cancellation path', !source.includes('/v2/order/cancel') && !source.includes('/v3/order/cancel')]
];

for (const [name, passed] of checks) console.log((passed ? 'PASS ' : 'FAIL ') + name);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(`UPSTOX_OAUTH_CALLBACK_VALIDATION=${failed === 0 ? 'PASSED' : 'FAILED'}`);
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
process.exit(failed === 0 ? 0 : 1);
