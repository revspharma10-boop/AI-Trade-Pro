import { validateMarketTick, buildPaperSignal, createObservationSnapshot } from './paperMarketObservationEngine.js';

export function runPaperMarketObservationTests() {
  const results = [];
  const test = (name, passed) => results.push({ name, passed: Boolean(passed) });
  const now = 1_800_000_000_000;

  const fresh = { symbol: 'RELIANCE', price: 2500, timestamp: now - 1000 };
  const valid = validateMarketTick(fresh, { now });
  test('Fresh market tick passes validation', valid.valid === true);
  test('Symbol is normalized', valid.symbol === 'RELIANCE');
  test('Invalid price is rejected', validateMarketTick({ ...fresh, price: 0 }, { now }).valid === false);
  test('Invalid symbol is rejected', validateMarketTick({ ...fresh, symbol: '' }, { now }).valid === false);
  test('Stale market data is rejected', validateMarketTick({ ...fresh, timestamp: now - 60_000 }, { now }).reason === 'STALE_MARKET_DATA');

  const buy = buildPaperSignal({ tick: fresh, recommendation: 'BUY', score: 88, riskSafe: true, now });
  test('Valid BUY signal is generated', buy.action === 'BUY' && buy.executable === true);
  test('BUY signal is paper-only', buy.paperOnly === true && buy.realOrderPlaced === false);
  test('Risk-blocked signal becomes NO-TRADE', buildPaperSignal({ tick: fresh, recommendation: 'BUY', riskSafe: false, now }).reason === 'RISK_BLOCKED');
  test('NO-TRADE is not executable', buildPaperSignal({ tick: fresh, recommendation: 'NO_TRADE', riskSafe: true, now }).executable === false);
  test('Invalid recommendation is safely rejected', buildPaperSignal({ tick: fresh, recommendation: 'INVALID', riskSafe: true, now }).action === 'NO_TRADE');
  test('Stale tick cannot generate executable signal', buildPaperSignal({ tick: { ...fresh, timestamp: now - 60_000 }, recommendation: 'BUY', now }).executable === false);

  const snapshot = createObservationSnapshot({ ticks: [fresh], signals: [buy] });
  test('Observation snapshot is paper-only', snapshot.paperOnly === true);
  test('Observation snapshot reports no real order', snapshot.realOrderPlaced === false);
  test('Executable signal count is correct', snapshot.executablePaperSignals === 1);

  const passed = results.filter(x => x.passed).length;
  const failed = results.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results };
  console.table(summary);
  console.log(`PAPER MARKET OBSERVATION VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperMarketObservationTests = runPaperMarketObservationTests;
