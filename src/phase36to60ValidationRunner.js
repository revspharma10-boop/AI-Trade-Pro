/* AI TRADE PRO — PHASE 36–60 CONSOLIDATED VALIDATION */
import { createPhase36to60Engine, PHASE36_TO_60 } from './phase36to60IntegrationEngine.js';

export function runPhase36to60Validation() {
  const engine = createPhase36to60Engine();
  const results = [];
  const check = (name, condition) => {
    const passed = Boolean(condition);
    results.push({ name, passed });
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    return passed;
  };

  const safety = engine.getSafety();
  check('25 phases 36–60 are registered', PHASE36_TO_60.length === 25);
  check('Phase IDs are contiguous 36–60', PHASE36_TO_60.every((p, i) => p.id === 36 + i));
  check('Paper-only safety is enabled', safety.PAPER_ONLY === true);
  check('No real order is placed', safety.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', safety.PRODUCTION_REAL_TRADING_ENABLED === false);

  const t0 = Date.now();
  check('Valid market observation is accepted', engine.observeMarket({ symbol: 'NIFTY', price: 25000, timestamp: t0, volume: 1000 }).accepted === true);
  check('Out-of-order observation is rejected', engine.observeMarket({ symbol: 'NIFTY', price: 24999, timestamp: t0 - 1 }).accepted === false);
  check('Multi-timeframe aggregation is complete', engine.aggregateTimeframes('NIFTY').complete === true);

  const ranked = engine.rankSignal({ symbol: 'NIFTY', action: 'BUY', score: 88, strategyId: 'TREND-1' });
  check('Advanced signal ranking works', ranked.rank === 'A' && ranked.score === 88);
  check('Signal recording is quality-gated', engine.recordSignal(ranked).accepted === true);
  check('Strategy registration works', engine.registerStrategy({ id: 'TREND-1', name: 'Trend', weight: 1 }).id === 'TREND-1');
  check('Strategy ensemble produces a decision', engine.ensemble([{ action: 'BUY', score: 90 }, { action: 'BUY', score: 80 }, { action: 'SELL', score: 70 }]).action === 'BUY');

  const risk = engine.portfolioRisk([{ notional: 10000 }, { notional: 5000 }]);
  check('Portfolio exposure aggregation works', risk.grossExposure === 15000);
  check('Concentration control is evaluated', risk.withinLimits === true);
  check('Paper rebalance plan is generated', engine.planRebalance([], { NIFTY: 0.5 }).orders.length === 1);

  const fill = engine.simulateFill({ symbol: 'NIFTY', action: 'BUY', quantity: 10, price: 25000 });
  check('Paper execution simulation works', fill.executed === true && fill.fill.mode === 'PAPER_ONLY');
  check('Slippage is modelled', fill.fill.slippageBps > 0);
  const pos = engine.openPosition({ id: 'POS-1', symbol: 'NIFTY', side: 'BUY', quantity: 10, entryPrice: fill.fill.fillPrice });
  check('Position lifecycle opens a paper position', pos.status === 'OPEN');
  check('Position lifecycle closes safely', engine.closePosition('POS-1', 25100).closed === true);
  check('State reconciliation passes', engine.reconcile().consistent === true);

  check('Event-driven backtest returns metrics', engine.backtest([{ price: 100 }, { price: 110 }]).returnPct === 10);
  check('Walk-forward analytics are recorded', engine.walkForward([{ price: 100 }, { price: 105 }, { price: 110 }]).windows >= 1);
  check('Out-of-sample analytics are available', engine.walkForward([{ price: 100 }, { price: 105 }, { price: 110 }]).outOfSample !== undefined);
  check('Transaction costs are modelled', engine.transactionCosts({ notional: 100000 }).totalCost > 0);
  check('Scenario analysis is available', engine.scenarioAnalysis([1, -1, 2]).samples === 3);

  check('Fault injection remains fail-safe', engine.fault('DATA_SOURCE_INTERRUPTION').safeState === true);
  check('Heartbeat is observable', engine.heartbeat().status === 'HEALTHY');
  check('Operational alert is recorded', engine.alert('TEST_ALERT').paperOnly === true);
  const cp = engine.checkpoint();
  check('Checkpoint is created', cp.id.startsWith('CP-'));
  check('Recovery restore is paper-safe', engine.restore(cp) === true);
  check('Rollback is paper-safe', engine.rollback().paperOnly === true);
  check('Audit trail is populated', engine.getSnapshot().auditCount > 0);
  check('Paper qualification evidence is generated', engine.qualify().qualified === true);

  const final = engine.getSnapshot();
  const finalSafety = final.safety;
  check('Final snapshot remains paper-only', finalSafety.PAPER_ONLY === true && finalSafety.REAL_ORDER_PLACED === false && finalSafety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Final snapshot has no live order capability', finalSafety.REAL_ORDER_PLACED === false);

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const result = {
    passed,
    failed,
    allAssertionsPassed: failed === 0,
    suiteStatus: failed === 0 ? 'PASSED' : 'FAILED',
    paperOnly: finalSafety.PAPER_ONLY,
    realOrderPlaced: finalSafety.REAL_ORDER_PLACED,
    productionRealTradingEnabled: finalSafety.PRODUCTION_REAL_TRADING_ENABLED,
    phases: PHASE36_TO_60.map(p => p.id),
    results,
    snapshot: final
  };

  console.table(results);
  console.log('============================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log(`PaperOnly: ${result.paperOnly}`);
  console.log(`RealOrderPlaced: ${result.realOrderPlaced}`);
  console.log(`ProductionRealTradingEnabled: ${result.productionRealTradingEnabled}`);
  console.log('============================================================');
  console.log(`PHASES 36–60 VALIDATION: ${result.suiteStatus}`);
  console.log('FINAL SAFETY SNAPSHOT:', finalSafety);
  return result;
}

if (typeof window !== 'undefined') window.runPhase36to60Validation = runPhase36to60Validation;
