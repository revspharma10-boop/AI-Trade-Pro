/* AI TRADE PRO — UPSTOX PRODUCTION CONNECTIVITY VALIDATION
 * AUTHENTICATED READ-ONLY verification only.
 * This runner MUST NOT call any order placement, modification, cancellation or trade endpoint.
 */
const rawToken = process.env.UPSTOX_PRODUCTION_ACCESS_TOKEN || '';
const token = rawToken.trim();
const baseUrl = 'https://api.upstox.com';

const forbidden = [
  '/v2/order', '/v3/order', '/v2/charges', '/v2/portfolio/short-term-positions'
];

function assertReadOnlyPath(path) {
  if (forbidden.some(prefix => path.startsWith(prefix))) {
    throw new Error('PRODUCTION_ORDER_ENDPOINT_BLOCKED');
  }
  if (path !== '/v2/user/profile') {
    throw new Error('PRODUCTION_CONNECTIVITY_PATH_NOT_ALLOWLISTED');
  }
}

if (process.env.PAPER_ONLY !== 'true') {
  console.error('SAFETY_BLOCK_PAPER_ONLY_REQUIRED');
  process.exit(2);
}
if (process.env.PRODUCTION_REAL_TRADING_ENABLED === 'true') {
  console.error('SAFETY_BLOCK_LIVE_EXECUTION_ENABLED');
  process.exit(3);
}
if (process.env.REAL_ORDER_PLACED === 'true') {
  console.error('SAFETY_BLOCK_REAL_ORDER_STATE');
  process.exit(4);
}
if (!token) {
  console.error('UPSTOX_PRODUCTION_ACCESS_TOKEN_REQUIRED');
  process.exit(5);
}

async function readOnlyRequest(path) {
  assertReadOnlyPath(path);
  const response = await fetch(baseUrl + path, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

console.log('UPSTOX_PRODUCTION_CONNECTIVITY_START');
console.log('verification_mode=AUTHENTICATED_READ_ONLY');
console.log('order_submission_allowed=false');
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');

const result = await readOnlyRequest('/v2/user/profile');
if (!result.ok) {
  console.error('UPSTOX_PRODUCTION_PROFILE_FAILED status=' + result.status);
  console.error('UPSTOX_PRODUCTION_PROFILE_MESSAGE=' + (result.payload?.errors?.[0]?.message ?? result.payload?.message ?? 'UNKNOWN_API_RESPONSE'));
  process.exit(1);
}

const profile = result.payload?.data ?? result.payload;
if (!profile) {
  console.error('UPSTOX_PRODUCTION_PROFILE_EMPTY');
  process.exit(1);
}

console.log('UPSTOX_PRODUCTION_AUTHENTICATION_PASSED');
console.log('UPSTOX_PRODUCTION_PROFILE_READ_PASSED');
console.log('UPSTOX_PRODUCTION_CONNECTIVITY_PASSED');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
