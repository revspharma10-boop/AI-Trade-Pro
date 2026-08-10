// AI TRADE PRO — PHASE 5: PAPER TRADING CONTROL CENTER
// Coordinates existing paper-safe engines. This layer never submits broker/live orders.

const STATES = new Set(['IDLE', 'RUNNING', 'PAUSED', 'STOPPED']);

export function createPaperTradingControlCenter(deps = {}) {
  let state = 'IDLE';
  let session = null;
  let events = [];
  let emergencyStop = false;

  const record = (type, payload = {}) => {
    events.push({ type, at: new Date().toISOString(), ...payload, paperOnly: true });
    if (events.length > 500) events = events.slice(-500);
  };

  const safety = () => ({
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false,
    emergencyStop
  });

  function start(config = {}) {
    if (emergencyStop) return { accepted: false, reason: 'EMERGENCY_STOP_ACTIVE', state, ...safety() };
    if (state === 'RUNNING') return { accepted: false, reason: 'SESSION_ALREADY_RUNNING', state, ...safety() };
    session = deps.session?.start ? deps.session.start(config) : { status: 'OPEN', ...config };
    state = 'RUNNING';
    record('SESSION_STARTED');
    return { accepted: true, state, session, ...safety() };
  }

  function pause() {
    if (state !== 'RUNNING') return { accepted: false, reason: 'NOT_RUNNING', state, ...safety() };
    state = 'PAUSED'; record('SESSION_PAUSED'); return { accepted: true, state, ...safety() };
  }

  function resume() {
    if (emergencyStop) return { accepted: false, reason: 'EMERGENCY_STOP_ACTIVE', state, ...safety() };
    if (state !== 'PAUSED') return { accepted: false, reason: 'NOT_PAUSED', state, ...safety() };
    state = 'RUNNING'; record('SESSION_RESUMED'); return { accepted: true, state, ...safety() };
  }

  function stop() {
    if (!['RUNNING', 'PAUSED'].includes(state)) return { accepted: false, reason: 'SESSION_NOT_ACTIVE', state, ...safety() };
    const closed = deps.session?.close ? deps.session.close() : { status: 'CLOSED' };
    session = closed; state = 'STOPPED'; record('SESSION_STOPPED');
    return { accepted: true, state, session, ...safety() };
  }

  function emergencyShutdown(reason = 'MANUAL_EMERGENCY_STOP') {
    emergencyStop = true; state = 'STOPPED'; record('EMERGENCY_STOP', { reason });
    return { accepted: true, state, reason, ...safety() };
  }

  function resetEmergencyStop() {
    emergencyStop = false; state = 'IDLE'; record('EMERGENCY_STOP_RESET');
    return { accepted: true, state, ...safety() };
  }

  function stageCandidate(candidate, context = {}) {
    if (state !== 'RUNNING' || emergencyStop) return { accepted: false, reason: emergencyStop ? 'EMERGENCY_STOP_ACTIVE' : 'SESSION_NOT_RUNNING', ...safety() };
    const result = deps.strategyScanner?.canCandidateEnter ? deps.strategyScanner.canCandidateEnter(candidate, context) : { accepted: true };
    if (!result.accepted) { record('CANDIDATE_REJECTED', { reason: result.reason, symbol: candidate?.symbol }); return { ...result, ...safety() }; }
    record('CANDIDATE_STAGED', { symbol: candidate.symbol, action: candidate.action });
    return { accepted: true, candidate: { ...candidate, paperOnly: true, realOrderPlaced: false }, ...safety() };
  }

  function paperExecute(order = {}) {
    if (state !== 'RUNNING' || emergencyStop) return { accepted: false, reason: emergencyStop ? 'EMERGENCY_STOP_ACTIVE' : 'SESSION_NOT_RUNNING', ...safety() };
    if (deps.execution?.execute) {
      const result = deps.execution.execute({ ...order, paperOnly: true, realOrderPlaced: false });
      record('PAPER_EXECUTION', { symbol: order.symbol, action: order.action });
      return { ...result, ...safety() };
    }
    record('PAPER_EXECUTION', { symbol: order.symbol, action: order.action });
    return { accepted: true, order: { ...order, paperOnly: true, realOrderPlaced: false }, ...safety() };
  }

  function snapshot() {
    return Object.freeze({ state, session, emergencyStop, eventCount: events.length, events: events.slice(-50), ...safety() });
  }

  return Object.freeze({ start, pause, resume, stop, emergencyShutdown, resetEmergencyStop, stageCandidate, paperExecute, snapshot });
}

export function assertControlCenterPaperSafe(snapshot) {
  return Boolean(snapshot && STATES.has(snapshot.state) && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false);
}

console.log('AI TRADE PRO — paper trading control center engine loaded');
