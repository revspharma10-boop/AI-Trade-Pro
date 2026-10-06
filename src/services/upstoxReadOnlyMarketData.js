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
