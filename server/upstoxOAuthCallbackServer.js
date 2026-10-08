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
const HISTORICAL_V3_URL = 'https://api.upstox.com/v3/historical-candle';
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
    ...( { 'Access-Control-Allow-Origin': 'https://revspharma10-boop.github.io', 'Vary': 'Origin' } )
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

function isoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}
async function readOnlyHistoricalDaily(instrumentKey, fromDate, toDate) {
  const key = String(instrumentKey || '').trim();
  const from = isoDate(fromDate), to = isoDate(toDate);
  if (!key || key.length > 120 || /order/i.test(key)) throw new Error('INVALID_INSTRUMENT_KEY');
  if (!from || !to || from > to) throw new Error('INVALID_DATE_RANGE');
  const endpoint = HISTORICAL_V3_URL + '/' + encodeURIComponent(key) + '/days/1/' + to + '/' + from;
  const response = await fetch(endpoint, { method:'GET', headers:{ Accept:'application/json', Authorization:'Bearer '+activeToken() } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) { productionAccessToken=''; tokenReceivedAt=0; throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED'); }
  if (response.status === 429) throw new Error('UPSTOX_RATE_LIMITED');
  if (response.status >= 500) throw new Error('UPSTOX_MARKET_DATA_UNAVAILABLE');
  if (!response.ok) throw new Error('UPSTOX_HISTORICAL_DATA_REQUEST_FAILED');
  const raw = body?.data?.candles;
  if (!Array.isArray(raw) || !raw.length) throw new Error('UPSTOX_HISTORICAL_DATA_EMPTY');
  const candles = raw.map(x => ({ datetime:String(x?.[0]||''), open:Number(x?.[1]), high:Number(x?.[2]), low:Number(x?.[3]), close:Number(x?.[4]), volume:Number(x?.[5]) }))
    .filter(x => x.datetime && [x.open,x.high,x.low,x.close].every(Number.isFinite))
    .sort((a,b)=>a.datetime.localeCompare(b.datetime));
  if (!candles.length) throw new Error('UPSTOX_HISTORICAL_DATA_EMPTY');
  return candles;
}

async function readOnlyIntradayCandles(instrumentKey, interval){
 const key=String(instrumentKey||'').trim();
 const allowed={ '1m':'1','5m':'5','15m':'15' };
 if(!key||key.length>120||/order/i.test(key))throw new Error('INVALID_INSTRUMENT_KEY');
 if(!Object.hasOwn(allowed,interval))throw new Error('INVALID_INTRADAY_INTERVAL');
 const url='https://api.upstox.com/v3/historical-candle/intraday/'+encodeURIComponent(key)+'/minutes/'+allowed[interval];
 const response=await fetch(url,{headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
 const body=await response.json().catch(()=>({}));
 if(response.status===401||response.status===403){productionAccessToken='';tokenReceivedAt=0;throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');}
 if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
 if(!response.ok)throw new Error('UPSTOX_INTRADAY_REQUEST_FAILED');
 const raw=body?.data?.candles;
 if(!Array.isArray(raw)||!raw.length)throw new Error('UPSTOX_INTRADAY_DATA_EMPTY');
 const candles=raw.map(x=>({datetime:String(x?.[0]||''),open:Number(x?.[1]),high:Number(x?.[2]),low:Number(x?.[3]),close:Number(x?.[4]),volume:Number(x?.[5])})).filter(x=>Number.isFinite(Date.parse(x.datetime))&&[x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)&&x.volume>=0&&x.low>0&&x.high>=x.low).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
 if(!candles.length)throw new Error('UPSTOX_INTRADAY_DATA_EMPTY');
 return candles;
}

function validIsin(value){return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(value||'').toUpperCase());}
async function readOnlyFundamentals(isin){
  const id=String(isin||'').trim().toUpperCase();
  if(!validIsin(id))throw new Error('INVALID_ISIN');
  const endpoints={profile:'profile',income:'income-statement?type=consolidated&time_period=yearly',balance:'balance-sheet?type=consolidated',cashFlow:'cash-flow?type=consolidated',keyRatios:'key-ratios'};
  const entries=await Promise.all(Object.entries(endpoints).map(async([name,path])=>{
    const response=await fetch('https://api.upstox.com/v2/fundamentals/'+encodeURIComponent(id)+'/'+path,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403){productionAccessToken='';tokenReceivedAt=0;throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');}
    if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
    if(!response.ok)throw new Error('UPSTOX_FUNDAMENTALS_REQUEST_FAILED');
    return [name,body?.data??body];
  }));
  return Object.fromEntries(entries);
}

async function searchEquityInstrument(query){
  const q=String(query||'').trim();
  if(!q||q.length>80)throw new Error('INVALID_INSTRUMENT_QUERY');
  const url=new URL('https://api.upstox.com/v2/instruments/search');
  url.searchParams.set('query',q); url.searchParams.set('exchanges','NSE'); url.searchParams.set('segments','EQ');
  const response=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
  const body=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403){productionAccessToken='';tokenReceivedAt=0;throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');}
  if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
  if(!response.ok)throw new Error('UPSTOX_INSTRUMENT_SEARCH_FAILED');
  const items=Array.isArray(body?.data)?body.data:[];
  const exact=items.find(x=>String(x.trading_symbol||'').toUpperCase()===q.toUpperCase()&&x.segment==='NSE_EQ')||items.find(x=>x.segment==='NSE_EQ');
  if(!exact?.instrument_key||!exact?.isin)throw new Error('UPSTOX_EQUITY_NOT_FOUND');
  return {name:exact.name,shortName:exact.short_name,tradingSymbol:exact.trading_symbol,isin:exact.isin,instrumentKey:exact.instrument_key,exchange:exact.exchange,segment:exact.segment};
}

async function searchIntradayDerivativeContracts(query,type){
  const q=String(query||'').trim(),kind=String(type||'').toUpperCase();
  if(!q||q.length>50||!['FUT','CE','PE'].includes(kind))throw new Error('INVALID_DERIVATIVE_SEARCH');
  const url=new URL('https://api.upstox.com/v2/instruments/search');
  url.searchParams.set('query',q);
  url.searchParams.set('exchanges','NSE');
  url.searchParams.set('segments','FO');
  url.searchParams.set('instrument_types',kind);
  url.searchParams.set('expiry','current_month');
  url.searchParams.set('records','20');
  const response=await fetch(url,{headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
  const body=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403){productionAccessToken='';tokenReceivedAt=0;throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');}
  if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
  if(!response.ok)throw new Error('UPSTOX_DERIVATIVE_SEARCH_FAILED');
  const raw=Array.isArray(body?.data)?body.data:[];
  return raw.filter(x=>x.segment==='NSE_FO'&&x.instrument_type===kind&&x.instrument_key&&x.trading_symbol)
    .map(x=>({instrumentKey:String(x.instrument_key),segment:'NSE_FO',instrumentType:kind,
      tradingSymbol:String(x.trading_symbol),expiry:String(x.expiry||''),
      lotSize:Number(x.lot_size),strike:Number(x.strike_price||0)}));
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
    if (url.pathname === '/api/upstox/history' && req.method === 'GET') {
      try {
        const candles = await readOnlyHistoricalDaily(url.searchParams.get('instrument_key'), url.searchParams.get('from_date'), url.searchParams.get('to_date'));
        return json(res, 200, { provider:'UPSTOX', mode:'READ_ONLY', interval:'1day', candles, orderSubmissionAllowed:false });
      } catch (error) {
        const message=String(error?.message||'MARKET_DATA_ERROR');
        const status=message==='UPSTOX_REAUTHENTICATION_REQUIRED'?401:message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_DATE_RANGE'||message==='INVALID_INSTRUMENT_KEY'?400:502;
        const allowed=['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_RATE_LIMITED','UPSTOX_MARKET_DATA_UNAVAILABLE','UPSTOX_HISTORICAL_DATA_REQUEST_FAILED','UPSTOX_HISTORICAL_DATA_EMPTY','INVALID_INSTRUMENT_KEY','INVALID_DATE_RANGE'];
        return json(res,status,{error:allowed.includes(message)?message:'UPSTOX_MARKET_DATA_UNAVAILABLE',orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/intraday' && req.method === 'GET') {
      try { const interval=url.searchParams.get('interval');const instrumentKey=url.searchParams.get('instrument_key');const candles=await readOnlyIntradayCandles(instrumentKey,interval);return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',interval,candles,orderSubmissionAllowed:false}); }
      catch(error){const message=String(error?.message||'UPSTOX_INTRADAY_UNAVAILABLE');return json(res,message==='UPSTOX_REAUTHENTICATION_REQUIRED'?401:message==='UPSTOX_RATE_LIMITED'?429:message.startsWith('INVALID_')?400:502,{error:message,orderSubmissionAllowed:false});}
    }
    if (url.pathname === '/api/upstox/fundamentals' && req.method === 'GET') {
      try {
        const data=await readOnlyFundamentals(url.searchParams.get('isin'));
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',data,orderSubmissionAllowed:false});
      } catch(error) {
        const message=String(error?.message||'FUNDAMENTALS_ERROR');
        const status=message==='UPSTOX_REAUTHENTICATION_REQUIRED'?401:message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_ISIN'?400:502;
        return json(res,status,{error:['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_RATE_LIMITED','UPSTOX_FUNDAMENTALS_REQUEST_FAILED','INVALID_ISIN'].includes(message)?message:'UPSTOX_FUNDAMENTALS_UNAVAILABLE',orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/instrument-search' && req.method === 'GET') {
      try { const data=await searchEquityInstrument(url.searchParams.get('query')); return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',data,orderSubmissionAllowed:false}); }
      catch(error){ const message=String(error?.message||'INSTRUMENT_SEARCH_ERROR'); const status=message==='UPSTOX_REAUTHENTICATION_REQUIRED'?401:message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_INSTRUMENT_QUERY'||message==='UPSTOX_EQUITY_NOT_FOUND'?400:502; return json(res,status,{error:message,orderSubmissionAllowed:false}); }
    }
    if (url.pathname === '/api/upstox/derivative-search' && req.method === 'GET') {
      try{
        const contracts=await searchIntradayDerivativeContracts(url.searchParams.get('query'),url.searchParams.get('type'));
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',contracts,orderSubmissionAllowed:false});
      }catch(error){
        const message=String(error?.message||'UPSTOX_DERIVATIVE_SEARCH_FAILED');
        return json(res,message==='UPSTOX_REAUTHENTICATION_REQUIRED'?401:message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_DERIVATIVE_SEARCH'?400:502,
          {error:message,orderSubmissionAllowed:false});
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
