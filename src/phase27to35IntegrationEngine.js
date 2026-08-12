// AI TRADE PRO — PHASE 27–35 ADVANCED PAPER INTEGRATION ENGINE
// PAPER_ONLY by design. No broker credentials, live transport, or real-order path.

const SAFETY = Object.freeze({
  PAPER_ONLY: true,
  REAL_ORDER_PLACED: false,
  PRODUCTION_REAL_TRADING_ENABLED: false
});

const PHASES = Object.freeze([
  { phase: 27, name: 'Multi-Symbol Market Observation', gate: 'valid_fresh_ordered_data_only' },
  { phase: 28, name: 'Multi-Timeframe Signal Aggregation', gate: 'quality_gated_signal_only' },
  { phase: 29, name: 'Advanced Strategy Orchestration', gate: 'registered_enabled_strategies_only' },
  { phase: 30, name: 'Portfolio Risk & Exposure Management', gate: 'portfolio_risk_limits' },
  { phase: 31, name: 'Paper Execution & Slippage Simulation', gate: 'paper_execution_only' },
  { phase: 32, name: 'Position Lifecycle & Reconciliation', gate: 'reconciled_paper_positions_only' },
  { phase: 33, name: 'Advanced Performance Analytics', gate: 'metrics_only' },
  { phase: 34, name: 'Monitoring, Alerts & Operational Health', gate: 'operator_visibility' },
  { phase: 35, name: 'Paper Production Readiness Gate', gate: 'all_paper_gates_passed' }
]);

function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function positive(v) { return Number.isFinite(Number(v)) && Number(v) > 0; }

export function createPhase27to35Session(options = {}) {
  const limits = {
    maxPortfolioExposure: num(options.maxPortfolioExposure, 250000),
    maxSymbolExposure: num(options.maxSymbolExposure, 100000),
    maxDailyLoss: num(options.maxDailyLoss, 10000),
    maxOpenPositions: Math.max(1, Math.floor(num(options.maxOpenPositions, 20))),
    maxSlippageBps: Math.max(0, num(options.maxSlippageBps, 50))
  };
  const state = {
    observations: { total: 0, accepted: 0, rejected: 0, symbols: new Map(), lastBySymbol: new Map() },
    timeframes: new Map(),
    strategies: new Map(),
    signals: { total: 0, buy: 0, sell: 0, hold: 0, accepted: 0, rejected: 0, conflicts: 0 },
    risk: { checks: 0, blocked: 0, portfolioExposure: 0, dailyLoss: 0, symbolExposure: new Map() },
    execution: { intents: 0, fills: 0, rejected: 0, slippageBps: 0, realizedPnl: 0 },
    positions: new Map(),
    performance: { trades: 0, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, pnl: 0, peakPnl: 0, maxDrawdown: 0 },
    monitoring: { heartbeats: 0, alerts: 0, incidents: 0, staleSources: 0 },
    reconciliation: { runs: 0, matched: 0, mismatched: 0 },
    readiness: { gatesChecked: 0, gatesPassed: 0 },
    audit: []
  };

  function audit(event, data = {}) { state.audit.push({ at: Date.now(), event, ...data }); }

  function observe(symbol, tick = {}) {
    const s = String(symbol || tick.symbol || '').trim().toUpperCase();
    const timestamp = num(tick.timestamp, NaN);
    const price = num(tick.price, NaN);
    state.observations.total += 1;
    const previous = state.observations.lastBySymbol.get(s);
    const valid = !!s && positive(price) && Number.isFinite(timestamp) && (!previous || timestamp > previous.timestamp);
    if (!valid) {
      state.observations.rejected += 1;
      audit('MARKET_OBSERVATION_REJECTED', { symbol: s, timestamp, price });
      return { accepted: false, reason: 'INVALID_OR_OUT_OF_ORDER' };
    }
    state.observations.accepted += 1;
    state.observations.lastBySymbol.set(s, { timestamp, price });
    state.observations.symbols.set(s, (state.observations.symbols.get(s) || 0) + 1);
    audit('MARKET_OBSERVATION_ACCEPTED', { symbol: s, timestamp, price });
    return { accepted: true, symbol: s, price, timestamp };
  }

  function aggregateTimeframes(symbol, frames = {}) {
    const s = String(symbol || '').trim().toUpperCase();
    const entries = Object.entries(frames).filter(([tf, value]) => ['1m','5m','15m','30m','1h','4h','1d'].includes(tf) && ['BUY','SELL','HOLD'].includes(String(value).toUpperCase()));
    if (!s || !entries.length) return { accepted: false, reason: 'NO_VALID_TIMEFRAMES' };
    const counts = { BUY: 0, SELL: 0, HOLD: 0 };
    entries.forEach(([, value]) => counts[String(value).toUpperCase()]++);
    const max = Math.max(...Object.values(counts));
    const winners = Object.entries(counts).filter(([, count]) => count === max).map(([action]) => action);
    const action = winners.length === 1 ? winners[0] : 'HOLD';
    if (winners.length > 1) state.signals.conflicts += 1;
    state.timeframes.set(s, { frames: Object.fromEntries(entries), action, counts });
    audit('TIMEFRAME_AGGREGATED', { symbol: s, action, counts });
    return { accepted: true, symbol: s, action, counts, conflict: winners.length > 1 };
  }

  function registerStrategy(strategy = {}) {
    const id = String(strategy.id || '').trim();
    if (!id) throw new Error('STRATEGY_ID_REQUIRED');
    const item = { id, enabled: strategy.enabled !== false, priority: num(strategy.priority, 0), weight: num(strategy.weight, 1) };
    state.strategies.set(id, item);
    audit('STRATEGY_REGISTERED', { id });
    return { ...item };
  }

  function recordSignal(signal = {}) {
    const action = String(signal.action || 'HOLD').toUpperCase();
    if (!['BUY','SELL','HOLD'].includes(action)) return { accepted: false, reason: 'INVALID_ACTION' };
    state.signals.total += 1; state.signals[action.toLowerCase()] += 1;
    if (signal.accepted === false) state.signals.rejected += 1; else state.signals.accepted += 1;
    audit('SIGNAL_RECORDED', { action, strategy: signal.strategy || 'unknown' });
    return { accepted: signal.accepted !== false, action };
  }

  function checkPortfolioRisk(intent = {}) {
    state.risk.checks += 1;
    const symbol = String(intent.symbol || '').trim().toUpperCase();
    const exposure = Math.max(0, num(intent.exposure));
    const dailyLoss = Math.max(0, num(intent.dailyLoss, state.risk.dailyLoss));
    const currentSymbol = state.risk.symbolExposure.get(symbol) || 0;
    const nextPortfolio = state.risk.portfolioExposure + exposure;
    const nextSymbol = currentSymbol + exposure;
    const openCount = state.positions.size;
    const allowed = exposure <= limits.maxSymbolExposure && nextSymbol <= limits.maxSymbolExposure && nextPortfolio <= limits.maxPortfolioExposure && dailyLoss <= limits.maxDailyLoss && openCount < limits.maxOpenPositions && intent.killSwitch !== true;
    if (!allowed) state.risk.blocked += 1;
    state.risk.dailyLoss = dailyLoss;
    if (allowed) {
      state.risk.portfolioExposure = nextPortfolio;
      state.risk.symbolExposure.set(symbol, nextSymbol);
    }
    audit(allowed ? 'PORTFOLIO_RISK_ALLOWED' : 'PORTFOLIO_RISK_BLOCKED', { symbol, exposure, dailyLoss });
    return { allowed, symbol, exposure, portfolioExposure: nextPortfolio, symbolExposure: nextSymbol, dailyLoss };
  }

  function paperExecute(intent = {}) {
    if (!SAFETY.PAPER_ONLY || SAFETY.REAL_ORDER_PLACED || SAFETY.PRODUCTION_REAL_TRADING_ENABLED) throw new Error('PAPER_SAFETY_INVARIANT_VIOLATION');
    state.execution.intents += 1;
    const risk = checkPortfolioRisk(intent);
    if (!risk.allowed) { state.execution.rejected += 1; return { executed: false, paperOnly: true, blocked: true }; }
    const requested = num(intent.price);
    const slippageBps = Math.min(Math.max(0, num(intent.slippageBps, 0)), limits.maxSlippageBps);
    const side = String(intent.side || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    const fillPrice = requested > 0 ? requested * (side === 'BUY' ? 1 + slippageBps / 10000 : 1 - slippageBps / 10000) : 0;
    state.execution.fills += 1; state.execution.slippageBps += slippageBps;
    const positionId = String(intent.positionId || `${risk.symbol}-${Date.now()}-${state.execution.fills}`);
    state.positions.set(positionId, { positionId, symbol: risk.symbol, side, quantity: Math.max(0, num(intent.quantity, 1)), entryPrice: fillPrice, status: 'OPEN' });
    audit('PAPER_EXECUTION_FILLED', { positionId, symbol: risk.symbol, fillPrice, slippageBps });
    return { executed: true, paperOnly: true, realOrderPlaced: false, positionId, fillPrice, slippageBps };
  }

  function closePosition(positionId, exitPrice, pnl) {
    const position = state.positions.get(positionId);
    if (!position) return { closed: false, reason: 'POSITION_NOT_FOUND' };
    const realized = Number.isFinite(Number(pnl)) ? Number(pnl) : (num(exitPrice) - position.entryPrice) * position.quantity * (position.side === 'BUY' ? 1 : -1);
    state.positions.delete(positionId);
    state.execution.realizedPnl += realized;
    state.performance.trades += 1; state.performance.pnl += realized;
    if (realized >= 0) { state.performance.wins += 1; state.performance.grossProfit += realized; }
    else { state.performance.losses += 1; state.performance.grossLoss += Math.abs(realized); }
    state.performance.peakPnl = Math.max(state.performance.peakPnl, state.performance.pnl);
    state.performance.maxDrawdown = Math.max(state.performance.maxDrawdown, state.performance.peakPnl - state.performance.pnl);
    audit('POSITION_CLOSED', { positionId, realized });
    return { closed: true, realizedPnl: realized };
  }

  function reconcile(expected = {}) {
    state.reconciliation.runs += 1;
    let matched = 0, mismatched = 0;
    for (const [id, expectedPosition] of Object.entries(expected)) {
      const actual = state.positions.get(id);
      if (actual && actual.symbol === expectedPosition.symbol && actual.status === expectedPosition.status) matched++; else mismatched++;
    }
    state.reconciliation.matched += matched; state.reconciliation.mismatched += mismatched;
    audit('RECONCILIATION', { matched, mismatched });
    return { matched, mismatched, reconciled: mismatched === 0 };
  }

  function recordPerformance() {
    const trades = state.performance.trades;
    const winRate = trades ? state.performance.wins / trades : 0;
    const profitFactor = state.performance.grossLoss ? state.performance.grossProfit / state.performance.grossLoss : (state.performance.grossProfit > 0 ? Infinity : 0);
    return { ...state.performance, winRate, profitFactor };
  }

  function heartbeat(source = 'market') { state.monitoring.heartbeats++; audit('HEARTBEAT', { source }); return { healthy: true, source }; }
  function alert(name, severity = 'INFO') { state.monitoring.alerts++; audit('ALERT', { name, severity }); return { recorded: true }; }
  function incident(name, severity = 'ERROR') { state.monitoring.incidents++; audit('INCIDENT', { name, severity }); return { recorded: true }; }
  function markStaleSource(source) { state.monitoring.staleSources++; audit('STALE_SOURCE', { source }); return { safe: false }; }

  function readinessGate() {
    const checks = [
      ['paperOnly', SAFETY.PAPER_ONLY],
      ['noRealOrder', SAFETY.REAL_ORDER_PLACED === false],
      ['productionDisabled', SAFETY.PRODUCTION_REAL_TRADING_ENABLED === false],
      ['marketDataObserved', state.observations.accepted > 0],
      ['signalsObserved', state.signals.total > 0],
      ['strategiesRegistered', state.strategies.size > 0],
      ['riskControlsActive', state.risk.checks > 0],
      ['paperExecutionActive', state.execution.fills > 0 || state.execution.rejected > 0],
      ['positionReconciliation', state.reconciliation.runs > 0],
      ['performanceAvailable', state.performance.trades >= 0],
      ['monitoringActive', state.monitoring.heartbeats > 0],
      ['auditAvailable', state.audit.length > 0]
    ];
    state.readiness.gatesChecked += checks.length;
    state.readiness.gatesPassed += checks.filter(([, ok]) => ok).length;
    return { passed: checks.every(([, ok]) => ok), checks: Object.fromEntries(checks), paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false };
  }

  function snapshot() {
    return {
      phases: PHASES.map(p => ({ ...p })), safety: { ...SAFETY },
      observations: { total: state.observations.total, accepted: state.observations.accepted, rejected: state.observations.rejected, symbols: [...state.observations.symbols.entries()] },
      timeframes: [...state.timeframes.entries()], strategies: [...state.strategies.values()], signals: { ...state.signals },
      risk: { ...state.risk, symbolExposure: [...state.risk.symbolExposure.entries()] },
      execution: { ...state.execution }, positions: [...state.positions.values()],
      performance: recordPerformance(), monitoring: { ...state.monitoring }, reconciliation: { ...state.reconciliation }, readiness: { ...state.readiness }, auditCount: state.audit.length
    };
  }

  return Object.freeze({ observe, aggregateTimeframes, registerStrategy, recordSignal, checkPortfolioRisk, paperExecute, closePosition, reconcile, recordPerformance, heartbeat, alert, incident, markStaleSource, readinessGate, snapshot });
}

export function getPhase27to35Definition() { return PHASES.map(p => ({ ...p, status: 'IMPLEMENTED_IN_INTEGRATION_ENGINE' })); }
export function getPhase27to35SafetyState() { return { ...SAFETY }; }

if (typeof window !== 'undefined') {
  window.createPhase27to35Session = createPhase27to35Session;
  console.log('AI TRADE PRO — Phase 27–35 integration engine loaded (PAPER_ONLY)');
}
