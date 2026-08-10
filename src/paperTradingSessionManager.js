// AI TRADE PRO — PAPER TRADING SESSION MANAGER
// Session lifecycle/metrics only. No broker or live-order capability.

export function createPaperTradingSessionManager(options = {}) {
  let session = null;
  const now = () => new Date().toISOString();

  function start({ initialCapital = 0, sessionId } = {}) {
    if (session?.status === 'OPEN') return { ...session };
    const capital = Number(initialCapital);
    if (!Number.isFinite(capital) || capital < 0) throw new Error('INVALID_INITIAL_CAPITAL');
    session = {
      sessionId: sessionId || `PAPER-SESSION-${Date.now()}`,
      status: 'OPEN', startedAt: now(), endedAt: null,
      initialCapital: capital, endingCapital: capital,
      trades: [], riskEvents: [], signalCount: 0,
      realizedPnL: 0, unrealizedPnL: 0, peakEquity: capital,
      maxDrawdown: 0, paperOnly: true, realOrderPlaced: false,
      productionRealTradingEnabled: false
    };
    return { ...session };
  }

  function recordSignal(signal = {}) {
    if (!session?.status === 'OPEN') throw new Error('SESSION_NOT_OPEN');
    if (!session) throw new Error('SESSION_NOT_OPEN');
    session.signalCount += 1;
    return session.signalCount;
  }

  function recordTrade(trade = {}) {
    if (!session || session.status !== 'OPEN') throw new Error('SESSION_NOT_OPEN');
    const pnl = Number(trade.realizedPnL || 0);
    session.trades.push({ ...trade, realizedPnL: pnl, paperOnly: true, realOrderPlaced: false });
    session.realizedPnL += pnl;
    session.endingCapital = session.initialCapital + session.realizedPnL;
    const equity = session.endingCapital + Number(session.unrealizedPnL || 0);
    session.peakEquity = Math.max(session.peakEquity, equity);
    session.maxDrawdown = Math.max(session.maxDrawdown, session.peakEquity - equity);
    return { ...session.trades.at(-1) };
  }

  function recordRiskEvent(event = {}) {
    if (!session || session.status !== 'OPEN') throw new Error('SESSION_NOT_OPEN');
    session.riskEvents.push({ ...event, timestamp: event.timestamp || now(), paperOnly: true });
  }

  function updateUnrealizedPnL(value = 0) {
    if (!session || session.status !== 'OPEN') throw new Error('SESSION_NOT_OPEN');
    session.unrealizedPnL = Number(value) || 0;
    const equity = session.initialCapital + session.realizedPnL + session.unrealizedPnL;
    session.peakEquity = Math.max(session.peakEquity, equity);
    session.maxDrawdown = Math.max(session.maxDrawdown, session.peakEquity - equity);
    return equity;
  }

  function close() {
    if (!session) throw new Error('SESSION_NOT_STARTED');
    session.status = 'CLOSED'; session.endedAt = now();
    session.endingCapital = session.initialCapital + session.realizedPnL;
    return { ...session, trades: [...session.trades], riskEvents: [...session.riskEvents] };
  }

  function snapshot() {
    if (!session) return { status: 'NOT_STARTED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false };
    return { ...session, trades: [...session.trades], riskEvents: [...session.riskEvents] };
  }

  return Object.freeze({ start, recordSignal, recordTrade, recordRiskEvent, updateUnrealizedPnL, close, snapshot });
}

export function assertPaperTradingSessionSafe(snapshot) {
  return Boolean(snapshot && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false && (!snapshot.trades || snapshot.trades.every(t => t.paperOnly === true && t.realOrderPlaced === false)) && (!snapshot.riskEvents || snapshot.riskEvents.every(r => r.paperOnly === true)));
}

console.log('AI TRADE PRO — paper trading session manager loaded');
