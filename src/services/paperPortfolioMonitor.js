// ============================================================
// AI TRADE PRO — PAPER PORTFOLIO MONITOR
// STEP 2O
// PORTFOLIO STATE → RISK / P&L MONITORING CONTRACT
// ============================================================
// PAPER ONLY. No broker API. No real order placement.
// ============================================================

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

function positionRisk(position) {
  if (!position) return 0;

  const quantity = number(position.quantity);
  const entry = number(position.entryPrice);
  const stop = number(position.stopLoss);

  if (quantity <= 0 || entry <= 0 || stop <= 0) return 0;

  return round(Math.abs(entry - stop) * quantity);
}

export function buildPaperPortfolioMonitor(portfolio, options = {}) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return {
      valid: false,
      paperOnly: true,
      reason: 'Valid paper portfolio is required.'
    };
  }

  const maxRiskPercent = number(options.maxRiskPercent, 1);
  const initialCapital = number(portfolio.initialCapital);
  const equity = number(portfolio.equity);
  const realizedPnL = number(portfolio.realizedPnL);
  const unrealizedPnL = number(portfolio.unrealizedPnL);

  const positions = Array.isArray(portfolio.positions)
    ? portfolio.positions
    : [];

  const totalOpenRisk = round(
    positions.reduce((sum, position) => sum + positionRisk(position), 0)
  );

  const maxAllowedRisk = round(initialCapital * maxRiskPercent / 100);
  const riskUtilizationPercent = maxAllowedRisk > 0
    ? round((totalOpenRisk / maxAllowedRisk) * 100)
    : 0;

  const totalPnL = round(realizedPnL + unrealizedPnL);
  const totalReturnPercent = initialCapital > 0
    ? round((totalPnL / initialCapital) * 100)
    : 0;

  let riskStatus = 'SAFE';
  if (riskUtilizationPercent > 100) {
    riskStatus = 'OVER_RISK';
  } else if (riskUtilizationPercent >= 80) {
    riskStatus = 'HIGH_RISK';
  } else if (riskUtilizationPercent >= 50) {
    riskStatus = 'MODERATE_RISK';
  }

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    cash: round(portfolio.cash),
    reservedCapital: round(portfolio.reservedCapital),
    equity: round(equity),
    initialCapital: round(initialCapital),
    realizedPnL: round(realizedPnL),
    unrealizedPnL: round(unrealizedPnL),
    totalPnL,
    totalReturnPercent,
    openPositions: positions.length,
    closedPositions: Array.isArray(portfolio.closedPositions)
      ? portfolio.closedPositions.length
      : 0,
    totalOrders: Array.isArray(portfolio.orders)
      ? portfolio.orders.length
      : 0,
    totalOpenRisk,
    maxRiskPercent: round(maxRiskPercent, 4),
    maxAllowedRisk,
    riskUtilizationPercent,
    riskStatus
  };
}

export function getPaperPositionMonitor(portfolio, symbol) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return {
      valid: false,
      paperOnly: true,
      reason: 'Valid paper portfolio is required.'
    };
  }

  const position = (portfolio.positions || []).find(
    item => item.symbol === symbol
  );

  if (!position) {
    return {
      valid: true,
      found: false,
      paperOnly: true,
      realOrderPlaced: false,
      symbol: symbol || null
    };
  }

  const riskAmount = positionRisk(position);
  const unrealizedPnL = number(position.unrealizedPnL);

  return {
    valid: true,
    found: true,
    paperOnly: true,
    realOrderPlaced: false,
    symbol: position.symbol,
    action: position.action,
    side: position.side,
    quantity: number(position.quantity),
    entryPrice: number(position.entryPrice),
    currentPrice: number(position.currentPrice),
    stopLoss: number(position.stopLoss),
    targetPrice: number(position.targetPrice),
    positionValue: number(position.positionValue),
    riskAmount,
    unrealizedPnL: round(unrealizedPnL),
    status: position.status
  };
}

export function buildPaperPortfolioDashboardModel(portfolio, options = {}) {
  const monitor = buildPaperPortfolioMonitor(portfolio, options);

  if (!monitor.valid) return monitor;

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    headline: {
      equity: monitor.equity,
      cash: monitor.cash,
      totalPnL: monitor.totalPnL,
      totalReturnPercent: monitor.totalReturnPercent,
      riskStatus: monitor.riskStatus
    },
    risk: {
      openRisk: monitor.totalOpenRisk,
      maxAllowedRisk: monitor.maxAllowedRisk,
      utilizationPercent: monitor.riskUtilizationPercent,
      status: monitor.riskStatus
    },
    activity: {
      openPositions: monitor.openPositions,
      closedPositions: monitor.closedPositions,
      totalOrders: monitor.totalOrders
    }
  };
}

console.log('AI TRADE PRO — paper portfolio monitor loaded');
