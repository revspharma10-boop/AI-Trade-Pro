// AI TRADE PRO — PAPER OPERATIONS HEALTH / MONITORING
// Read-only health aggregation. No live trading capability.

export function buildPaperOperationsHealth(snapshot = {}) {
  const app = snapshot.application?.state || snapshot.application || {};
  const session = snapshot.session || {};
  const signals = snapshot.signals || {};
  const performance = snapshot.performance || {};
  const risk = app.risk || app.riskState || {};
  const errors = [];

  if (snapshot.paperOnly !== true) errors.push('PAPER_MODE_REQUIRED');
  if (snapshot.realOrderPlaced !== false) errors.push('REAL_ORDER_DETECTED');
  if (snapshot.productionRealTradingEnabled !== false) errors.push('PRODUCTION_TRADING_ENABLED');
  if (session.status === 'OPEN' && !session.startedAt) errors.push('SESSION_START_MISSING');
  if (Number(signals.count || 0) < 0) errors.push('INVALID_SIGNAL_COUNT');
  if (Number(performance.maxDrawdown || 0) < 0) errors.push('INVALID_DRAWDOWN');

  const riskBlocked = Boolean(risk.dailyLossBlocked || risk.exposureBlocked || risk.blocked);
  return Object.freeze({
    status: errors.length ? 'UNSAFE' : (riskBlocked ? 'RISK_BLOCKED' : 'HEALTHY'),
    errors,
    riskBlocked,
    sessionStatus: session.status || 'NOT_STARTED',
    signalCount: Number(signals.count || 0),
    executableSignals: Number(signals.executableCount || 0),
    tradeCount: Number(performance.tradeCount || 0),
    realizedPnL: Number(performance.realizedPnL || 0),
    maxDrawdown: Number(performance.maxDrawdown || 0),
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  });
}

export function assertPaperOperationsHealthSafe(health) {
  return Boolean(health && health.paperOnly === true && health.realOrderPlaced === false && health.productionRealTradingEnabled === false && health.status !== 'UNSAFE');
}

console.log('AI TRADE PRO — paper operations health engine loaded');
