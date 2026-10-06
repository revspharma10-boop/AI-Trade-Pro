import http from 'node:http';
import crypto from 'node:crypto';
import { exchangeUpstoxAuthorizationCode } from '../src/upstox/upstoxOAuth.js';

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID || '';
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || '';
const COOKIE = 'ai_trade_pro_oauth_state';
const PROFILE_URL = 'https://api.upstox.com/v2/user/profile';
const QUOTE_URL = 'https://api.upstox.com/v2/market-quote/quotes';
let productionAccessToken = '';
let tokenReceivedAt = 0;
const TOKEN_SESSION_MAX_MS = 20 * 60 * 60 * 1000;

function activeToken() {
  if (!productionAccessToken || Date.now() - tokenReceivedAt > TOKEN_SESSION_MAX_MS) {
    productionAccessToken = '';
    tokenReceivedAt = 0;
    throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
  }
  return productionAccessToken;
}
function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...(process.env.APP_ORIGIN ? { 'Access-Control-Allow-Origin': process.env.APP_ORIGIN, 'Vary': 'Origin' } : {})
  });
  res.end(JSON.stringify(payload));
}
async function readOnlyQuote(instrumentKey) {
  const key = String(instrumentKey || '').trim();
  if (!key || key.length > 120 || /order/i.test(key)) throw new Error('INVALID_INSTRUMENT_KEY');
  const url = new URL(QUOTE_URL);
  url.searchParams.set('instrument_key', key);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + activeToken() }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    productionAccessToken = ''; tokenReceivedAt = 0;
    throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
  }
  if (response.status === 429) throw new Error('UPSTOX_RATE_LIMITED');
  if (response.status >= 500) throw new Error('UPSTOX_MARKET_DATA_UNAVAILABLE');
  if (!response.ok) throw new Error('UPSTOX_MARKET_DATA_REQUEST_FAILED');
  if (!body || typeof body !== 'object' || !(body.data ?? body)) throw new Error('UPSTOX_MARKET_DATA_EMPTY');
  return body;
}

function safeCookie(value) {
  return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}
function requireConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) throw new Error('UPSTOX_OAUTH_SERVER_CONFIG_INCOMPLETE');
}
function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || '').split(';').map(x => x.trim());
  const found = cookies.find(x => x.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
async function verifyProductionProfile(accessToken) {
  const response = await fetch(PROFILE_URL, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('UPSTOX_PRODUCTION_PROFILE_VERIFICATION_FAILED_' + response.status);
  if (!(body?.data ?? body)) throw new Error('UPSTOX_PRODUCTION_PROFILE_EMPTY');
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'https://oauth.invalid');
    if (url.pathname === '/api/upstox/status') {
      return json(res, 200, {
        provider: 'UPSTOX',
        authenticated: Boolean(productionAccessToken && Date.now() - tokenReceivedAt <= TOKEN_SESSION_MAX_MS),
        marketDataMode: 'READ_ONLY',
        executionMode: 'PAPER_ONLY',
        orderSubmissionAllowed: false,
        realOrderPlaced: false,
        productionRealTradingEnabled: false
      });
    }
    if (url.pathname === '/api/upstox/quote' && req.method === 'GET') {
      try {
        const payload = await readOnlyQuote(url.searchParams.get('instrument_key'));
        return json(res, 200, {
          provider: 'UPSTOX',
          mode: 'READ_ONLY',
          data: payload?.data ?? payload,
          orderSubmissionAllowed: false
        });
      } catch (error) {
        const message = String(error?.message || 'MARKET_DATA_ERROR');
        const status = message === 'UPSTOX_REAUTHENTICATION_REQUIRED' ? 401 : message === 'UPSTOX_RATE_LIMITED' ? 429 : 502;
        const safeError = ['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_RATE_LIMITED','UPSTOX_MARKET_DATA_UNAVAILABLE','UPSTOX_MARKET_DATA_REQUEST_FAILED','UPSTOX_MARKET_DATA_EMPTY','INVALID_INSTRUMENT_KEY'].includes(message) ? message : 'UPSTOX_MARKET_DATA_UNAVAILABLE';
        return json(res, status, { error: safeError, orderSubmissionAllowed: false });
      }
    }
    if (url.pathname === '/health') {
      return send(res, 200, 'AI_TRADE_PRO_OAUTH_CALLBACK_HEALTHY\nPAPER_ONLY=true\nPRODUCTION_REAL_TRADING_ENABLED=false');
    }
    if (url.pathname === '/auth/upstox/start') {
      requireConfig();
      const state = crypto.randomBytes(32).toString('hex');
      const auth = new URL('https://api.upstox.com/v2/login/authorization/dialog');
      auth.searchParams.set('response_type', 'code');
      auth.searchParams.set('client_id', CLIENT_ID);
      auth.searchParams.set('redirect_uri', REDIRECT_URI);
      auth.searchParams.set('state', state);
      res.writeHead(302, { Location: auth.toString(), 'Set-Cookie': safeCookie(state) });
      return res.end();
    }
    if (url.pathname === '/auth/upstox/callback') {
      requireConfig();
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const expected = cookieValue(req, COOKIE);
      if (!code || !state || !expected || state !== expected) return send(res, 400, 'UPSTOX_OAUTH_STATE_VALIDATION_FAILED');

      const token = await exchangeUpstoxAuthorizationCode({
        code, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI
      });
      if (!token?.access_token) return send(res, 502, 'UPSTOX_OAUTH_TOKEN_EXCHANGE_FAILED');

      // The token remains server-side in volatile memory and is never returned to the browser.
      await verifyProductionProfile(token.access_token);
      productionAccessToken = token.access_token;
      tokenReceivedAt = Date.now();

      return send(res, 200,
        'UPSTOX_OAUTH_AUTHENTICATION_PASSED\n' +
        'UPSTOX_PRODUCTION_PROFILE_READ_PASSED\n' +
        'UPSTOX_PRODUCTION_CONNECTIVITY_PASSED\n' +
        'TOKEN_RECEIVED_SERVER_SIDE=true\n' +
        'TOKEN_PERSISTED=false\n' +
        'TOKEN_EXPOSED_TO_BROWSER=false\n' +
        'order_submission_allowed=false\n' +
        'PAPER_ONLY=true\n' +
        'REAL_ORDER_PLACED=false\n' +
        'PRODUCTION_REAL_TRADING_ENABLED=false',
        { 'Set-Cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` }
      );
    }
    return send(res, 404, 'NOT_FOUND');
  } catch (error) {
    return send(res, 500, 'OAUTH_CALLBACK_ERROR=' + String(error?.message || 'UNKNOWN'));
  }
});

server.listen(PORT, () => {
  console.log(`AI Trade Pro OAuth callback listening on port ${PORT}`);
  console.log('PAPER_ONLY=true');
  console.log('REAL_ORDER_PLACED=false');
  console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
});
