// AI TRADE PRO — MARKET DATA QUALITY / LIVE-MARKET ROBUSTNESS VALIDATION
import { createMarketDataQualityEngine, assertMarketDataQualitySafety } from './marketDataQualityEngine.js';

const tests = [];
const check = (name, condition) => { tests.push({ name, passed: Boolean(condition) }); console.log(condition ? '✅' : '❌', name); };

export function runMarketDataQualityValidation() {
  const q = createMarketDataQualityEngine({ maxAgeMs: 15000, maxGapPct: 10 });
  const now = Date.now();
  let r = q.evaluate({ symbol: 'RELIANCE', price: 2500, volume: 1000, timestamp: now }, now);
  check('Valid tick is accepted', r.accepted);
  check('Valid tick is signal-safe', r.safeForSignal);
  check('Valid tick is paper-execution-safe', r.safeForPaperExecution);
  check('Paper-only safety is enforced', assertMarketDataQualitySafety(r));

  r = q.evaluate({ symbol: 'RELIANCE', price: 2501, timestamp: now - 30000 }, now);
  check('Stale data is rejected', !r.accepted && r.reasons.includes('STALE_DATA'));
  r = q.evaluate({ symbol: 'RELIANCE', price: 0, timestamp: now + 100000 }, now);
  check('Invalid/future data is rejected', !r.accepted && r.reasons.includes('INVALID_PRICE') && r.reasons.includes('FUTURE_TIMESTAMP'));
  r = q.evaluate({ symbol: 'RELIANCE', price: 2501, timestamp: now }, now);
  check('Duplicate timestamp/price is rejected', !r.accepted && r.reasons.includes('DUPLICATE_TICK'));
  r = q.evaluate({ symbol: 'RELIANCE', price: 2499, timestamp: now - 1 }, now);
  check('Out-of-order data is rejected', !r.accepted && r.reasons.includes('OUT_OF_ORDER'));
  r = q.evaluate({ symbol: 'RELIANCE', price: 3000, timestamp: now + 1 }, now + 1);
  check('Excessive price gap is rejected', !r.accepted && r.reasons.includes('PRICE_GAP'));
  r = q.evaluate({ symbol: 'TCS', price: 3500, timestamp: now, sourceAvailable: false }, now);
  check('Source interruption is rejected', !r.accepted && r.reasons.includes('SOURCE_UNAVAILABLE'));
  r = q.evaluate({ symbol: 'INFY', price: 1500, timestamp: now, marketOpen: false }, now);
  check('Market-closed data is rejected', !r.accepted && r.reasons.includes('MARKET_CLOSED'));
  r = q.evaluate({ symbol: 'HDFC', price: 1600, volume: -1, timestamp: now }, now);
  check('Invalid volume is rejected', !r.accepted && r.reasons.includes('INVALID_VOLUME'));

  let s = q.sourceStatus({ available: false });
  check('Interrupted source is unsafe', !s.safeForSignal && !s.safeForPaperExecution);
  s = q.sourceStatus({ available: true, recovering: true });
  check('Recovering source remains gated', !s.safeForSignal && !s.safeForPaperExecution);
  s = q.sourceStatus({ available: true, recovering: false });
  check('Recovered source becomes available', s.safeForSignal && s.safeForPaperExecution);

  const snap = q.snapshot();
  check('Quality counters are exposed', snap.counters.rejected > 0 && snap.counters.stale > 0 && snap.counters.gap > 0);
  check('No real order capability is exposed', snap.realOrderPlaced === false && snap.productionRealTradingEnabled === false);

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: snap.paperOnly, realOrderPlaced: snap.realOrderPlaced, productionRealTradingEnabled: snap.productionRealTradingEnabled, results: tests };
  console.table(summary);
  console.log(`MARKET DATA QUALITY / LIVE-MARKET ROBUSTNESS VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runMarketDataQualityValidation = runMarketDataQualityValidation;
