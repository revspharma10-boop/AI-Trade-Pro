/* AI TRADE PRO — FULL-SYSTEM INTEGRATION VALIDATION
 * Consolidates the currently implemented production-qualification layers into
 * one end-to-end paper-only gate. It never enables real trading.
 */
import { createPhase3ProductionQualificationEngine } from './phase3ProductionQualificationEngine.js';
import { createStage1ExtendedPaperTradingEngine } from './stage1ExtendedPaperTradingEngine.js';
import { evaluateProductionLiveQualification, assertProductionLiveSafety } from './productionLiveQualificationGate.js';

export async function runFullSystemIntegrationValidation() {
  const results = [];
  const check = (name, condition) => {
    const passed = condition === true;
    results.push({ name, passed });
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    return passed;
  };

  const phase3 = createPhase3ProductionQualificationEngine();
  const stage1 = createStage1ExtendedPaperTradingEngine();

  const p3Safety = phase3.getSafety();
  const s1Safety = stage1.getSafety();
  check('Phase 3 paper safety is enabled', p3Safety.PAPER_ONLY === true && p3Safety.REAL_ORDER_PLACED === false && p3Safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Stage 1 paper safety is enabled', s1Safety.PAPER_ONLY === true && s1Safety.REAL_ORDER_PLACED === false && s1Safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const connection = await phase3.connect();
  check('Sandbox connectivity is paper-safe', connection.connected === true && connection.environment === 'SANDBOX_SIMULATION' && connection.browserLiveOrdersAllowed === false);
  const auth = await phase3.authenticate();
  check('Authentication is secret-safe', auth.authenticated === true && auth.browserSecrets === false);

  const t = Date.now();
  check('Phase 3 market observation accepts fresh data', phase3.observe({ symbol: 'NIFTY', price: 25000, timestamp: t, volume: 1000 }).accepted === true);
  check('Phase 3 duplicate protection works', phase3.observe({ symbol: 'NIFTY', price: 25000, timestamp: t }).reason === 'DUPLICATE');
  check('Phase 3 signal quality gate works', phase3.evaluateSignal({ symbol: 'NIFTY', action: 'BUY', score: 88 }).accepted === true);
  check('Phase 3 risk gate allows compliant intent', phase3.riskCheck({ quantity: 1, exposure: 25000 }).allowed === true);
  check('Phase 3 risk gate blocks excessive exposure', phase3.riskCheck({ quantity: 1, exposure: 100001 }).allowed === false);
  const p3Order = phase3.paperOrder({ symbol: 'NIFTY', side: 'BUY', quantity: 1, price: 25000, exposure: 25000 });
  check('Phase 3 paper execution is simulated', p3Order.executed === true && p3Order.order.paperOnly === true && p3Order.order.live === false);
  check('Phase 3 recovery is paper-safe', phase3.restore(phase3.checkpoint()).restored === true);
  check('Phase 3 rollback is paper-safe', phase3.rollback().rolledBack === true && phase3.getSafety().REAL_ORDER_PLACED === false);

  const sessionId = 'FULL-SYSTEM-INTEGRATION';
  check('Stage 1 market source connects', stage1.connectMarketSource({ name: 'INTEGRATION_PAPER_SOURCE', symbol: 'NIFTY' }).connected === true);
  const session = stage1.startSession(sessionId, { staleAfterMs: 30000 });
  check('Stage 1 paper session starts', session.status === 'RUNNING' && session.mode === 'PAPER_ONLY');
  const t2 = Date.now();
  check('Stage 1 accepts fresh tick', stage1.ingestTick(sessionId, { symbol: 'NIFTY', price: 25000, timestamp: t2, volume: 1000 }).accepted === true);
  check('Stage 1 rejects duplicate tick', stage1.ingestTick(sessionId, { symbol: 'NIFTY', price: 25000, timestamp: t2, volume: 1000 }).reason === 'DUPLICATE');
  check('Stage 1 rejects stale tick', stage1.ingestTick(sessionId, { symbol: 'NIFTY', price: 24900, timestamp: t2 - 60001, volume: 1000 }).reason === 'STALE');
  check('Stage 1 tracks BUY signal', stage1.ingestSignal(sessionId, { action: 'BUY', score: 88 }).action === 'BUY');
  const entry = stage1.simulatePaperEntry(sessionId, { id: 'INTEGRATION-P1', symbol: 'NIFTY', side: 'BUY', quantity: 1, price: 25000 });
  check('Stage 1 paper entry is simulated', entry.executed === true && entry.realOrderPlaced === false);
  const exit = stage1.simulatePaperExit(sessionId, 'INTEGRATION-P1', 25100);
  check('Stage 1 paper exit records P&L', exit.closed === true && exit.trade.pnl === 100 && exit.realOrderPlaced === false);
  const snapshot = stage1.getSnapshot();
  check('Stage 1 snapshot contains P&L and journal', snapshot.realizedPnl === 100 && snapshot.journalCount > 0);
  check('Stage 1 session closes cleanly', stage1.closeSession(sessionId).closed === true);

  const finalSafety = snapshot.safety;
  check('Integrated safety remains paper-only', finalSafety.PAPER_ONLY === true && finalSafety.REAL_ORDER_PLACED === false && finalSafety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Production qualification does not auto-enable live trading', evaluateProductionLiveQualification({}).productionRealTradingEnabled === false);
  check('Unsafe live-enabled snapshot is rejected', (() => { try { assertProductionLiveSafety({ paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: true }); return false; } catch { return true; } })());

  const passed = results.filter(x => x.passed).length;
  const failed = results.length - passed;
  const result = Object.freeze({
    passed, failed, allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false,
    results, snapshot
  });

  console.table(results);
  console.log('============================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log('PaperOnly: true');
  console.log('RealOrderPlaced: false');
  console.log('ProductionRealTradingEnabled: false');
  console.log('============================================================');
  console.log(`FULL-SYSTEM INTEGRATION VALIDATION: ${result.suiteStatus}`);
  console.log('FINAL SAFETY SNAPSHOT:', snapshot.safety);
  return result;
}

if (typeof window !== 'undefined') window.runFullSystemIntegrationValidation = runFullSystemIntegrationValidation;
