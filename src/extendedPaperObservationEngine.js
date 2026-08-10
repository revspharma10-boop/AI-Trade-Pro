// AI TRADE PRO — EXTENDED PAPER TRADING / MARKET OBSERVATION
// Observation and session accounting only. No broker/live order capability.

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const pct = (a,b) => b > 0 ? (a / b) * 100 : 0;

export function createExtendedPaperObservation(options = {}) {
  const state = {
    startedAt: null, lastTickAt: null, ticks: 0, signals: 0, acceptedSignals: 0,
    rejectedSignals: 0, paperExecutions: 0, exits: 0, wins: 0, losses: 0,
    realizedPnL: 0, peakEquity: n(options.initialCapital), maxDrawdown: 0,
    dataErrors: 0, staleTicks: 0, riskBlocks: 0, duplicateSignals: 0,
    events: []
  };

  const event = (type, payload = {}) => {
    state.events.push({ type, at: new Date().toISOString(), ...payload, paperOnly: true });
    if (state.events.length > 1000) state.events.shift();
  };

  function start(initialCapital = options.initialCapital ?? 100000) {
    state.startedAt = new Date().toISOString(); state.peakEquity = n(initialCapital);
    event('OBSERVATION_STARTED', { initialCapital: n(initialCapital) });
    return snapshot();
  }
  function recordMarketTick(tick = {}) {
    state.ticks++; state.lastTickAt = new Date().toISOString();
    if (!tick.symbol || n(tick.price) <= 0) state.dataErrors++;
    if (tick.stale === true) state.staleTicks++;
    event('MARKET_TICK', { symbol: tick.symbol, price: n(tick.price), stale: tick.stale === true });
  }
  function recordSignal(signal = {}) {
    state.signals++;
    if (signal.duplicate) state.duplicateSignals++;
    if (signal.riskPassed === false || signal.accepted === false) { state.rejectedSignals++; if (signal.riskPassed === false) state.riskBlocks++; }
    else state.acceptedSignals++;
    event('SIGNAL', { symbol: signal.symbol, action: signal.action, score: n(signal.score), accepted: signal.accepted !== false && signal.riskPassed !== false });
  }
  function recordPaperExecution(order = {}) { state.paperExecutions++; event('PAPER_EXECUTION', { symbol: order.symbol, action: order.action, quantity: n(order.quantity), price: n(order.price) }); }
  function recordExit(trade = {}) { const pnl = n(trade.pnl); state.exits++; state.realizedPnL += pnl; if (pnl > 0) state.wins++; else if (pnl < 0) state.losses++; event('PAPER_EXIT', { symbol: trade.symbol, pnl }); }
  function updateEquity(equity) { const e = n(equity); state.peakEquity = Math.max(state.peakEquity, e); const dd = state.peakEquity > 0 ? pct(state.peakEquity - e, state.peakEquity) : 0; state.maxDrawdown = Math.max(state.maxDrawdown, dd); }
  function snapshot() {
    const winRate = state.exits ? pct(state.wins, state.exits) : 0;
    return Object.freeze({ ...state, events: state.events.slice(-100), winRate, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, observationStatus: state.startedAt ? 'ACTIVE' : 'NOT_STARTED' });
  }
  function stop() { event('OBSERVATION_STOPPED'); return snapshot(); }
  return Object.freeze({ start, recordMarketTick, recordSignal, recordPaperExecution, recordExit, updateEquity, snapshot, stop });
}

export function assertExtendedPaperSafety(snapshot) { return Boolean(snapshot?.paperOnly === true && snapshot?.realOrderPlaced === false && snapshot?.productionRealTradingEnabled === false); }

console.log('AI TRADE PRO — extended paper observation engine loaded');
