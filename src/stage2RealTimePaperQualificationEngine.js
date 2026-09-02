/* AI TRADE PRO — STAGE 2 REAL-TIME PAPER QUALIFICATION */
import { createStage1ExtendedPaperTradingEngine } from './stage1ExtendedPaperTradingEngine.js';

export const STAGE2_ACTIVITIES = Object.freeze([
  { id: 76, name: 'Real-time market source qualification' }, { id: 77, name: 'Tick freshness and ordering qualification' },
  { id: 78, name: 'Duplicate and invalid tick protection' }, { id: 79, name: 'Signal quality pipeline qualification' },
  { id: 80, name: 'Paper execution and position lifecycle' }, { id: 81, name: 'Slippage and transaction-cost observation' },
  { id: 82, name: 'P&L and drawdown observation' }, { id: 83, name: 'Source interruption and recovery' },
  { id: 84, name: 'Operational journal and quality metrics' }, { id: 85, name: 'Stage 2 consolidated qualification' }
]);
const SAFETY = Object.freeze({ PAPER_ONLY: true, REAL_ORDER_PLACED: false, PRODUCTION_REAL_TRADING_ENABLED: false });

function flattenPaperSnapshot(s) {
  const paper = s?.paper?.paper ?? s?.paper ?? {};
  const quality = paper?.quality ?? {};
  return {
    quality: {
      accepted: Number(quality.accepted ?? 0),
      rejected: Number(quality.rejected ?? 0),
      stale: Number(quality.stale ?? 0),
      invalid: Number(quality.invalid ?? 0),
      outOfOrder: Number(quality.outOfOrder ?? 0),
      duplicate: Number(quality.duplicate ?? 0),
      sourceInterrupted: Number(quality.sourceInterrupted ?? 0)
    },
    signals: paper?.signals ?? {},
    trades: Number(paper?.trades ?? 0),
    openPositions: Number(paper?.openPositions ?? 0),
    realizedPnl: Number(paper?.realizedPnl ?? s?.realizedPnl ?? 0),
    journalCount: Number(paper?.journalCount ?? s?.journalCount ?? 0),
    winCount: Number(paper?.winCount ?? 0),
    grossWin: Number(paper?.grossWin ?? 0),
    grossLoss: Number(paper?.grossLoss ?? 0)
  };
}

export function createStage2RealTimePaperQualificationEngine(options = {}) {
  const stage1 = createStage1ExtendedPaperTradingEngine(options);
  let sessionId = null, started = false, heartbeat = 0;
  const observations = [], incidents = [];
  const assertSafety = () => { if (!SAFETY.PAPER_ONLY || SAFETY.REAL_ORDER_PLACED || SAFETY.PRODUCTION_REAL_TRADING_ENABLED) throw new Error('STAGE_2_SAFETY_VIOLATION'); stage1.assertSafety(); return true; };
  const start = ({ symbol = 'NIFTY', session = `STAGE2-${Date.now()}`, staleAfterMs = 30000 } = {}) => {
    assertSafety(); stage1.connectMarketSource({ name: 'REAL_TIME_OBSERVATION_SOURCE', symbol });
    const record = stage1.startSession(session, { staleAfterMs });
    if (!record || record.status !== 'RUNNING') return { started: false, reason: record?.reason || 'SESSION_NOT_RUNNING' };
    sessionId = record.id; started = true; heartbeat = Date.now();
    return { started: true, sessionId, symbol, mode: 'PAPER_ONLY' };
  };
  const heartbeatTick = () => { assertSafety(); if (!started) return { healthy: false, reason: 'NOT_STARTED' }; heartbeat = Date.now(); return { healthy: true, at: heartbeat, paperOnly: true }; };
  const observe = tick => { assertSafety(); if (!started) return { accepted: false, reason: 'NOT_STARTED' }; const r = stage1.ingestTick(sessionId, tick); observations.push({ at: Date.now(), accepted: r.accepted === true, reason: r.reason || null, symbol: tick?.symbol }); if (!r.accepted) incidents.push({ type: r.reason || 'REJECTED_TICK', at: Date.now(), safe: true }); heartbeat = Date.now(); return r; };
  const evaluateSignal = signal => { assertSafety(); if (!started) return { accepted: false, reason: 'NOT_STARTED' }; return stage1.ingestSignal(sessionId, signal); };
  const enter = intent => { assertSafety(); return stage1.simulatePaperEntry(sessionId, intent); };
  const exit = (id, price) => { assertSafety(); return stage1.simulatePaperExit(sessionId, id, price); };
  const injectInterruption = reason => { assertSafety(); stage1.disconnectMarketSource(reason); incidents.push({ type: 'SOURCE_INTERRUPTION', reason, at: Date.now(), safe: true }); return { interrupted: true, safe: true, paperOnly: true }; };
  const recover = () => { assertSafety(); const symbol = stage1.getSnapshot().source.symbol || 'NIFTY'; stage1.connectMarketSource({ name: 'REAL_TIME_OBSERVATION_SOURCE_RECOVERY', symbol }); incidents.push({ type: 'SOURCE_RECOVERED', at: Date.now(), safe: true }); return { recovered: true, gatedUntilFreshTick: true, paperOnly: true }; };
  const snapshot = () => {
    assertSafety(); const s = stage1.getSnapshot();
    return Object.freeze({ stage: 2, activities: STAGE2_ACTIVITIES.map(x => x.id), safety: SAFETY, sessionId, started, heartbeat,
      heartbeatHealthy: started && Date.now() - heartbeat < 60000, observations: [...observations], incidents: [...incidents],
      source: s.source, paper: flattenPaperSnapshot(s) });
  };
  const stop = () => { assertSafety(); if (!sessionId) return { stopped: false, reason: 'NOT_STARTED' }; const r = stage1.closeSession(sessionId); started = false; return { stopped: r.closed === true, sessionId, paperOnly: true }; };
  return Object.freeze({ getActivities: () => [...STAGE2_ACTIVITIES], getSafety: () => ({ ...SAFETY }), assertSafety, start, heartbeatTick, observe, evaluateSignal, enter, exit, injectInterruption, recover, snapshot, stop });
}
console.log('AI TRADE PRO — Stage 2 real-time paper qualification engine loaded (PAPER_ONLY)');
