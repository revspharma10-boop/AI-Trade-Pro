// AI TRADE PRO — STEP 2X
// Risk Dashboard Engine
// Read-only aggregation layer for paper trading safety and exposure.

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }

export function buildRiskDashboard({ accountCapital = 0, cash = accountCapital, positions = [], journalSummary = {} } = {}) {
  const capital = Math.max(0, n(accountCapital));
  const positionList = Array.isArray(positions) ? positions : [];
  const exposure = positionList.reduce((sum, p) => sum + Math.abs(n(p.entryPrice) * n(p.quantity)), 0);
  const unrealizedPnL = positionList.reduce((sum, p) => { const entry = n(p.entryPrice); const price = n(p.currentPrice, entry); const qty = n(p.quantity); const side = p.side === 'SHORT' || p.side === 'SELL' ? -1 : 1; return sum + (price - entry) * qty * side; }, 0);
  const utilization = capital > 0 ? exposure / capital * 100 : 0;
  const netPnL = n(journalSummary.netPnL);
  return { valid: true, paperOnly: true, realOrderPlaced: false, accountCapital: Number(capital.toFixed(2)), cash: Number(Math.max(0, n(cash)).toFixed(2)), openPositions: positionList.length, grossExposure: Number(exposure.toFixed(2)), exposurePercent: Number(utilization.toFixed(2)), unrealizedPnL: Number(unrealizedPnL.toFixed(2)), realizedPnL: Number(netPnL.toFixed(2)), totalPnL: Number((netPnL + unrealizedPnL).toFixed(2)), riskState: positionList.length === 0 ? 'FLAT' : 'EXPOSED' };
}

export function isRiskDashboardSafe(dashboard = {}) {
  return dashboard.paperOnly === true && dashboard.realOrderPlaced === false && n(dashboard.accountCapital) >= 0 && n(dashboard.cash) >= 0 && n(dashboard.grossExposure) >= 0;
}

console.log('AI TRADE PRO — risk dashboard engine loaded');
