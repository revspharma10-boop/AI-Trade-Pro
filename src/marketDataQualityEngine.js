// AI TRADE PRO — MARKET DATA QUALITY / LIVE-MARKET ROBUSTNESS
// Quality gate only. It never places broker/live orders.

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const finitePositive = v => Number.isFinite(Number(v)) && Number(v) > 0;

export function createMarketDataQualityEngine(options = {}) {
  const cfg = {
    maxAgeMs: Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : 15000,
    maxGapPct: Number.isFinite(options.maxGapPct) ? options.maxGapPct : 10,
    maxFutureMs: Number.isFinite(options.maxFutureMs) ? options.maxFutureMs : 5000
  };
  const state = new Map();
  const counters = { accepted: 0, rejected: 0, stale: 0, invalid: 0, duplicate: 0, outOfOrder: 0, gap: 0, interruptions: 0, recoveries: 0 };

  function evaluate(tick = {}, now = Date.now()) {
    const symbol = typeof tick.symbol === 'string' ? tick.symbol.trim() : '';
    const price = num(tick.price);
    const volume = num(tick.volume);
    const timestamp = num(tick.timestamp) ?? now;
    const previous = symbol ? state.get(symbol) : null;
    const reasons = [];

    if (!symbol) reasons.push('MISSING_SYMBOL');
    if (!finitePositive(price)) reasons.push('INVALID_PRICE');
    if (tick.volume != null && (!Number.isFinite(volume) || volume < 0)) reasons.push('INVALID_VOLUME');
    if (!Number.isFinite(timestamp)) reasons.push('INVALID_TIMESTAMP');
    if (Number.isFinite(timestamp) && timestamp > now + cfg.maxFutureMs) reasons.push('FUTURE_TIMESTAMP');
    if (previous && timestamp < previous.timestamp) reasons.push('OUT_OF_ORDER');
    if (previous && timestamp === previous.timestamp && price === previous.price) reasons.push('DUPLICATE_TICK');
    if (Number.isFinite(timestamp) && now - timestamp > cfg.maxAgeMs) reasons.push('STALE_DATA');
    if (previous && finitePositive(previous.price) && finitePositive(price)) {
      const gapPct = Math.abs((price - previous.price) / previous.price) * 100;
      if (gapPct > cfg.maxGapPct) reasons.push('PRICE_GAP');
    }
    if (tick.marketOpen === false) reasons.push('MARKET_CLOSED');
    if (tick.sourceAvailable === false) reasons.push('SOURCE_UNAVAILABLE');

    const unique = [...new Set(reasons)];
    const accepted = unique.length === 0;
    if (accepted) { counters.accepted++; if (previous?.interrupted) counters.recoveries++; }
    else {
      counters.rejected++;
      if (unique.includes('STALE_DATA')) counters.stale++;
      if (unique.some(r => r.startsWith('INVALID_') || r === 'MISSING_SYMBOL' || r === 'FUTURE_TIMESTAMP')) counters.invalid++;
      if (unique.includes('DUPLICATE_TICK')) counters.duplicate++;
      if (unique.includes('OUT_OF_ORDER')) counters.outOfOrder++;
      if (unique.includes('PRICE_GAP')) counters.gap++;
      if (unique.includes('SOURCE_UNAVAILABLE')) counters.interruptions++;
    }
    if (symbol) state.set(symbol, { timestamp, price, interrupted: unique.includes('SOURCE_UNAVAILABLE') || unique.includes('STALE_DATA') });
    return Object.freeze({ accepted, symbol, price, timestamp, reasons: unique, quality: accepted ? 'GOOD' : 'UNSAFE', safeForSignal: accepted, safeForPaperExecution: accepted, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false });
  }

  function sourceStatus(source = {}) {
    const available = source.available !== false;
    const recovering = available && source.recovering === true;
    return Object.freeze({ available, recovering, quality: available ? (recovering ? 'RECOVERING' : 'AVAILABLE') : 'INTERRUPTED', safeForSignal: available && !recovering, safeForPaperExecution: available && !recovering, paperOnly: true });
  }
  function snapshot() { return Object.freeze({ counters: { ...counters }, symbolsTracked: state.size, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false }); }
  function reset() { state.clear(); Object.keys(counters).forEach(k => counters[k] = 0); return snapshot(); }
  return Object.freeze({ evaluate, sourceStatus, snapshot, reset });
}

export function assertMarketDataQualitySafety(result) { return Boolean(result?.paperOnly === true && result?.realOrderPlaced === false && result?.productionRealTradingEnabled === false && result?.safeForPaperExecution === false ? true : result?.paperOnly === true && result?.realOrderPlaced === false && result?.productionRealTradingEnabled === false); }

console.log('AI TRADE PRO — market data quality engine loaded');
