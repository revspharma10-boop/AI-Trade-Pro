// ============================================================
// AI TRADE PRO — STRATEGY PORTFOLIO ENGINE
// STEP 2AK–2AP
// ============================================================
// Paper-only orchestration layer for multiple strategies.
// Handles registration, signal ranking, exposure limits, daily
// loss limits, cooldowns and paper-order staging.
// NO BROKER API. NO REAL ORDER PATH.
// ============================================================

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, n(value)));
}

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

export function createStrategyPortfolio({
  capital = 100000,
  maxOpenPositions = 5,
  maxCapitalUtilizationPercent = 60,
  maxDailyLossPercent = 2,
  cooldownBars = 0
} = {}) {
  const c = n(capital);
  return {
    valid: c > 0,
    paperOnly: true,
    realOrderPlaced: false,
    capital: c > 0 ? c : 0,
    maxOpenPositions: Math.max(1, Math.floor(n(maxOpenPositions, 5))),
    maxCapitalUtilizationPercent: clamp(maxCapitalUtilizationPercent, 1, 100),
    maxDailyLossPercent: clamp(maxDailyLossPercent, 0.1, 100),
    cooldownBars: Math.max(0, Math.floor(n(cooldownBars))),
    strategies: [],
    positions: [],
    stagedOrders: [],
    journal: [],
    dailyRealizedPnL: 0,
    barIndex: 0,
    lastEntryBarBySymbol: {}
  };
}

export function registerStrategy(portfolio, strategy = {}) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return { valid: false, added: false, reason: 'PAPER_ONLY_REQUIRED' };
  }
  const id = String(strategy.id || '').trim();
  const name = String(strategy.name || id).trim();
  if (!id || !name) return { valid: false, added: false, reason: 'INVALID_STRATEGY' };
  if (portfolio.strategies.some(s => s.id === id)) {
    return { valid: true, added: false, duplicate: true, strategy: portfolio.strategies.find(s => s.id === id) };
  }
  const record = {
    id,
    name,
    version: String(strategy.version || '1.0.0'),
    enabled: strategy.enabled !== false,
    priority: n(strategy.priority, 50),
    paperOnly: true
  };
  portfolio.strategies.push(record);
  return { valid: true, added: true, duplicate: false, strategy: record };
}

export function advancePortfolioBar(portfolio) {
  if (!portfolio) return null;
  portfolio.barIndex += 1;
  return portfolio.barIndex;
}

function exposure(portfolio) {
  return portfolio.positions.reduce((sum, p) => sum + n(p.capitalUsed), 0);
}

function dailyLossExceeded(portfolio) {
  const limit = portfolio.capital * portfolio.maxDailyLossPercent / 100;
  return portfolio.dailyRealizedPnL <= -limit;
}

export function validatePortfolioRisk(portfolio, signal = {}) {
  if (!portfolio || portfolio.paperOnly !== true) return { allowed: false, reason: 'PAPER_ONLY_REQUIRED' };
  if (portfolio.realOrderPlaced) return { allowed: false, reason: 'REAL_ORDER_STATE_INVALID' };
  if (portfolio.positions.length >= portfolio.maxOpenPositions) return { allowed: false, reason: 'MAX_OPEN_POSITIONS' };
  if (dailyLossExceeded(portfolio)) return { allowed: false, reason: 'DAILY_LOSS_LIMIT' };

  const symbol = normalizeSymbol(signal.symbol);
  if (!symbol) return { allowed: false, reason: 'INVALID_SYMBOL' };
  const alreadyOpen = portfolio.positions.some(p => p.symbol === symbol);
  if (alreadyOpen) return { allowed: false, reason: 'SYMBOL_ALREADY_OPEN' };

  const capitalUsed = n(signal.capitalUsed);
  const projected = exposure(portfolio) + Math.max(0, capitalUsed);
  const maxExposure = portfolio.capital * portfolio.maxCapitalUtilizationPercent / 100;
  if (projected > maxExposure) return { allowed: false, reason: 'CAPITAL_UTILIZATION_LIMIT' };

  const lastBar = portfolio.lastEntryBarBySymbol[symbol];
  if (lastBar != null && portfolio.barIndex - lastBar <= portfolio.cooldownBars) {
    return { allowed: false, reason: 'COOLDOWN_ACTIVE' };
  }
  return { allowed: true, reason: '' };
}

export function rankSignals(signals = []) {
  return (Array.isArray(signals) ? signals : [])
    .filter(s => s && typeof s === 'object')
    .map((s, index) => ({ ...s, symbol: normalizeSymbol(s.symbol), _index: index }))
    .filter(s => s.symbol && ['BUY', 'SELL'].includes(String(s.decision || '').toUpperCase()))
    .sort((a, b) => {
      const scoreDelta = n(b.opportunityScore) - n(a.opportunityScore);
      if (scoreDelta !== 0) return scoreDelta;
      return n(b.priority, 50) - n(a.priority, 50);
    });
}

export function stagePaperOrder(portfolio, signal = {}) {
  const risk = validatePortfolioRisk(portfolio, signal);
  if (!risk.allowed) {
    return {
      valid: false,
      authorized: false,
      orderStatus: 'BLOCKED',
      reason: risk.reason,
      paperOnly: true,
      realOrderPlaced: false
    };
  }

  const symbol = normalizeSymbol(signal.symbol);
  const decision = String(signal.decision || '').toUpperCase();
  const action = decision === 'BUY' ? 'LONG' : 'SHORT';
  const order = {
    id: `PAPER-${portfolio.barIndex}-${portfolio.stagedOrders.length + 1}`,
    symbol,
    decision,
    action,
    quantity: Math.max(0, Math.floor(n(signal.quantity))),
    entry: n(signal.entry),
    stopLoss: n(signal.stopLoss),
    target: n(signal.target),
    capitalUsed: n(signal.capitalUsed),
    strategyId: String(signal.strategyId || ''),
    status: 'PAPER_ORDER_STAGED',
    paperOnly: true,
    realOrderPlaced: false,
    barIndex: portfolio.barIndex
  };

  portfolio.stagedOrders.push(order);
  portfolio.positions.push({ ...order, status: 'OPEN' });
  portfolio.lastEntryBarBySymbol[symbol] = portfolio.barIndex;
  return { valid: true, authorized: true, orderStatus: order.status, order, paperOnly: true, realOrderPlaced: false };
}

export function closePaperPosition(portfolio, { symbol, exitPrice, reason = 'MANUAL' } = {}) {
  const key = normalizeSymbol(symbol);
  const index = portfolio.positions.findIndex(p => p.symbol === key);
  if (index < 0) return { valid: false, closed: false, reason: 'POSITION_NOT_FOUND' };
  const position = portfolio.positions[index];
  const exit = n(exitPrice);
  if (exit <= 0 || position.entry <= 0) return { valid: false, closed: false, reason: 'INVALID_EXIT_PRICE' };
  const direction = position.action === 'SHORT' ? -1 : 1;
  const pnl = Number(((exit - position.entry) * position.quantity * direction).toFixed(2));
  portfolio.positions.splice(index, 1);
  portfolio.dailyRealizedPnL = Number((portfolio.dailyRealizedPnL + pnl).toFixed(2));
  const record = { ...position, exitPrice: exit, pnl, exitReason: reason, status: 'CLOSED', paperOnly: true, realOrderPlaced: false };
  portfolio.journal.push(record);
  return { valid: true, closed: true, pnl, record, paperOnly: true, realOrderPlaced: false };
}

export function processSignalBatch(portfolio, signals = []) {
  const ranked = rankSignals(signals);
  const results = [];
  for (const signal of ranked) results.push(stagePaperOrder(portfolio, signal));
  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    rankedCount: ranked.length,
    acceptedCount: results.filter(r => r.authorized).length,
    blockedCount: results.filter(r => !r.authorized).length,
    results
  };
}

export function getStrategyPortfolioSnapshot(portfolio) {
  const used = exposure(portfolio);
  const equity = portfolio.capital + portfolio.dailyRealizedPnL;
  return {
    valid: Boolean(portfolio),
    capital: n(portfolio?.capital),
    equity: Number(equity.toFixed(2)),
    dailyRealizedPnL: n(portfolio?.dailyRealizedPnL),
    openPositions: portfolio?.positions?.length || 0,
    stagedOrders: portfolio?.stagedOrders?.length || 0,
    journalTrades: portfolio?.journal?.length || 0,
    capitalUsed: Number(used.toFixed(2)),
    capitalUtilizationPercent: portfolio?.capital ? Number((used / portfolio.capital * 100).toFixed(2)) : 0,
    strategyCount: portfolio?.strategies?.length || 0,
    paperOnly: true,
    realOrderPlaced: false,
    safe: true
  };
}

export function resetDailyRisk(portfolio) {
  if (!portfolio) return { valid: false };
  portfolio.dailyRealizedPnL = 0;
  portfolio.barIndex = 0;
  portfolio.lastEntryBarBySymbol = {};
  return { valid: true, paperOnly: true, realOrderPlaced: false };
}

console.log('AI TRADE PRO — strategy portfolio engine loaded');
