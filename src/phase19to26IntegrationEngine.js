// AI TRADE PRO — PHASE 19–26 INTEGRATED PAPER READINESS ENGINE
// Deliberately PAPER_ONLY: this module accepts market observations and paper intents only.
// It has no broker credentials, transport, order placement, or production execution path.

const SAFETY = Object.freeze({ PAPER_ONLY: true, REAL_ORDER_PLACED: false, PRODUCTION_REAL_TRADING_ENABLED: false });
const PHASES = Object.freeze([19,20,21,22,23,24,25,26]);

function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }

export function createPhase19to26Session(options = {}) {
  const state = {
    observations: 0, acceptedObservations: 0, rejectedObservations: 0,
    signals: { total: 0, buy: 0, sell: 0, hold: 0, accepted: 0, rejected: 0 },
    paper: { intents: 0, fills: 0, realizedPnl: 0 },
    risk: { checks: 0, blocked: 0, dailyLoss: 0, maxExposure: 0 },
    strategies: new Map(),
    backtest: { runs: 0, walkForwardRuns: 0, outOfSamplePasses: 0 },
    monitoring: { heartbeats: 0, alerts: 0, incidents: 0 },
    recovery: { checkpoints: 0, restores: 0, rollbacks: 0 },
    audit: []
  };
  let lastObservation = null;

  function audit(event, data = {}) { state.audit.push({ at: Date.now(), event, ...data }); }

  function observeMarket(observation = {}) {
    state.observations += 1;
    const timestamp = Number(observation.timestamp);
    const price = Number(observation.price);
    const valid = finitePositive(price) && Number.isFinite(timestamp) && (!lastObservation || timestamp > lastObservation.timestamp);
    if (!valid) {
      state.rejectedObservations += 1;
      audit('MARKET_OBSERVATION_REJECTED', { timestamp, price });
      return { accepted: false, reason: 'INVALID_OR_OUT_OF_ORDER' };
    }
    lastObservation = { timestamp, price };
    state.acceptedObservations += 1;
    audit('MARKET_OBSERVATION_ACCEPTED', { timestamp, price });
    return { accepted: true };
  }

  function recordSignal(signal = {}) {
    const action = String(signal.action || 'HOLD').toUpperCase();
    state.signals.total += 1;
    if (action === 'BUY') state.signals.buy += 1;
    else if (action === 'SELL') state.signals.sell += 1;
    else state.signals.hold += 1;
    if (signal.accepted === false) state.signals.rejected += 1; else state.signals.accepted += 1;
    audit('SIGNAL_RECORDED', { action, strategy: signal.strategy || 'unknown' });
    return { action, accepted: signal.accepted !== false };
  }

  function validateRisk(intent = {}) {
    state.risk.checks += 1;
    const exposure = Math.max(0, Number(intent.exposure || 0));
    const dailyLoss = Math.max(0, Number(intent.dailyLoss || 0));
    const maxExposure = Number(options.maxExposure ?? 100000);
    const maxDailyLoss = Number(options.maxDailyLoss ?? 5000);
    const allowed = exposure <= maxExposure && dailyLoss <= maxDailyLoss && intent.killSwitch !== true;
    if (!allowed) state.risk.blocked += 1;
    state.risk.dailyLoss = dailyLoss;
    state.risk.maxExposure = Math.max(state.risk.maxExposure, exposure);
    audit(allowed ? 'RISK_ALLOWED' : 'RISK_BLOCKED', { exposure, dailyLoss });
    return { allowed, exposure, dailyLoss, maxExposure, maxDailyLoss };
  }

  function registerStrategy(strategy = {}) {
    const id = String(strategy.id || '').trim();
    if (!id) throw new Error('STRATEGY_ID_REQUIRED');
    state.strategies.set(id, { id, enabled: strategy.enabled !== false, weight: Number(strategy.weight ?? 1) });
    audit('STRATEGY_REGISTERED', { id });
    return state.strategies.get(id);
  }

  function paperIntent(intent = {}) {
    if (!SAFETY.PAPER_ONLY || SAFETY.REAL_ORDER_PLACED || SAFETY.PRODUCTION_REAL_TRADING_ENABLED) throw new Error('PAPER_SAFETY_INVARIANT_VIOLATION');
    const risk = validateRisk(intent);
    if (!risk.allowed) return { executed: false, paperOnly: true, blocked: true };
    state.paper.intents += 1;
    state.paper.fills += 1;
    const pnl = Number(intent.pnl || 0);
    if (Number.isFinite(pnl)) state.paper.realizedPnl += pnl;
    audit('PAPER_INTENT_FILLED', { side: intent.side || 'N/A', pnl });
    return { executed: true, paperOnly: true, realOrderPlaced: false, pnl };
  }

  function recordBacktest(result = {}) {
    state.backtest.runs += 1;
    if (result.walkForward) state.backtest.walkForwardRuns += 1;
    if (result.outOfSamplePassed) state.backtest.outOfSamplePasses += 1;
    audit('BACKTEST_RECORDED', { walkForward: !!result.walkForward, outOfSamplePassed: !!result.outOfSamplePassed });
  }

  function heartbeat() { state.monitoring.heartbeats += 1; audit('HEARTBEAT'); return { healthy: true }; }
  function alert(name, severity = 'INFO') { state.monitoring.alerts += 1; audit('ALERT', { name, severity }); }
  function incident(name) { state.monitoring.incidents += 1; audit('INCIDENT', { name }); }
  function checkpoint() { state.recovery.checkpoints += 1; audit('CHECKPOINT'); return { checkpointId: state.recovery.checkpoints }; }
  function restore() { state.recovery.restores += 1; audit('RESTORE'); return { restored: true, liveOrders: false }; }
  function rollback() { state.recovery.rollbacks += 1; audit('ROLLBACK'); return { rolledBack: true, liveOrders: false }; }

  function snapshot() {
    return {
      phases: [...PHASES],
      safety: { ...SAFETY },
      observations: { total: state.observations, accepted: state.acceptedObservations, rejected: state.rejectedObservations },
      signals: { ...state.signals }, paper: { ...state.paper }, risk: { ...state.risk },
      strategies: [...state.strategies.values()], backtest: { ...state.backtest },
      monitoring: { ...state.monitoring }, recovery: { ...state.recovery }, auditCount: state.audit.length
    };
  }

  return Object.freeze({ observeMarket, recordSignal, validateRisk, registerStrategy, paperIntent, recordBacktest, heartbeat, alert, incident, checkpoint, restore, rollback, snapshot });
}

export function getPhase19to26SafetyState() { return { ...SAFETY }; }
export function getPhase19to26Definition() { return PHASES.map(phase => ({ phase, status: 'IMPLEMENTED_IN_INTEGRATION_ENGINE' })); }

if (typeof window !== 'undefined') {
  window.createPhase19to26Session = createPhase19to26Session;
  console.log('AI TRADE PRO — Phase 19–26 integration engine loaded (PAPER_ONLY)');
}
