// AI TRADE PRO — PHASE 27–35 CONSOLIDATED VALIDATION
import { createPhase27to35Session, getPhase27to35Definition, getPhase27to35SafetyState } from './phase27to35IntegrationEngine.js';

export function runPhase27to35Validation() {
  const results = [];
  const check = (name, passed) => { const ok = Boolean(passed); results.push({ name, passed: ok }); console[ok ? 'log' : 'error'](`${ok ? '✅' : '❌'} ${name}`); };
  const session = createPhase27to35Session({ maxPortfolioExposure: 100000, maxSymbolExposure: 50000, maxDailyLoss: 5000, maxOpenPositions: 10, maxSlippageBps: 50 });
  const definition = getPhase27to35Definition();
  const safety = getPhase27to35SafetyState();

  check('9 phases 27–35 are registered', definition.length === 9);
  check('Phase IDs are contiguous 27–35', definition.map(x => x.phase).join(',') === '27,28,29,30,31,32,33,34,35');
  check('Paper-only safety is enabled', safety.PAPER_ONLY === true);
  check('No real order is placed', safety.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const t1 = Date.now() - 1000;
  check('Multi-symbol valid observation is accepted', session.observe('RELIANCE', { timestamp: t1, price: 2500 }).accepted === true);
  check('Second symbol observation is accepted', session.observe('TCS', { timestamp: t1, price: 4000 }).accepted === true);
  check('Out-of-order symbol observation is rejected', session.observe('RELIANCE', { timestamp: t1, price: 2501 }).accepted === false);

  const agg = session.aggregateTimeframes('RELIANCE', { '5m': 'BUY', '15m': 'BUY', '1h': 'HOLD' });
  check('Multi-timeframe aggregation produces BUY', agg.action === 'BUY' && agg.conflict === false);
  check('Strategy registration works', session.registerStrategy({ id: 'STRAT-MTF-01', enabled: true, priority: 10 }).id === 'STRAT-MTF-01');
  check('Quality-gated BUY signal is tracked', session.recordSignal({ action: 'BUY', strategy: 'STRAT-MTF-01', accepted: true }).accepted === true);
  check('SELL signal is tracked', session.recordSignal({ action: 'SELL', strategy: 'STRAT-MTF-01' }).action === 'SELL');
  check('HOLD signal is tracked', session.recordSignal({ action: 'HOLD', strategy: 'STRAT-MTF-01' }).action === 'HOLD');

  check('Portfolio risk allows compliant intent', session.checkPortfolioRisk({ symbol: 'RELIANCE', exposure: 10000, dailyLoss: 0 }).allowed === true);
  check('Portfolio risk blocks excessive exposure', session.checkPortfolioRisk({ symbol: 'RELIANCE', exposure: 1000000, dailyLoss: 0 }).allowed === false);
  check('Portfolio risk blocks kill switch', session.checkPortfolioRisk({ symbol: 'TCS', exposure: 1000, killSwitch: true }).allowed === false);

  const fill = session.paperExecute({ symbol: 'RELIANCE', side: 'BUY', quantity: 10, price: 2500, exposure: 10000, slippageBps: 20 });
  check('Paper execution creates a simulated fill', fill.executed === true && fill.paperOnly === true && fill.realOrderPlaced === false);
  check('Slippage simulation is recorded', fill.slippageBps === 20 && fill.fillPrice > 2500);
  check('Position lifecycle can close a paper position', session.closePosition(fill.positionId, 2520, 200).closed === true);
  check('Performance metrics are available', (() => { const p = session.recordPerformance(); return p.trades === 1 && p.wins === 1 && p.winRate === 1; })());

  const fill2 = session.paperExecute({ symbol: 'TCS', side: 'BUY', quantity: 5, price: 4000, exposure: 10000 });
  check('Second paper position is created', fill2.executed === true);
  check('Position reconciliation is available', session.reconcile({ [fill2.positionId]: { symbol: 'TCS', status: 'OPEN' } }).reconciled === true);

  check('Heartbeat is observable', session.heartbeat('market').healthy === true);
  check('Alert is recorded', session.alert('TEST_ALERT', 'INFO').recorded === true);
  check('Incident is recorded', session.incident('TEST_INCIDENT', 'WARN').recorded === true);
  check('Stale source is safely marked', session.markStaleSource('TEST_SOURCE').safe === false);
  check('Readiness gate passes paper-only controls', session.readinessGate().passed === true);

  const snapshot = session.snapshot();
  check('Final snapshot remains paper-only', snapshot.safety.PAPER_ONLY === true && snapshot.safety.REAL_ORDER_PLACED === false && snapshot.safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Final snapshot contains all phase definitions', snapshot.phases.length === 9 && snapshot.phases[0].phase === 27 && snapshot.phases[8].phase === 35);
  check('Audit trail is populated', snapshot.auditCount >= 10);

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const output = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results, snapshot };
  console.table(results);
  console.log('============================================================');
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`); console.log(`AllAssertionsPassed: ${output.allAssertionsPassed}`);
  console.log('PaperOnly:', output.paperOnly); console.log('RealOrderPlaced:', output.realOrderPlaced); console.log('ProductionRealTradingEnabled:', output.productionRealTradingEnabled);
  console.log('============================================================');
  console[failed === 0 ? 'log' : 'error'](`PHASES 27–35 VALIDATION: ${output.suiteStatus}`);
  return output;
}

if (typeof window !== 'undefined') {
  window.runPhase27to35Validation = runPhase27to35Validation;
  console.log('AI TRADE PRO — Phase 27–35 validation runner loaded');
}
