// AI TRADE PRO — PAPER SESSION PERFORMANCE ENGINE
// Computes reporting metrics from a completed/active paper session. No live execution.

export function buildPaperSessionPerformance(session = {}) {
  const trades = Array.isArray(session.trades) ? session.trades : [];
  const pnls = trades.map(t => Number(t.realizedPnL || 0)).filter(Number.isFinite);
  const winners = pnls.filter(p => p > 0);
  const losers = pnls.filter(p => p < 0);
  const grossProfit = winners.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losers.reduce((a, b) => a + b, 0));
  const realizedPnL = Number(session.realizedPnL || 0);
  const initialCapital = Number(session.initialCapital || 0);
  const returnPercent = initialCapital > 0 ? (realizedPnL / initialCapital) * 100 : 0;
  const winRate = pnls.length ? (winners.length / pnls.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  const expectancy = pnls.length ? realizedPnL / pnls.length : 0;
  const maxDrawdown = Math.max(0, Number(session.maxDrawdown || 0));

  return Object.freeze({
    sessionId: session.sessionId || null,
    status: session.status || 'UNKNOWN',
    tradeCount: pnls.length,
    winners: winners.length,
    losers: losers.length,
    winRate,
    grossProfit,
    grossLoss,
    realizedPnL,
    unrealizedPnL: Number(session.unrealizedPnL || 0),
    returnPercent,
    profitFactor,
    expectancy,
    maxDrawdown,
    signalCount: Number(session.signalCount || 0),
    riskEventCount: Array.isArray(session.riskEvents) ? session.riskEvents.length : 0,
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false
  });
}

export function assertPaperPerformanceSafe(report) {
  return Boolean(report && report.paperOnly === true && report.realOrderPlaced === false && report.productionRealTradingEnabled === false);
}

console.log('AI TRADE PRO — paper session performance engine loaded');
