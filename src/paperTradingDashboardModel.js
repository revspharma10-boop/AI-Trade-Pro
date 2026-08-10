// AI TRADE PRO — PAPER TRADING DASHBOARD MODEL
// Pure presentation model. No broker/network/order side effects.

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}
function pct(value) { return Number(n(value).toFixed(2)); }

export function buildPaperTradingDashboardModel(runtimeState = {}) {
  const snapshot = runtimeState.snapshot || runtimeState;
  const positions = Array.isArray(runtimeState.positions) ? runtimeState.positions : [];
  const orders = Array.isArray(runtimeState.orders) ? runtimeState.orders : [];
  const journal = Array.isArray(runtimeState.journal) ? runtimeState.journal : [];
  const winners = journal.filter(t => n(t.realizedPnL) > 0).length;
  const losers = journal.filter(t => n(t.realizedPnL) < 0).length;
  const breakeven = journal.filter(t => n(t.realizedPnL) === 0).length;
  const grossProfit = journal.reduce((s, t) => s + Math.max(0, n(t.realizedPnL)), 0);
  const grossLoss = journal.reduce((s, t) => s + Math.max(0, -n(t.realizedPnL)), 0);
  const netPnL = n(snapshot.realizedPnL);

  return {
    mode: 'PAPER',
    safety: {
      paperOnly: runtimeState.paperOnly === true,
      realOrderPlaced: runtimeState.realOrderPlaced === true,
      productionRealTradingEnabled: false,
      safe: runtimeState.paperOnly === true && runtimeState.realOrderPlaced === false
    },
    account: {
      initialCapital: n(snapshot.initialCapital), cash: n(snapshot.cash), equity: n(snapshot.equity),
      realizedPnL: n(snapshot.realizedPnL), unrealizedPnL: n(snapshot.unrealizedPnL),
      dailyRealizedPnL: n(snapshot.dailyRealizedPnL),
      returnPercent: snapshot.initialCapital > 0 ? pct(netPnL / n(snapshot.initialCapital) * 100) : 0
    },
    risk: {
      grossExposure: n(snapshot.grossExposure), capitalUtilizationPercent: pct(snapshot.capitalUtilizationPercent),
      dailyLossPercent: pct(snapshot.risk?.dailyLossPercent), safe: snapshot.risk?.safe === true,
      rejectionReasons: Array.isArray(snapshot.risk?.rejectionReasons) ? [...snapshot.risk.rejectionReasons] : []
    },
    positions: {
      open: positions.filter(p => p.status === 'OPEN').map(p => ({
        symbol: p.symbol, side: p.side, quantity: n(p.quantity), entryPrice: n(p.entryPrice),
        markPrice: n(p.markPrice ?? p.entryPrice), unrealizedPnL: n(p.unrealizedPnL), paperOnly: true
      })),
      openCount: positions.filter(p => p.status === 'OPEN').length,
      closedCount: positions.filter(p => p.status === 'CLOSED').length
    },
    orders: {
      queued: orders.filter(o => o.status === 'PAPER_QUEUED').length,
      filled: orders.filter(o => o.status === 'PAPER_FILLED').length,
      cancelled: orders.filter(o => o.status === 'PAPER_CANCELLED').length,
      rejected: orders.filter(o => o.status === 'PAPER_REJECTED').length
    },
    performance: {
      totalTrades: journal.length, winningTrades: winners, losingTrades: losers, breakevenTrades: breakeven,
      winRatePercent: journal.length ? pct(winners / journal.length * 100) : 0,
      grossProfit: n(grossProfit), grossLoss: n(grossLoss), netPnL,
      profitFactor: grossLoss > 0 ? pct(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0,
      expectancyPerTrade: journal.length ? pct(netPnL / journal.length) : 0
    },
    journal: journal.map(t => ({ ...t, paperOnly: true, realOrderPlaced: false }))
  };
}

export function assertDashboardModelSafe(model = {}) {
  return model.mode === 'PAPER' && model.safety?.paperOnly === true && model.safety?.realOrderPlaced === false &&
    model.safety?.productionRealTradingEnabled === false &&
    (model.journal || []).every(x => x.paperOnly === true && x.realOrderPlaced === false);
}

console.log('AI TRADE PRO — paper trading dashboard model loaded');
