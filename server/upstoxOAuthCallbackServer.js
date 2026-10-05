import http from 'node:http';
import crypto from 'node:crypto';
import { exchangeUpstoxAuthorizationCode } from '../src/upstox/upstoxOAuth.js';

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID || '';
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || '';
const COOKIE = 'ai_trade_pro_oauth_state';

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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'https://oauth.invalid');

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

      // Deliberately never return/log the access token. Persistent secret storage
      // must be added through an approved server-side secret manager.
      if (!token?.access_token) return send(res, 502, 'UPSTOX_OAUTH_TOKEN_EXCHANGE_FAILED');
      return send(res, 200,
        'UPSTOX_OAUTH_AUTHENTICATION_PASSED\n' +
        'TOKEN_RECEIVED_SERVER_SIDE=true\n' +
        'TOKEN_EXPOSED_TO_BROWSER=false\n' +
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
