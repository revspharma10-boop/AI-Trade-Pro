// AI TRADE PRO — PAPER TRADING SESSION MANAGER
// Session lifecycle/metrics only. No broker or live-order capability.

export function createPaperTradingSessionManager(options = {}) {
  let session = null;
  const now = () => new Date().toISOString();
  const clone = () => ({ ...session, trades: [...session.trades], riskEvents: [...session.riskEvents], lastSignal: session.lastSignal ? { ...session.lastSignal } : null });
  function requireOpenSession() { if (!session || session.status !== 'OPEN') throw new Error('SESSION_NOT_OPEN'); }
  function start({ initialCapital = 0, sessionId } = {}) {
    if (session?.status === 'OPEN') return clone();
    const capital = Number(initialCapital);
    if (!Number.isFinite(capital) || capital < 0) throw new Error('INVALID_INITIAL_CAPITAL');
    session = { sessionId: sessionId || `PAPER-SESSION-${Date.now()}`, status: 'OPEN', startedAt: now(), endedAt: null, initialCapital: capital, endingCapital: capital, trades: [], riskEvents: [], signalCount: 0, realizedPnL: 0, unrealizedPnL: 0, peakEquity: capital, maxDrawdown: 0, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false };
    return clone();
  }
  function recordSignal(signal = {}) { requireOpenSession(); session.signalCount += 1; session.lastSignal = { ...signal, paperOnly: true, realOrderPlaced: false }; return session.signalCount; }
  function updateDrawdown() { const equity = session.initialCapital + session.realizedPnL + session.unrealizedPnL; session.peakEquity = Math.max(session.peakEquity, equity); session.maxDrawdown = Math.max(session.maxDrawdown, session.peakEquity - equity); return equity; }
  function recordTrade(trade = {}) { requireOpenSession(); const pnl = Number(trade.realizedPnL || 0); if (!Number.isFinite(pnl)) throw new Error('INVALID_REALIZED_PNL'); const record = { ...trade, realizedPnL: pnl, paperOnly: true, realOrderPlaced: false }; session.trades.push(record); session.realizedPnL += pnl; session.endingCapital = session.initialCapital + session.realizedPnL; updateDrawdown(); return { ...record }; }
  function recordRiskEvent(event = {}) { requireOpenSession(); session.riskEvents.push({ ...event, timestamp: event.timestamp || now(), paperOnly: true, realOrderPlaced: false }); return clone(); }
  function updateUnrealizedPnL(value = 0) { requireOpenSession(); session.unrealizedPnL = Number(value); if (!Number.isFinite(session.unrealizedPnL)) throw new Error('INVALID_UNREALIZED_PNL'); return updateDrawdown(); }
  function close() { if (!session) throw new Error('SESSION_NOT_STARTED'); if (session.status === 'CLOSED') return clone(); session.status = 'CLOSED'; session.endedAt = now(); session.endingCapital = session.initialCapital + session.realizedPnL; return clone(); }
  function snapshot() { return session ? clone() : { status: 'NOT_STARTED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false }; }
  return Object.freeze({ start, recordSignal, recordTrade, recordRiskEvent, updateUnrealizedPnL, close, snapshot });
}

export function assertPaperTradingSessionSafe(snapshot) {
  return Boolean(snapshot && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false && (!snapshot.trades || snapshot.trades.every(t => t.paperOnly === true && t.realOrderPlaced === false)) && (!snapshot.riskEvents || snapshot.riskEvents.every(r => r.paperOnly === true && r.realOrderPlaced === false)));
}

console.log('AI TRADE PRO — paper trading session manager loaded');
