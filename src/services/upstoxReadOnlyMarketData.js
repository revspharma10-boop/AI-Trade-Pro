const DEFAULT_BASE = import.meta.env.VITE_UPSTOX_READONLY_API_BASE || 'https://ai-trade-pro-oauth.onrender.com';

async function request(path) {
  const response = await fetch(DEFAULT_BASE + path, { method: 'GET', headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
    if (response.status === 429) throw new Error('UPSTOX_RATE_LIMITED');
    if (response.status >= 500) throw new Error('UPSTOX_MARKET_DATA_UNAVAILABLE');
    throw new Error(['INVALID_INSTRUMENT_KEY','UPSTOX_MARKET_DATA_EMPTY'].includes(body?.error) ? body.error : 'UPSTOX_READ_ONLY_API_FAILED');
  }
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
