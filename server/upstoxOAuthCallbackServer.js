import http from 'node:http';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { exchangeUpstoxAuthorizationCode } from '../src/upstox/upstoxOAuth.js';

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID || '';
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || '';
const COOKIE = 'ai_trade_pro_oauth_state';
const PROFILE_URL = 'https://api.upstox.com/v2/user/profile';
const QUOTE_URL = 'https://api.upstox.com/v2/market-quote/quotes';
const HISTORICAL_V3_URL = 'https://api.upstox.com/v3/historical-candle';
// The Analytics Token is a provider-issued, read-only credential, valid for up
// to one year. Configure it in Render's secret environment settings, never Git.
// Unlike the daily OAuth token, the env-backed token survives restarts/deploys.
const ANALYTICS_TOKEN = String(process.env.UPSTOX_ANALYTICS_TOKEN || '').trim();
let analyticsRejected = false;
let analyticsVerified = false;
let productionAccessToken = '';
let tokenReceivedAt = 0;
let oauthExpiresAt = 0;
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
function nextUpstoxOAuthExpiry(receivedAt) {
  // Upstox ends standard OAuth validity at the next 03:30 IST.
  const istNow = receivedAt + IST_OFFSET_MS;
  const dayStart = Math.floor(istNow / DAY_MS) * DAY_MS;
  let expiry = dayStart + (3 * 60 + 30) * 60 * 1000 - IST_OFFSET_MS;
  if (expiry <= receivedAt) expiry += DAY_MS;
  return expiry;
}
function activeToken() {
  if (ANALYTICS_TOKEN) {
    if (analyticsRejected) throw new Error('UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED');
    return ANALYTICS_TOKEN;
  }
  if (!productionAccessToken || !oauthExpiresAt || Date.now() >= oauthExpiresAt) {
    productionAccessToken = '';
    tokenReceivedAt = 0;
    oauthExpiresAt = 0;
    throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
  }
  return productionAccessToken;
}
function onUpstoxUnauthorized(status) {
  // 403 on an Analytics Token can mean that a particular endpoint is not
  // supported; it must not silently revoke access to every other GET API.
  if (ANALYTICS_TOKEN) {
    if (status === 403) throw new Error('UPSTOX_ANALYTICS_PERMISSION_DENIED');
    analyticsRejected = true;
    analyticsVerified = false;
    throw new Error('UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED');
  }
  productionAccessToken = '';
  tokenReceivedAt = 0;
  oauthExpiresAt = 0;
  throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
}
function markUpstoxReadVerified() {
  if (ANALYTICS_TOKEN && !analyticsRejected) analyticsVerified = true;
}
function authErrorHttpStatus(message) {
  if (message === 'UPSTOX_REAUTHENTICATION_REQUIRED' ||
      message === 'UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED') return 401;
  if (message === 'UPSTOX_ANALYTICS_PERMISSION_DENIED') return 403;
  return null;
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
  if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
  if (response.status === 429) throw new Error('UPSTOX_RATE_LIMITED');
  if (response.status >= 500) throw new Error('UPSTOX_MARKET_DATA_UNAVAILABLE');
  if (!response.ok) throw new Error('UPSTOX_MARKET_DATA_REQUEST_FAILED');
  markUpstoxReadVerified();
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
  if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
  if (response.status === 429) throw new Error('UPSTOX_RATE_LIMITED');
  if (response.status >= 500) throw new Error('UPSTOX_MARKET_DATA_UNAVAILABLE');
  if (!response.ok) throw new Error('UPSTOX_HISTORICAL_DATA_REQUEST_FAILED');
  markUpstoxReadVerified();
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
 if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
 if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
 if(!response.ok)throw new Error('UPSTOX_INTRADAY_REQUEST_FAILED');
  markUpstoxReadVerified();
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
    if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
    if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
    if(!response.ok)throw new Error('UPSTOX_FUNDAMENTALS_REQUEST_FAILED');
  markUpstoxReadVerified();
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
  if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
  if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
  if(!response.ok)throw new Error('UPSTOX_INSTRUMENT_SEARCH_FAILED');
  markUpstoxReadVerified();
  const items=Array.isArray(body?.data)?body.data:[];
  const exact=items.find(x=>String(x.trading_symbol||'').toUpperCase()===q.toUpperCase()&&x.segment==='NSE_EQ')||items.find(x=>x.segment==='NSE_EQ');
  if(!exact?.instrument_key||!exact?.isin)throw new Error('UPSTOX_EQUITY_NOT_FOUND');
  return {name:exact.name,shortName:exact.short_name,tradingSymbol:exact.trading_symbol,isin:exact.isin,instrumentKey:exact.instrument_key,exchange:exact.exchange,segment:exact.segment};
}

function normalizeDerivativeExpiry(raw){
  if(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  const value=Number(raw);
  if(!Number.isFinite(value)||value<=0)return '';
  const ms=value<1e11?value*1000:value;
  const date=new Date(ms+330*60000);
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):'';
}
// Official Upstox MCX BOD JSON is used only when the search API has no matching
// contracts. Never synthesize exchange keys or treat a stale master as live data.
const MCX_BOD_JSON_URL='https://assets.upstox.com/market-quote/instruments/exchange/MCX.json.gz';
let mcxBodCache={date:'',expiresAt:0,rows:null};
async function getMcxBodRows(){
  const date=new Date(Date.now()+330*60000).toISOString().slice(0,10);
  if(mcxBodCache.date===date&&Date.now()<mcxBodCache.expiresAt&&mcxBodCache.rows)
    return mcxBodCache.rows;
  try{
    const response=await fetch(MCX_BOD_JSON_URL,{
      headers:{Accept:'application/gzip'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('BOD_HTTP_UNAVAILABLE');
    const declaredLength=Number(response.headers.get('content-length'));
    if(Number.isFinite(declaredLength)&&declaredLength>15*1024*1024)
      throw new Error('BOD_COMPRESSED_OVERSIZE');
    const chunks=[];let bytesRead=0;
    if(!response.body)throw new Error('BOD_NO_BODY');
    for await(const chunk of response.body){
      bytesRead+=chunk.byteLength;
      if(bytesRead>15*1024*1024)throw new Error('BOD_COMPRESSED_OVERSIZE');
      chunks.push(Buffer.from(chunk));
    }
    const compressed=Buffer.concat(chunks);
    if(compressed[0]!==0x1f||compressed[1]!==0x8b)
      throw new Error('BOD_NOT_GZIP');
    const expanded=gunzipSync(compressed,{maxOutputLength:100*1024*1024});
    const parsed=JSON.parse(expanded.toString('utf8'));
    if(!Array.isArray(parsed))throw new Error('BOD_NOT_ARRAY');
    const rows=parsed.filter(x=>x?.segment==='MCX_FO'&&x?.exchange==='MCX');
    // Refresh within the day. A failed download must never fall back to yesterday.
    mcxBodCache={date,expiresAt:Date.now()+15*60*1000,rows};
    return rows;
  }catch(_error){throw new Error('UPSTOX_MCX_INSTRUMENT_MASTER_UNAVAILABLE');}
}
function exactMcxUnderlying(item,query){
  const underlying=String(item?.underlying_symbol||'').toUpperCase().trim();
  if(underlying)return underlying===query.toUpperCase();
  return String(item?.trading_symbol||'').toUpperCase().startsWith(query.toUpperCase()+' ');
}
async function searchIntradayDerivativeContracts(query,type,exchange='NSE'){
  const q=String(query||'').trim(),kind=String(type||'').toUpperCase(),market=String(exchange||'NSE').toUpperCase();
  if(!q||q.length>50||!['FUT','CE','PE'].includes(kind)||!['NSE','MCX'].includes(market))
    throw new Error('INVALID_DERIVATIVE_SEARCH');
  const url=new URL('https://api.upstox.com/v2/instruments/search');
  url.searchParams.set('query',q);
  url.searchParams.set('exchanges',market);
  url.searchParams.set('segments','FO');
  if(kind==='CE'||kind==='PE')url.searchParams.set('instrument_types',kind);
  // MCX GOLD/SILVER futures can skip calendar months; current_month may return none.
  // Search eligible listed contracts and validate exact expiry downstream.
  if(market!=='MCX')url.searchParams.set('expiry','current_month');
  url.searchParams.set('records','30');
  // Upstox's result format includes page count; scan bounded pages so futures
  // do not disappear behind option contracts on the first search page.
  const rows=[];
  let totalPages=1;
  let pagesRead=0;
  const MAX_PAGES=12;
  // The Analytics Token supports public market-data GET APIs, but MCX's
  // official instrument master is more reliable than the optional search
  // endpoint. Use that public master directly for analytics-only MCX research.
  for(let page=1;!(market==='MCX'&&ANALYTICS_TOKEN)&&page<=Math.min(totalPages,MAX_PAGES);page++){
    url.searchParams.set('page_number',String(page));
    const response=await fetch(url,{headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
    const body=await response.json().catch(()=>({}));
    if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
    if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
    if(!response.ok)throw new Error('UPSTOX_DERIVATIVE_SEARCH_FAILED');
  markUpstoxReadVerified();
    if(!Array.isArray(body?.data))throw new Error('UPSTOX_DERIVATIVE_SEARCH_BAD_PAYLOAD');
    rows.push(...body.data);
    pagesRead++;
    const total=Number(body?.meta_data?.page?.total_pages);
    if(Number.isInteger(total)&&total>=1)totalPages=total;
  }
  const expectedSegment=market+'_FO';
  let matches=rows.filter(x=>x?.segment===expectedSegment&&String(x.instrument_type).toUpperCase()===kind&&
     typeof x.instrument_key==='string'&&x.instrument_key.startsWith(expectedSegment+'|')&&x.trading_symbol&&
     (market!=='MCX'||!x.underlying_type||String(x.underlying_type).toUpperCase()==='COM')&&
     (market!=='MCX'||!x.underlying_symbol||String(x.underlying_symbol).toUpperCase()===q.toUpperCase()))
    .map(x=>({instrumentKey:String(x.instrument_key),segment:expectedSegment,exchange:market,
      instrumentType:kind,tradingSymbol:String(x.trading_symbol),
      underlyingSymbol:String(x.underlying_symbol||'').toUpperCase(),
      expiry:normalizeDerivativeExpiry(x.expiry),lotSize:Number(x.lot_size),
      qtyMultiplier:x.qty_multiplier===undefined?null:Number(x.qty_multiplier),
      tickSize:x.tick_size===undefined?null:Number(x.tick_size),
      strike:Number(x.strike_price||0)}));
  let source='INSTRUMENT_SEARCH';
  let bodRecordCount=0;
  if(market==='MCX'&&!matches.length){
    const bod=await getMcxBodRows();
    bodRecordCount=bod.length;
    const today=new Date(Date.now()+330*60000).toISOString().slice(0,10);
    const actual=bod.filter(x=>String(x.instrument_type).toUpperCase()===kind&&
      typeof x.instrument_key==='string'&&x.instrument_key.startsWith('MCX_FO|')&&
      typeof x.trading_symbol==='string'&&exactMcxUnderlying(x,q)&&
      (!x.underlying_type||String(x.underlying_type).toUpperCase()==='COM')&&
      normalizeDerivativeExpiry(x.expiry)>=today);
    matches=actual.map(x=>({instrumentKey:String(x.instrument_key),segment:'MCX_FO',exchange:'MCX',
      instrumentType:kind,tradingSymbol:String(x.trading_symbol),
      underlyingSymbol:String(x.underlying_symbol||q).toUpperCase(),
      expiry:normalizeDerivativeExpiry(x.expiry),lotSize:Number(x.lot_size),
      qtyMultiplier:x.qty_multiplier===undefined?null:Number(x.qty_multiplier),
      tickSize:x.tick_size===undefined?null:Number(x.tick_size),
      strike:Number(x.strike_price||0)}));
    source='MCX_BOD_JSON';
  }
  return {contracts:matches,diagnostics:{upstreamCount:rows.length,matchedCount:matches.length,
    pagesRead,morePagesAvailable:totalPages>pagesRead,source,bodRecordCount,
    result:source==='MCX_BOD_JSON'?(matches.length?'BOD_FALLBACK_MATCHES':'BOD_NO_MATCHES'):
      matches.length?'MATCHES_FOUND':rows.length?'FILTERED_OUT':'UPSTREAM_EMPTY'}};

}
async function readOnlyFullMarketQuote(instrumentKey){
  const key=String(instrumentKey||'').trim();
  if(!/^(NSE_EQ|NSE_FO|MCX_FO)\|[A-Za-z0-9_]+$/.test(key))throw new Error('INVALID_INSTRUMENT_KEY');
  const url=new URL('https://api.upstox.com/v3/market-quote/quotes');
  url.searchParams.set('instrument_key',key);
  const response=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
  const body=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
  if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
  if(!response.ok)throw new Error('UPSTOX_LIVE_QUOTE_FAILED');
  markUpstoxReadVerified();
  const raw=body?.data;
  if(!raw||typeof raw!=='object')throw new Error('UPSTOX_LIVE_QUOTE_EMPTY');
  const quote=Object.values(raw).find(x=>x?.instrument_token===key);
  if(!quote)throw new Error('UPSTOX_LIVE_QUOTE_INSTRUMENT_MISMATCH');
  const bid=Number(quote?.depth?.buy?.[0]?.price),ask=Number(quote?.depth?.sell?.[0]?.price);
  const stamp=quote?.timestamp;
  const timestamp=typeof stamp==='number'?stamp:typeof stamp==='string'&&/^\d+$/.test(stamp)?Number(stamp):Date.parse(stamp);
  // Quote.timestamp describes response generation; last_trade_time is the last actual execution.
  // Keep both so the client can fail closed on inactive or stale contracts.
  const tradeTime=Number(quote.last_trade_time);
  const lastTradeTime=Number.isFinite(tradeTime)&&tradeTime>0?tradeTime:null;
  return {instrumentKey:key,lastPrice:Number.isFinite(Number(quote.last_price))?Number(quote.last_price):null,
    bid:Number.isFinite(bid)&&bid>0?bid:null,ask:Number.isFinite(ask)&&ask>0?ask:null,
    timestamp:Number.isFinite(timestamp)?timestamp:null,lastTradeTime,
    openInterest:typeof quote.oi==='number'&&Number.isFinite(quote.oi)?quote.oi:null,
    tradedVolume:typeof quote.volume==='number'&&Number.isFinite(quote.volume)?quote.volume:null,
    mode:'READ_ONLY'};
}
async function readOnlyOptionGreeks(instrumentKey){
  const key=String(instrumentKey||'').trim();
  if(!/^(NSE_FO|MCX_FO)\|[A-Za-z0-9_]+$/.test(key))throw new Error('INVALID_INSTRUMENT_KEY');
  const url=new URL('https://api.upstox.com/v3/market-quote/option-greek');
  url.searchParams.set('instrument_key',key);
  const response=await fetch(url,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+activeToken()}});
  const body=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403)onUpstoxUnauthorized(response.status);
  if(response.status===429)throw new Error('UPSTOX_RATE_LIMITED');
  if(!response.ok)throw new Error('UPSTOX_OPTION_GREEKS_UNAVAILABLE');
  markUpstoxReadVerified();
  const match=Object.values(body?.data||{}).find(x=>x?.instrument_token===key);
  if(!match)throw new Error('UPSTOX_OPTION_GREEKS_UNAVAILABLE');
  const numbers=['delta','gamma','theta','vega','iv'];
  return Object.fromEntries(numbers.map(field=>[field,typeof match[field]==='number'&&Number.isFinite(match[field])?match[field]:null]));
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
        authenticated: ANALYTICS_TOKEN ? !analyticsRejected : Boolean(productionAccessToken && oauthExpiresAt && Date.now() < oauthExpiresAt),
        authMode: ANALYTICS_TOKEN ? 'ANALYTICS_TOKEN' : 'OAUTH_DAILY',
        tokenVerified: ANALYTICS_TOKEN ? analyticsVerified : Boolean(productionAccessToken && oauthExpiresAt && Date.now() < oauthExpiresAt),
        tokenExpiresAt: ANALYTICS_TOKEN ? null : (oauthExpiresAt ? new Date(oauthExpiresAt).toISOString() : null),
        credentialStatus: ANALYTICS_TOKEN ?
          (analyticsRejected ? 'INVALID_OR_EXPIRED' : analyticsVerified ? 'VERIFIED' : 'CONFIGURED_UNVERIFIED') :
          (productionAccessToken && oauthExpiresAt && Date.now() < oauthExpiresAt ? 'ACTIVE' : 'LOGIN_REQUIRED'),
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
        const status = authErrorHttpStatus(message) ?? (message === 'UPSTOX_RATE_LIMITED' ? 429 : 502);
        const safeError = ['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED','UPSTOX_ANALYTICS_PERMISSION_DENIED','UPSTOX_RATE_LIMITED','UPSTOX_MARKET_DATA_UNAVAILABLE','UPSTOX_MARKET_DATA_REQUEST_FAILED','UPSTOX_MARKET_DATA_EMPTY','INVALID_INSTRUMENT_KEY'].includes(message) ? message : 'UPSTOX_MARKET_DATA_UNAVAILABLE';
        return json(res, status, { error: safeError, orderSubmissionAllowed: false });
      }
    }
    if (url.pathname === '/api/upstox/history' && req.method === 'GET') {
      try {
        const candles = await readOnlyHistoricalDaily(url.searchParams.get('instrument_key'), url.searchParams.get('from_date'), url.searchParams.get('to_date'));
        return json(res, 200, { provider:'UPSTOX', mode:'READ_ONLY', interval:'1day', candles, orderSubmissionAllowed:false });
      } catch (error) {
        const message=String(error?.message||'MARKET_DATA_ERROR');
        const status=authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_DATE_RANGE'||message==='INVALID_INSTRUMENT_KEY'?400:502);
        const allowed=['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED','UPSTOX_ANALYTICS_PERMISSION_DENIED','UPSTOX_RATE_LIMITED','UPSTOX_MARKET_DATA_UNAVAILABLE','UPSTOX_HISTORICAL_DATA_REQUEST_FAILED','UPSTOX_HISTORICAL_DATA_EMPTY','INVALID_INSTRUMENT_KEY','INVALID_DATE_RANGE'];
        return json(res,status,{error:allowed.includes(message)?message:'UPSTOX_MARKET_DATA_UNAVAILABLE',orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/intraday' && req.method === 'GET') {
      try { const interval=url.searchParams.get('interval');const instrumentKey=url.searchParams.get('instrument_key');const candles=await readOnlyIntradayCandles(instrumentKey,interval);return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',interval,candles,orderSubmissionAllowed:false}); }
      catch(error){const message=String(error?.message||'UPSTOX_INTRADAY_UNAVAILABLE');return json(res,(authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message.startsWith('INVALID_')?400:502)),{error:message,orderSubmissionAllowed:false});}
    }
    if (url.pathname === '/api/upstox/fundamentals' && req.method === 'GET') {
      try {
        const data=await readOnlyFundamentals(url.searchParams.get('isin'));
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',data,orderSubmissionAllowed:false});
      } catch(error) {
        const message=String(error?.message||'FUNDAMENTALS_ERROR');
        const status=authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_ISIN'?400:502);
        return json(res,status,{error:['UPSTOX_REAUTHENTICATION_REQUIRED','UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED','UPSTOX_ANALYTICS_PERMISSION_DENIED','UPSTOX_RATE_LIMITED','UPSTOX_FUNDAMENTALS_REQUEST_FAILED','INVALID_ISIN'].includes(message)?message:'UPSTOX_FUNDAMENTALS_UNAVAILABLE',orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/instrument-search' && req.method === 'GET') {
      try { const data=await searchEquityInstrument(url.searchParams.get('query')); return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',data,orderSubmissionAllowed:false}); }
      catch(error){ const message=String(error?.message||'INSTRUMENT_SEARCH_ERROR'); const status=authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_INSTRUMENT_QUERY'||message==='UPSTOX_EQUITY_NOT_FOUND'?400:502); return json(res,status,{error:message,orderSubmissionAllowed:false}); }
    }
    if (url.pathname === '/api/upstox/derivative-search' && req.method === 'GET') {
      try{
        const found=await searchIntradayDerivativeContracts(url.searchParams.get('query'),url.searchParams.get('type'),url.searchParams.get('exchange')||'NSE');
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',contracts:found.contracts,diagnostics:found.diagnostics,orderSubmissionAllowed:false});
      }catch(error){
        const message=String(error?.message||'UPSTOX_DERIVATIVE_SEARCH_FAILED');
        return json(res,(authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_DERIVATIVE_SEARCH'?400:502)),
          {error:message,orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/live-quote' && req.method === 'GET') {
      try{
        const quote=await readOnlyFullMarketQuote(url.searchParams.get('instrument_key'));
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',quote,orderSubmissionAllowed:false});
      }catch(error){
        const message=String(error?.message||'UPSTOX_LIVE_QUOTE_FAILED');
        return json(res,(authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_INSTRUMENT_KEY'?400:502)),{error:message,orderSubmissionAllowed:false});
      }
    }
    if (url.pathname === '/api/upstox/option-greeks' && req.method === 'GET') {
      try{
        const greeks=await readOnlyOptionGreeks(url.searchParams.get('instrument_key'));
        return json(res,200,{provider:'UPSTOX',mode:'READ_ONLY',greeks,orderSubmissionAllowed:false});
      }catch(error){
        const message=String(error?.message||'UPSTOX_OPTION_GREEKS_UNAVAILABLE');
        return json(res,(authErrorHttpStatus(message)??(message==='UPSTOX_RATE_LIMITED'?429:message==='INVALID_INSTRUMENT_KEY'?400:502)),{error:message,orderSubmissionAllowed:false});
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
      oauthExpiresAt = nextUpstoxOAuthExpiry(tokenReceivedAt);

      return send(res, 200,
        'UPSTOX_OAUTH_AUTHENTICATION_PASSED\n' +
        'UPSTOX_PRODUCTION_PROFILE_READ_PASSED\n' +
        'UPSTOX_PRODUCTION_CONNECTIVITY_PASSED\n' +
        'TOKEN_RECEIVED_SERVER_SIDE=true\n' +
        'TOKEN_PERSISTED=false\n' +
        'OAUTH_TOKEN_VALID_UNTIL_IST_NEXT_0330=true\n' +
        'ANALYTICS_TOKEN_CONFIGURED=' + Boolean(ANALYTICS_TOKEN) + '\n' +
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
