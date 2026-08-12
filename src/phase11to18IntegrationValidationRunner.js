// AI TRADE PRO — PHASE 11–18 INTEGRATED VALIDATION RUNNER
// Validation only. No real broker/order capability is exposed.
import { createPhase11to18Session, getPhase11to18Definition, getPhase11to18SafetyState } from './phase11to18IntegrationEngine.js';

const checks = [];
function check(name, condition) {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  return passed;
}

export function runPhase11to18IntegrationValidation() {
  checks.length = 0;
  const session = createPhase11to18Session();
  const safety = getPhase11to18SafetyState();
  const phases = getPhase11to18Definition();

  check('All phases 11–18 are registered', phases.length === 8);
  check('Paper-only mode is enforced', safety.paperOnly === true);
  check('No real order has been placed', safety.realOrderPlaced === false);
  check('Production real trading is disabled', safety.productionRealTradingEnabled === false);

  const t1 = Date.now() - 1000;
  check('Valid market tick is accepted', session.ingestTick({ timestamp: t1, price: 100 }).accepted === true);
  check('Duplicate tick is rejected', session.ingestTick({ timestamp: t1, price: 100 }).reason === 'DUPLICATE');
  check('Out-of-order tick is rejected', session.ingestTick({ timestamp: t1 - 1, price: 99 }).reason === 'OUT_OF_ORDER');
  check('Invalid price is rejected', session.ingestTick({ timestamp: t1 + 1, price: 0 }).reason === 'INVALID_PRICE');

  check('BUY signal is tracked', session.recordSignal({ action: 'BUY', accepted: true }).action === 'BUY');
  check('SELL signal is tracked', session.recordSignal({ action: 'SELL', accepted: true }).action === 'SELL');
  check('HOLD signal is tracked', session.recordSignal({ action: 'HOLD', accepted: true }).action === 'HOLD');
  check('Risk-blocked signal is tracked', session.recordSignal({ action: 'BUY', riskBlocked: true }).accepted === true);
  check('Paper execution is recorded', session.paperOrder({ side: 'BUY', pnl: 10 }).realOrderPlaced === false);
  check('Paper exit/P&L is recorded', session.paperOrder({ side: 'SELL', exit: true, pnl: -3 }).executed === true);

  check('Stress scenario can pass safely', session.runStressScenario('duplicate-data', () => {
    const result = session.ingestTick({ timestamp: t1, price: 100 });
    if (result.reason !== 'DUPLICATE') throw new Error('duplicate gate failed');
  }) === true);

  const snapshot = session.snapshot();
  check('Market observations are exposed', snapshot.market.ticks >= 4);
  check('Signal metrics are exposed', snapshot.signals.total === 4);
  check('Paper P&L is exposed', snapshot.paper.realizedPnl === 7);
  check('Audit trail is available', snapshot.audit.length > 0);
  check('No real-order capability is exposed', snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false);

  const passed = checks.filter(x => x.passed).length;
  const failed = checks.length - passed;
  const result = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: safety.paperOnly, realOrderPlaced: safety.realOrderPlaced, productionRealTradingEnabled: safety.productionRealTradingEnabled, phaseCount: phases.length, checks, snapshot };
  console.table(result);
  console.log(`PHASE 11–18 INTEGRATED VALIDATION: ${result.suiteStatus}`);
  return result;
}

if (typeof window !== 'undefined') window.runPhase11to18IntegrationValidation = runPhase11to18IntegrationValidation;
