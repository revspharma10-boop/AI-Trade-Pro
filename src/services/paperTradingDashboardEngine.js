// ============================================================
// AI TRADE PRO — PAPER TRADING DASHBOARD ENGINE
// STEP 2Q
// PAPER PORTFOLIO + PERFORMANCE DASHBOARD CONTRACT
// ============================================================
// PAPER ONLY. No broker API. No real order placement.
//
// Purpose:
// - Combine paper portfolio monitoring and trade performance.
// - Provide one deterministic dashboard model for the UI.
// - Keep portfolio state, P&L, risk and trade statistics separate.
// - Preserve explicit paper-only safety guarantees.
// ============================================================

import {
  buildPaperPortfolioMonitor,
  getPaperPositionMonitor
} from './paperPortfolioMonitor.js';

import {
  buildPaperTradeJournal,
  calculatePaperPerformance
} from './paperPerformanceEngine.js';

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

export function buildPaperTradingDashboard(portfolio, options = {}) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return {
      valid: false,
      paperOnly: true,
      realOrderPlaced: false,
      reason: 'Valid paper portfolio is required.'
    };
  }

  const monitor = buildPaperPortfolioMonitor(portfolio, options);
  const performance = calculatePaperPerformance(portfolio);
  const journal = buildPaperTradeJournal(portfolio);

  if (!monitor.valid || !performance.valid || !journal.valid) {
    return {
      valid: false,
      paperOnly: true,
      realOrderPlaced: false,
      reason: 'Unable to build paper trading dashboard.'
    };
  }

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,

    account: {
      initialCapital: monitor.initialCapital,
      cash: monitor.cash,
      reservedCapital: monitor.reservedCapital,
      equity: monitor.equity,
      realizedPnL: monitor.realizedPnL,
      unrealizedPnL: monitor.unrealizedPnL,
      totalPnL: monitor.totalPnL,
      totalReturnPercent: monitor.totalReturnPercent
    },

    risk: {
      openRisk: monitor.totalOpenRisk,
      maxAllowedRisk: monitor.maxAllowedRisk,
      riskUtilizationPercent: monitor.riskUtilizationPercent,
      maxRiskPercent: monitor.maxRiskPercent,
      status: monitor.riskStatus
    },

    performance: {
      totalTrades: performance.totalTrades,
      winningTrades: performance.winningTrades,
      losingTrades: performance.losingTrades,
      breakevenTrades: performance.breakevenTrades,
      grossProfit: performance.grossProfit,
      grossLoss: performance.grossLoss,
      netPnL: performance.netPnL,
      winRatePercent: performance.winRatePercent,
      averageWin: performance.averageWin,
      averageLoss: performance.averageLoss,
      expectancyPerTrade: performance.expectancyPerTrade,
      profitFactor: performance.profitFactor,
      maxDrawdown: performance.maxDrawdown,
      returnPercent: performance.returnPercent
    },

    activity: {
      openPositions: monitor.openPositions,
      closedPositions: monitor.closedPositions,
      totalOrders: monitor.totalOrders
    },

    journal: {
      totalTrades: journal.totalTrades,
      trades: journal.trades
    }
  };
}

export function getPaperTradingDashboardPosition(
  portfolio,
  symbol
) {
  const position = getPaperPositionMonitor(portfolio, symbol);

  return {
    valid: position.valid,
    paperOnly: true,
    realOrderPlaced: false,
    symbol: symbol || null,
    position
  };
}

export function buildPaperTradingDashboardSummary(
  portfolio,
  options = {}
) {
  const dashboard = buildPaperTradingDashboard(portfolio, options);

  if (!dashboard.valid) return dashboard;

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    headline: {
      equity: dashboard.account.equity,
      cash: dashboard.account.cash,
      totalPnL: dashboard.account.totalPnL,
      returnPercent: dashboard.account.totalReturnPercent,
      winRatePercent: dashboard.performance.winRatePercent,
      profitFactor: dashboard.performance.profitFactor,
      riskStatus: dashboard.risk.status
    },
    counts: {
      openPositions: dashboard.activity.openPositions,
      closedPositions: dashboard.activity.closedPositions,
      totalOrders: dashboard.activity.totalOrders,
      totalTrades: dashboard.performance.totalTrades
    },
    risk: {
      openRisk: dashboard.risk.openRisk,
      maxAllowedRisk: dashboard.risk.maxAllowedRisk,
      utilizationPercent: dashboard.risk.riskUtilizationPercent
    }
  };
}

console.log('AI TRADE PRO — paper trading dashboard engine loaded');
