// AI TRADE PRO — REAL-MARKET OBSERVATION / PAPER SIGNAL ENGINE
// Observation only. No broker, order, or live-trading side effects.

const MAX_DEFAULT_AGE_MS = 30_000;

function finite(value) {
  return Number.isFinite(Number(value));
}

export function validateMarketTick(tick, { now = Date.now(), maxAgeMs = MAX_DEFAULT_AGE_MS } = {}) {
  if (!tick || typeof tick !== 'object') return { valid: false, reason: 'INVALID_TICK' };
  if (typeof tick.symbol !== 'string' || !tick.symbol.trim()) return { valid: false, reason: 'INVALID_SYMBOL' };
  if (!finite(tick.price) || Number(tick.price) <= 0) return { valid: false, reason: 'INVALID_PRICE' };
  if (!finite(tick.timestamp)) return { valid: false, reason: 'INVALID_TIMESTAMP' };
  const ageMs = Math.max(0, Number(now) - Number(tick.timestamp));
  if (ageMs > maxAgeMs) return { valid: false, reason: 'STALE_MARKET_DATA', ageMs, maxAgeMs };
  return { valid: true, symbol: tick.symbol.trim().toUpperCase(), price: Number(tick.price), timestamp: Number(tick.timestamp), ageMs };
}

export function buildPaperSignal({ tick, recommendation = 'NO_TRADE', score = 0, riskSafe = true, now = Date.now(), maxAgeMs = MAX_DEFAULT_AGE_MS } = {}) {
  const market = validateMarketTick(tick, { now, maxAgeMs });
  if (!market.valid) return Object.freeze({ action: 'NO_TRADE', executable: false, reason: market.reason, paperOnly: true });
  if (!riskSafe) return Object.freeze({ symbol: market.symbol, action: 'NO_TRADE', executable: false, reason: 'RISK_BLOCKED', score: Number(score) || 0, timestamp: market.timestamp, paperOnly: true });
  const action = ['BUY', 'SELL', 'NO_TRADE'].includes(recommendation) ? recommendation : 'NO_TRADE';
  return Object.freeze({ symbol: market.symbol, action, executable: action !== 'NO_TRADE', reason: action === 'NO_TRADE' ? 'NO_TRADE' : 'READY_FOR_PAPER_EXECUTION', score: Number(score) || 0, price: market.price, timestamp: market.timestamp, ageMs: market.ageMs, paperOnly: true, realOrderPlaced: false });
}

export function createObservationSnapshot({ ticks = [], signals = [] } = {}) {
  return Object.freeze({
    mode: 'REAL_MARKET_OBSERVATION_PAPER_ONLY',
    tickCount: ticks.length,
    signalCount: signals.length,
    executablePaperSignals: signals.filter(s => s.executable === true && s.paperOnly === true).length,
    noTradeSignals: signals.filter(s => s.action === 'NO_TRADE').length,
    rejectedSignals: signals.filter(s => s.executable === false && s.action !== 'NO_TRADE').length,
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  });
}

console.log('AI TRADE PRO — paper market observation engine loaded');
