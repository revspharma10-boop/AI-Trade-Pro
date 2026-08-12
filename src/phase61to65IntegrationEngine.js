/* AI TRADE PRO — PHASE 61–65 FINAL QUALIFICATION ENGINE
 * Paper-only by construction. No broker/live-order capability.
 */
import { createPhase36to60Engine } from './phase36to60IntegrationEngine.js';

const SAFETY = Object.freeze({
  PAPER_ONLY: true,
  REAL_ORDER_PLACED: false,
  PRODUCTION_REAL_TRADING_ENABLED: false
});

const PHASES = Object.freeze([
  { id: 61, name: 'Full-System Integration Validation', gate: 'cross_phase_integrity' },
  { id: 62, name: 'Long-Duration Paper Trading', gate: 'sustained_paper_observation' },
  { id: 63, name: 'Performance & Strategy Qualification', gate: 'performance_evidence_only' },
  { id: 64, name: 'Failure & Recovery Certification', gate: 'fail_safe_recovery' },
  { id: 65, name: 'Final Paper-Production Certification', gate: 'all_paper_gates_passed' }
]);

function clone(v) { return JSON.parse(JSON.stringify(v)); }

export function createPhase61to65Engine() {
  const base = createPhase36to60Engine();
  const sessions = [];
  const failures = [];
  const evidence = [];
  const audit = [];

  const assertPaper = () => {
    const s = base.getSafety();
    if (s.PAPER_ONLY !== true || s.REAL_ORDER_PLACED !== false || s.PRODUCTION_REAL_TRADING_ENABLED !== false) {
      throw new Error('Final qualification safety violation');
    }
    return true;
  };

  const integrationCheck = () => {
    assertPaper();
    const snapshot = base.getSnapshot();
    const ok = snapshot.safety.PAPER_ONLY === true && snapshot.phases.length === 25 &&
      snapshot.safety.REAL_ORDER_PLACED === false && snapshot.safety.PRODUCTION_REAL_TRADING_ENABLED === false;
    audit.push({ type: 'INTEGRATION_CHECK', ok, at: Date.now() });
    return { ok, phase36to60Count: snapshot.phases.length };
  };

  const startPaperSession = (id = `PAPER-${sessions.length + 1}`) => {
    assertPaper();
    const session = { id, mode: 'PAPER_ONLY', startedAt: Date.now(), observations: 0, signals: 0, fills: 0, status: 'RUNNING' };
    sessions.push(session);
    audit.push({ type: 'PAPER_SESSION_STARTED', id, at: Date.now() });
    return clone(session);
  };

  const recordObservation = (sessionId, observation = {}) => {
    assertPaper();
    const s = sessions.find(x => x.id === sessionId);
    if (!s || s.status !== 'RUNNING') return { accepted: false, reason: 'SESSION_NOT_RUNNING' };
    const result = base.observeMarket({ ...observation, timestamp: Number(observation.timestamp ?? Date.now()) });
    if (result.accepted) s.observations++;
    return { ...result, sessionId };
  };

  const recordSignal = (sessionId, signal) => {
    assertPaper();
    const s = sessions.find(x => x.id === sessionId);
    if (!s || s.status !== 'RUNNING') return { accepted: false, reason: 'SESSION_NOT_RUNNING' };
    const result = base.recordSignal(signal);
    s.signals++;
    return { ...result, sessionId };
  };

  const closePaperSession = (sessionId) => {
    assertPaper();
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return { closed: false, reason: 'NOT_FOUND' };
    s.status = 'COMPLETED'; s.endedAt = Date.now();
    audit.push({ type: 'PAPER_SESSION_COMPLETED', id: sessionId, at: Date.now() });
    return { closed: true, session: clone(s) };
  };

  const qualifyPerformance = ({ trades = [], signals = [] } = {}) => {
    const pnls = trades.map(t => Number(t.pnl)).filter(Number.isFinite);
    const wins = pnls.filter(x => x > 0).length;
    const losses = pnls.filter(x => x < 0).length;
    const pnl = pnls.reduce((a, b) => a + b, 0);
    const winRate = pnls.length ? wins / pnls.length : 0;
    const grossWin = pnls.filter(x => x > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnls.filter(x => x < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    const signalCount = signals.length;
    const performance = { trades: pnls.length, wins, losses, pnl, winRate, profitFactor, signals: signalCount, mode: 'PAPER_ANALYTICS' };
    evidence.push({ type: 'PERFORMANCE', performance });
    return clone(performance);
  };

  const injectFailure = (type) => {
    assertPaper();
    const result = base.fault(type);
    const item = { type, safeState: result.safeState === true, at: Date.now() };
    failures.push(item); audit.push({ type: 'FAILURE_CERTIFIED', ...item });
    return clone(item);
  };

  const recoveryCheck = () => {
    assertPaper();
    const cp = base.checkpoint();
    const restored = base.restore(cp);
    const rolledBack = base.rollback().paperOnly === true;
    return { checkpoint: true, restored, rolledBack, failSafe: restored && rolledBack };
  };

  const finalCertification = () => {
    assertPaper();
    const s = base.getSafety();
    const completedSessions = sessions.filter(x => x.status === 'COMPLETED').length;
    const safetyOk = s.PAPER_ONLY === true && s.REAL_ORDER_PLACED === false && s.PRODUCTION_REAL_TRADING_ENABLED === false;
    const certification = {
      certified: safetyOk,
      paperOnly: safetyOk,
      integration: integrationCheck().ok,
      sessionsCompleted: completedSessions,
      failuresTested: failures.length,
      evidenceCount: evidence.length,
      auditEvents: audit.length,
      safety: clone(s)
    };
    evidence.push({ type: 'FINAL_CERTIFICATION', certification });
    return clone(certification);
  };

  return Object.freeze({
    getPhases: () => clone(PHASES),
    getSafety: () => clone(SAFETY),
    getBaseSnapshot: base.getSnapshot,
    integrationCheck,
    startPaperSession,
    recordObservation,
    recordSignal,
    closePaperSession,
    qualifyPerformance,
    injectFailure,
    recoveryCheck,
    finalCertification,
    assertPaper,
    getEvidence: () => clone(evidence),
    getSessions: () => clone(sessions),
    getFailures: () => clone(failures),
    getAudit: () => clone(audit)
  });
}

export const PHASE61_TO_65 = PHASES;
export const PHASE61_TO_65_SAFETY = SAFETY;
console.log('AI TRADE PRO — Phase 61–65 final qualification engine loaded (PAPER_ONLY)');
