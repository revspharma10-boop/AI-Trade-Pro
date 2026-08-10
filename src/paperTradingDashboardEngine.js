// AI TRADE PRO — PHASE 6: DASHBOARD / UI VIEW MODEL
// Framework-neutral view model for the paper trading control center.

export function buildPaperDashboardModel(input = {}) {
  const snapshot = input.controlCenter || {};
  const portfolio = input.portfolio || {};
  const performance = input.performance || {};
  const signals = Array.isArray(input.signals) ? input.signals : [];
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const alerts = Array.isArray(input.alerts) ? input.alerts : [];
  return Object.freeze({
    mode: 'PAPER_ONLY',
    session: { state: snapshot.state || 'IDLE', emergencyStop: snapshot.emergencyStop === true },
    account: { equity: Number(portfolio.equity || 0), cash: Number(portfolio.cash || 0), capitalUsed: Number(portfolio.capitalUsed || 0), pnl: Number(performance.pnl || 0), pnlPercent: Number(performance.pnlPercent || 0) },
    positions: positions.map(p => ({ symbol: p.symbol, side: p.side, quantity: Number(p.quantity || 0), entryPrice: Number(p.entryPrice || 0), lastPrice: Number(p.lastPrice || 0), pnl: Number(p.pnl || 0) })),
    signals: signals.slice(0, 50),
    alerts: alerts.slice(0, 50),
    health: input.health || { status: 'UNKNOWN' },
    safety: { paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false },
    updatedAt: new Date().toISOString()
  });
}

export function assertDashboardPaperSafe(model) {
  return Boolean(model?.mode === 'PAPER_ONLY' && model?.safety?.paperOnly === true && model?.safety?.realOrderPlaced === false && model?.safety?.productionRealTradingEnabled === false);
}

console.log('AI TRADE PRO — paper trading dashboard view model loaded');
