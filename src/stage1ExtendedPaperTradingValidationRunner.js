/* AI TRADE PRO — STAGE 1 VALIDATION RUNNER */
import { createStage1ExtendedPaperTradingEngine } from './stage1ExtendedPaperTradingEngine.js';

export function runStage1ExtendedPaperTradingValidation() {
  const e = createStage1ExtendedPaperTradingEngine();
  const results = [];
  const check = (name, condition) => { const passed = Boolean(condition); results.push({ name, passed }); console.log(`${passed ? '✅' : '❌'} ${name}`); return passed; };
  const safety = e.getSafety();
  check('Stage 1 is registered', e.getStage().id === 1);
  check('Paper-only safety is enabled', safety.PAPER_ONLY === true);
  check('No real order is placed', safety.REAL_ORDER_PLACED === false);
  check('Production real trading is disabled', safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('Market source connects in paper mode', e.connectMarketSource({ name: 'TEST_REAL_MARKET_ADAPTER', symbol: 'NIFTY' }).connected === true);
  const session = e.startSession('STAGE1-TEST', { staleAfterMs: 30000 });
  check('Extended paper session starts', session.status === 'RUNNING' && session.mode === 'PAPER_ONLY');
  const t0 = Date.now();
  check('Fresh market tick is accepted', e.ingestTick('STAGE1-TEST', { symbol:'NIFTY', price:25000, timestamp:t0, volume:1000 }).accepted === true);
  check('Out-of-order tick is rejected', e.ingestTick('STAGE1-TEST', { symbol:'NIFTY', price:24999, timestamp:t0-1, volume:1000 }).reason === 'OUT_OF_ORDER');
  check('Duplicate tick is rejected', e.ingestTick('STAGE1-TEST', { symbol:'NIFTY', price:25000, timestamp:t0, volume:1000 }).reason === 'DUPLICATE');
  check('Stale tick is rejected', e.ingestTick('STAGE1-TEST', { symbol:'NIFTY', price:25001, timestamp:t0-60000, volume:1000 }).reason === 'STALE');
  check('Invalid tick is rejected', e.ingestTick('STAGE1-TEST', { symbol:'NIFTY', price:-1, timestamp:Date.now(), volume:1000 }).reason === 'INVALID_TICK');
  check('BUY signal is tracked', e.ingestSignal('STAGE1-TEST', { action:'BUY', score:90, strategyId:'TREND-1' }).action === 'BUY');
  check('SELL signal is tracked', e.ingestSignal('STAGE1-TEST', { action:'SELL', score:88, strategyId:'TREND-1' }).action === 'SELL');
  check('HOLD signal is tracked', e.ingestSignal('STAGE1-TEST', { action:'HOLD', score:80, strategyId:'TREND-1' }).action === 'HOLD');
  const entry = e.simulatePaperEntry('STAGE1-TEST', { id:'STAGE1-POS-1', symbol:'NIFTY', side:'BUY', quantity:10, price:25000 });
  check('Paper entry is simulated', entry.executed === true && entry.fill.mode === 'PAPER_ONLY');
  const exit = e.simulatePaperExit('STAGE1-TEST', 'STAGE1-POS-1', 25100);
  check('Paper exit is simulated', exit.closed === true && exit.trade.pnl === 1000);
  const snap = e.getSnapshot();
  check('P&L is recorded', snap.realizedPnl === 1000);
  check('Win rate is calculated', snap.winRate === 1);
  check('Market-data quality is exposed', snap.quality.accepted >= 1 && snap.quality.rejected >= 4);
  check('Trade journal is populated', snap.journalCount > 0);
  check('Session closes cleanly', e.closeSession('STAGE1-TEST').closed === true);
  const final = e.getSnapshot();
  check('Final snapshot remains paper-only', final.safety.PAPER_ONLY === true && final.safety.REAL_ORDER_PLACED === false && final.safety.PRODUCTION_REAL_TRADING_ENABLED === false);
  check('No live order capability is exposed', final.safety.REAL_ORDER_PLACED === false);
  const passed = results.filter(x=>x.passed).length, failed = results.length-passed;
  const result = { passed, failed, allAssertionsPassed: failed===0, suiteStatus: failed===0?'PASSED':'FAILED', paperOnly:final.safety.PAPER_ONLY, realOrderPlaced:final.safety.REAL_ORDER_PLACED, productionRealTradingEnabled:final.safety.PRODUCTION_REAL_TRADING_ENABLED, results, snapshot:final };
  console.table(results); console.log('============================================================');
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`); console.log(`AllAssertionsPassed: ${result.allAssertionsPassed}`);
  console.log(`PaperOnly: ${result.paperOnly}`); console.log(`RealOrderPlaced: ${result.realOrderPlaced}`); console.log(`ProductionRealTradingEnabled: ${result.productionRealTradingEnabled}`);
  console.log('============================================================'); console.log(`STAGE 1 EXTENDED PAPER TRADING VALIDATION: ${result.suiteStatus}`); console.log('FINAL SAFETY SNAPSHOT:', final.safety);
  return result;
}
if (typeof window !== 'undefined') window.runStage1ExtendedPaperTradingValidation = runStage1ExtendedPaperTradingValidation;
