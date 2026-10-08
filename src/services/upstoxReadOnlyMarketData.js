import { normalizeReadOnlyFailure } from './upstoxReadOnlyErrorCodes.js';
const DEFAULT_BASE = import.meta.env.VITE_UPSTOX_READONLY_API_BASE || 'https://ai-trade-pro-oauth.onrender.com';

async function request(path) {
  let response;
  try { response = await fetch(DEFAULT_BASE + path, { method: 'GET', headers: { Accept: 'application/json' } }); }
  catch { throw new Error('UPSTOX_BACKEND_UNREACHABLE: Check Render service availability and browser connectivity.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeReadOnlyFailure(response.status,body));
  return body;
}

export async function getUpstoxReadOnlyStatus() {
  return request('/api/upstox/status');
}

export async function getUpstoxQuote(instrumentKey) {
  if (!instrumentKey) throw new Error('INSTRUMENT_KEY_REQUIRED');
  const payload = await request('/api/upstox/quote?instrument_key=' + encodeURIComponent(instrumentKey));
  return { provider: 'UPSTOX', mode: 'READ_ONLY', instrumentKey, data: payload.data, orderSubmissionAllowed: false };
}

export const UPSTOX_READ_ONLY_SAFETY = Object.freeze({
  PAPER_ONLY: true,
  REAL_ORDER_PLACED: false,
  PRODUCTION_REAL_TRADING_ENABLED: false,
  ORDER_SUBMISSION_ALLOWED: false
});


export async function getUpstoxDailyHistory(instrumentKey, { fromDate, toDate } = {}) {
  if (!instrumentKey) throw new Error('INSTRUMENT_KEY_REQUIRED');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fromDate||'')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(toDate||''))) throw new Error('DATE_RANGE_REQUIRED');
  const q = new URLSearchParams({ instrument_key: instrumentKey, from_date: fromDate, to_date: toDate });
  const payload = await request('/api/upstox/history?' + q.toString());
  if (!Array.isArray(payload?.candles)) throw new Error('UPSTOX_HISTORICAL_DATA_EMPTY');
  return { provider:'UPSTOX', mode:'READ_ONLY', instrumentKey, interval:'1day', candles:payload.candles, orderSubmissionAllowed:false };
}


export async function getUpstoxFundamentals(isin) {
  const id=String(isin||'').trim().toUpperCase();
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(id)) throw new Error('VALID_ISIN_REQUIRED');
  const payload=await request('/api/upstox/fundamentals?isin='+encodeURIComponent(id));
  return { provider:'UPSTOX', mode:'READ_ONLY', isin:id, data:payload.data, orderSubmissionAllowed:false };
}


export async function searchUpstoxEquity(query) {
  const q=String(query||'').trim();
  if(!q) throw new Error('INSTRUMENT_QUERY_REQUIRED');
  const payload=await request('/api/upstox/instrument-search?query='+encodeURIComponent(q));
  return payload.data;
}


export function assessDailyHistoryFreshness(candles=[], now=new Date()) {
  if(!Array.isArray(candles)||!candles.length)return {fresh:false,reason:'NO_CANDLES',latest:null};
  const latest=String(candles[candles.length-1]?.datetime||candles[0]?.datetime||'');
  const latestMs=Date.parse(latest), nowMs=new Date(now).getTime();
  if(!Number.isFinite(latestMs)||!Number.isFinite(nowMs)||latestMs>nowMs+86400000)return {fresh:false,reason:'INVALID_CANDLE_TIMESTAMP',latest};
  // Daily bars may legitimately lag across weekends/market holidays. A 4-calendar-day
  // ceiling accepts a Friday bar through Monday while failing closed on older feeds.
  const ageDays=(nowMs-latestMs)/86400000;
  return {fresh:ageDays<=4,reason:ageDays<=4?'FRESH':'STALE_DAILY_HISTORY',latest,ageDays:Number(ageDays.toFixed(2))};
}

export async function getUpstoxIntradayCandles(instrumentKey,interval='5m'){
 if(!instrumentKey||!['1m','5m','15m'].includes(interval))throw new Error('INVALID_INTRADAY_REQUEST');
 const q=new URLSearchParams({instrument_key:instrumentKey,interval});
 const payload=await request('/api/upstox/intraday?'+q.toString());
 if(!Array.isArray(payload.candles))throw new Error('UPSTOX_INTRADAY_DATA_EMPTY');
 return {provider:'UPSTOX',mode:'READ_ONLY',interval,candles:payload.candles,orderSubmissionAllowed:false};
}

export async function searchUpstoxDerivatives(query,type,exchange='NSE'){
 const q=String(query||'').trim(),kind=String(type||'').toUpperCase();
 if(!q||!['FUT','CE','PE'].includes(kind)||!['MCX','NSE'].includes(exchange))throw new Error('INVALID_DERIVATIVE_SEARCH');
 const params=new URLSearchParams({query:q,type:kind,exchange});
 const payload=await request('/api/upstox/derivative-search?'+params.toString());
 if(!Array.isArray(payload.contracts))throw new Error('UPSTOX_DERIVATIVE_SEARCH_FAILED');
 return {contracts:payload.contracts,orderSubmissionAllowed:false};
}


export async function getUpstoxLiveQuote(instrumentKey){
 if(!/^(NSE_EQ|NSE_FO|MCX_FO)\|[A-Za-z0-9_]+$/.test(String(instrumentKey||'')))throw new Error('INVALID_INSTRUMENT_KEY');
 const payload=await request('/api/upstox/live-quote?instrument_key='+encodeURIComponent(instrumentKey));
 if(!payload?.quote||payload.quote.instrumentKey!==instrumentKey)throw new Error('UPSTOX_LIVE_QUOTE_EMPTY');
 return {provider:'UPSTOX',mode:'READ_ONLY',...payload.quote,orderSubmissionAllowed:false};
}
export async function getUpstoxOptionGreeks(instrumentKey){
 if(!/^(NSE_FO|MCX_FO)\|[A-Za-z0-9_]+$/.test(String(instrumentKey||'')))throw new Error('INVALID_INSTRUMENT_KEY');
 const payload=await request('/api/upstox/option-greeks?instrument_key='+encodeURIComponent(instrumentKey));
 return {provider:'UPSTOX',mode:'READ_ONLY',greeks:payload.greeks??null,orderSubmissionAllowed:false};
}
