/* AI TRADE PRO — STAGE 1 EXTENDED PAPER-MARKET OPERATION
 * Real-market observation adapter + paper-only session orchestration.
 * This module never places broker/live orders.
 */
import { createPhase61to65Engine } from './phase61to65IntegrationEngine.js';

const SAFETY = Object.freeze({
  PAPER_ONLY: true,
  REAL_ORDER_PLACED: false,
  PRODUCTION_REAL_TRADING_ENABLED: false
});

const STAGE = Object.freeze({
  id: 1,
  name: 'Extended Paper Trading / Real-Market Observation',
  mode: 'PAPER_ONLY',
  liveOrderCapability: false
});

function clone(v) { return JSON.parse(JSON.stringify(v)); }

export function createStage1ExtendedPaperTradingEngine(options = {}) {
  const qualification = createPhase61to65Engine();
  const sessions = new Map();
  const journal = [];
  const quality = { accepted: 0, rejected: 0, stale: 0, invalid: 0, outOfOrder: 0, duplicate: 0, sourceInterrupted: 0 };
  const signals = { total: 0, accepted: 0, rejected: 0, BUY: 0, SELL: 0, HOLD: 0 };
  const trades = [];
  const positions = new Map();
  const source = { connected: false, lastTickAt: null, lastTimestamp: null, lastPrice: null, symbol: null, status: 'DISCONNECTED' };

  const assertSafety = () => {
    if (SAFETY.PAPER_ONLY !== true || SAFETY.REAL_ORDER_PLACED !== false || SAFETY.PRODUCTION_REAL_TRADING_ENABLED !== false) {
      throw new Error('STAGE_1_SAFETY_VIOLATION');
    }
    qualification.assertPaper();
    return true;
  };

  const connectMarketSource = ({ name = 'PAPER_MARKET_SOURCE', symbol = null } = {}) => {
    assertSafety();
    source.connected = true; source.status = 'CONNECTED'; source.symbol = symbol;
    journal.push({ type: 'SOURCE_CONNECTED', name, symbol, at: Date.now(), paperOnly: true });
    return { connected: true, name, symbol, mode: 'PAPER_ONLY' };
  };

  const disconnectMarketSource = (reason = 'MANUAL') => {
    assertSafety(); source.connected = false; source.status = 'DISCONNECTED';
    journal.push({ type: 'SOURCE_DISCONNECTED', reason, at: Date.now(), paperOnly: true });
    return { connected: false, reason, safe: true };
  };

  const startSession = (id = `STAGE1-${Date.now()}`, config = {}) => {
    assertSafety();
    if (sessions.has(id)) return { started: false, reason: 'SESSION_EXISTS' };
    const session = qualification.startPaperSession(id);
    const record = { ...session, config: { staleAfterMs: config.staleAfterMs ?? 30000, maxTicks: config.maxTicks ?? Infinity }, source: 'REAL_MARKET_OBSERVATION', mode: 'PAPER_ONLY', tickCount: 0, acceptedTicks: 0, rejectedTicks: 0, signalCount: 0, paperFills: 0, realizedPnl: 0, status: 'RUNNING', startedAt: Date.now() };
    sessions.set(id, record);
    return clone(record);
  };

  const ingestTick = (sessionId, tick = {}) => {
    assertSafety();
    const s = sessions.get(sessionId);
    if (!s || s.status !== 'RUNNING') return { accepted: false, reason: 'SESSION_NOT_RUNNING' };
    const timestamp = Number(tick.timestamp);
    const price = Number(tick.price);
    const volume = Number(tick.volume ?? 0);
    const now = Date.now();
    let rejection = null;

    // Classification order is intentional: an old tick is STALE even if it is
    // also earlier than the last accepted timestamp. This gives operators and
    // quality metrics the primary reason the observation is unsafe.
    if (!tick.symbol || !Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp > now + 1000 || !Number.isFinite(volume) || volume < 0) rejection = 'INVALID_TICK';
    else if (now - timestamp > s.config.staleAfterMs) rejection = 'STALE';
    else if (s.lastAcceptedTimestamp !== null && timestamp < s.lastAcceptedTimestamp) rejection = 'OUT_OF_ORDER';
    else if (s.lastAcceptedTimestamp === timestamp && s.lastAcceptedPrice === price) rejection = 'DUPLICATE';

    s.tickCount++;
    if (rejection) {
      s.rejectedTicks++; quality.rejected++;
      if (rejection === 'STALE') quality.stale++;
      if (rejection === 'INVALID_TICK') quality.invalid++;
      if (rejection === 'OUT_OF_ORDER') quality.outOfOrder++;
      if (rejection === 'DUPLICATE') quality.duplicate++;
      journal.push({ type: 'TICK_REJECTED', reason: rejection, symbol: tick.symbol, timestamp, at: now });
      return { accepted: false, reason: rejection };
    }

    const observed = qualification.recordObservation(sessionId, { ...tick, timestamp });
    if (!observed.accepted) { s.rejectedTicks++; quality.rejected++; return observed; }
    s.acceptedTicks++; quality.accepted++;
    s.lastAcceptedTimestamp = timestamp;
    s.lastAcceptedPrice = price;
    source.status = 'HEALTHY'; source.symbol = tick.symbol; source.lastTickAt = now; source.lastTimestamp = timestamp; source.lastPrice = price;
    journal.push({ type: 'TICK_ACCEPTED', symbol: tick.symbol, price, timestamp, at: now, paperOnly: true });
    return { accepted: true, symbol: tick.symbol, price, timestamp, mode: 'PAPER_ONLY' };
  };

  const ingestSignal = (sessionId, signal = {}) => {
    assertSafety();
    const s = sessions.get(sessionId);
    if (!s || s.status !== 'RUNNING') return { accepted: false, reason: 'SESSION_NOT_RUNNING' };
    const action = String(signal.action || 'HOLD').toUpperCase();
    signals.total++; signals[action] = (signals[action] || 0) + 1;
    const result = qualification.recordSignal(sessionId, signal);
    if (result.accepted) signals.accepted++; else signals.rejected++;
    s.signalCount++;
    journal.push({ type: 'SIGNAL', action, accepted: result.accepted === true, at: Date.now(), paperOnly: true });
    return { accepted: result.accepted === true, action, mode: 'PAPER_ONLY' };
  };

  const simulatePaperEntry = (sessionId, { id = `P-${Date.now()}`, symbol, side, quantity, price } = {}) => {
    assertSafety();
    const s = sessions.get(sessionId);
    if (!s || s.status !== 'RUNNING') return { executed: false, reason: 'SESSION_NOT_RUNNING' };
    const q = Number(quantity), p = Number(price);
    if (!symbol || !['BUY','SELL'].includes(side) || !(q > 0) || !(p > 0)) return { executed: false, reason: 'INVALID_INTENT' };
    const fill = { id, symbol, side, quantity: q, entryPrice: p, fillPrice: p, slippageBps: 0, mode: 'PAPER_ONLY', executedAt: Date.now() };
    positions.set(id, fill); s.paperFills++; journal.push({ type: 'PAPER_ENTRY', ...fill });
    return { executed: true, fill: clone(fill), realOrderPlaced: false };
  };

  const simulatePaperExit = (sessionId, id, exitPrice) => {
    assertSafety();
    const s = sessions.get(sessionId); const pos = positions.get(id);
    if (!s || !pos) return { closed: false, reason: 'POSITION_NOT_FOUND' };
    const px = Number(exitPrice); if (!(px > 0)) return { closed: false, reason: 'INVALID_EXIT_PRICE' };
    const direction = pos.side === 'BUY' ? 1 : -1;
    const pnl = (px - pos.entryPrice) * pos.quantity * direction;
    const trade = { id, symbol: pos.symbol, side: pos.side, quantity: pos.quantity, entryPrice: pos.entryPrice, exitPrice: px, pnl, mode: 'PAPER_ONLY' };
    trades.push(trade); s.realizedPnl += pnl; positions.delete(id); journal.push({ type: 'PAPER_EXIT', ...trade });
    return { closed: true, trade: clone(trade), realOrderPlaced: false };
  };

  const getSnapshot = () => {
    assertSafety();
    const pnls = trades.map(t => t.pnl);
    const wins = pnls.filter(x => x > 0).length;
    const grossWin = pnls.filter(x => x > 0).reduce((a,b)=>a+b,0);
    const grossLoss = Math.abs(pnls.filter(x => x < 0).reduce((a,b)=>a+b,0));
    const realizedTotal = pnls.reduce((a,b)=>a+b,0);
    const journalCount = journal.length;

    return clone({
      stage: STAGE,
      safety: SAFETY,
      source,
      // top-level convenience fields for callers that expect flattened snapshot
      realizedPnl: realizedTotal,
      journalCount,
      paper: {
        quality,
        signals,
        trades: trades.length,
        openPositions: positions.size,
        realizedPnl: realizedTotal,
        journalCount,
        winCount: wins,
        grossWin,
        grossLoss
      }
    });
  };

  const closeSession = (id) => { assertSafety(); const result = qualification.closePaperSession(id); const s = sessions.get(id); if (s && result.closed) { s.status='COMPLETED'; s.endedAt=Date.now(); } return result; };

  return Object.freeze({
    getStage: () => clone(STAGE), getSafety: () => clone(SAFETY), assertSafety,
    connectMarketSource, disconnectMarketSource, startSession, ingestTick, ingestSignal,
    simulatePaperEntry, simulatePaperExit, closeSession, getSnapshot,
    getJournal: () => clone(journal), getTrades: () => clone(trades), getSessions: () => clone([...sessions.values()])
  });
}

console.log('AI TRADE PRO — Stage 1 extended paper trading engine loaded (PAPER_ONLY)');
