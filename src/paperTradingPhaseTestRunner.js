import { createPaperTradingPhaseGate, validatePaperMarketInput, authorizePaperSignal, createPaperTradeRecord } from './paperTradingPhaseGate.js';

const results = [];
const test = (name, condition) => results.push({ name, passed: Boolean(condition) });

export function runPaperTradingPhaseTests() {
  results.length = 0;

  const gate = createPaperTradingPhaseGate({
    marketData: {}, analysis: {}, strategy: {}, risk: {}, execution: {}
  });

  test('Paper phase gate is ready', gate.ready === true);
  test('Execution mode is PAPER_ONLY', gate.mode === 'PAPER_ONLY' && gate.paperOnly === true);
  test('Real order remains disabled', gate.realOrderPlaced === false);
  test('Production live trading remains disabled', gate.productionRealTradingEnabled === false);

  const market = validatePaperMarketInput({ symbol: 'nse:reliance', price: 2500, timestamp: new Date().toISOString() });
  test('Valid market input is accepted', market.valid === true && market.symbol === 'NSE:RELIANCE');
  test('Invalid market price is rejected', validatePaperMarketInput({ symbol: 'RELIANCE', price: 0 }).valid === false);
  test('Invalid symbol is rejected', validatePaperMarketInput({ symbol: '', price: 100 }).valid === false);

  const buy = authorizePaperSignal({ action: 'BUY' }, { safe: true });
  test('Safe BUY signal is paper-executable', buy.executable === true && buy.paperOnly === true);
  test('NO_TRADE is rejected', authorizePaperSignal({ action: 'NO_TRADE' }).executable === false);
  test('Risk-blocked signal is rejected', authorizePaperSignal({ action: 'BUY' }, { safe: false }).reason === 'RISK_BLOCKED');
  test('Invalid action is rejected', authorizePaperSignal({ action: 'HOLD' }).executable === false);

  const record = createPaperTradeRecord({ signal: { action: 'BUY' }, market: { symbol: 'RELIANCE', price: 2500 }, quantity: 10 });
  test('Paper trade record is created', record.valid === true);
  test('Paper trade has no real order', record.paperOnly === true && record.realOrderPlaced === false);
  test('Invalid quantity is rejected', createPaperTradeRecord({ signal: { action: 'BUY' }, market: { symbol: 'RELIANCE', price: 2500 }, quantity: 0 }).valid === false);

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const summary = {
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false,
    results: [...results]
  };
  console.table(summary);
  console.log(`PAPER TRADING PHASE VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperTradingPhaseTests = runPaperTradingPhaseTests;
