// ============================================================
// AI TRADE PRO — PAPER PERFORMANCE ENGINE
// STEP 2P
// PAPER TRADE JOURNAL + PERFORMANCE ANALYTICS CONTRACT
// ============================================================
// PAPER ONLY. No broker API. No real order placement.
//
// Purpose:
// - Convert paper portfolio history into measurable performance.
// - Track closed-trade outcomes without changing execution state.
// - Provide win rate, profit factor, expectancy and drawdown metrics.
// - Keep all calculations deterministic and safe for UI/backtesting.
// ============================================================

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

function normalizeTrade(trade, index = 0) {
  if (!trade || typeof trade !== 'object') return null;

  const pnl = round(trade.realizedPnL ?? trade.pnl ?? trade.profitLoss);
  const quantity = number(trade.quantity);
  const entryPrice = number(trade.entryPrice);
  const exitPrice = number(trade.exitPrice ?? trade.closePrice);

  return {
    id: trade.id || `PAPER-${index + 1}`,
    symbol: trade.symbol || null,
    action: trade.action || null,
    side: trade.side || null,
    quantity,
    entryPrice,
    exitPrice,
    realizedPnL: pnl,
    outcome: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
    openedAt: trade.openedAt || trade.createdAt || null,
    closedAt: trade.closedAt || trade.updatedAt || null
  };
}

export function buildPaperTradeJournal(portfolio) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return {
      valid: false,
      paperOnly: true,
      realOrderPlaced: false,
      reason: 'Valid paper portfolio is required.'
    };
  }

  const rawTrades = Array.isArray(portfolio.closedPositions)
    ? portfolio.closedPositions
    : [];

  const trades = rawTrades
    .map(normalizeTrade)
    .filter(Boolean);

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    totalTrades: trades.length,
    trades
  };
}

export function calculatePaperPerformance(portfolio) {
  const journal = buildPaperTradeJournal(portfolio);
  if (!journal.valid) return journal;

  const trades = journal.trades;
  const wins = trades.filter(trade => trade.realizedPnL > 0);
  const losses = trades.filter(trade => trade.realizedPnL < 0);
  const breakevens = trades.filter(trade => trade.realizedPnL === 0);

  const grossProfit = round(
    wins.reduce((sum, trade) => sum + trade.realizedPnL, 0)
  );
  const grossLoss = round(
    Math.abs(losses.reduce((sum, trade) => sum + trade.realizedPnL, 0))
  );
  const netPnL = round(grossProfit - grossLoss);

  const winRatePercent = trades.length > 0
    ? round((wins.length / trades.length) * 100)
    : 0;

  const averageWin = wins.length > 0
    ? round(grossProfit / wins.length)
    : 0;

  const averageLoss = losses.length > 0
    ? round(grossLoss / losses.length)
    : 0;

  const expectancyPerTrade = trades.length > 0
    ? round(netPnL / trades.length)
    : 0;

  const profitFactor = grossLoss > 0
    ? round(grossProfit / grossLoss)
    : grossProfit > 0 ? Infinity : 0;

  let runningPnL = 0;
  let peakPnL = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    runningPnL = round(runningPnL + trade.realizedPnL);
    peakPnL = Math.max(peakPnL, runningPnL);
    maxDrawdown = Math.max(maxDrawdown, peakPnL - runningPnL);
  }

  const initialCapital = number(portfolio.initialCapital);
  const returnPercent = initialCapital > 0
    ? round((netPnL / initialCapital) * 100)
    : 0;

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakevens.length,
    grossProfit,
    grossLoss,
    netPnL,
    winRatePercent,
    averageWin,
    averageLoss,
    expectancyPerTrade,
    profitFactor,
    maxDrawdown: round(maxDrawdown),
    returnPercent
  };
}

export function buildPaperPerformanceDashboardModel(portfolio) {
  const performance = calculatePaperPerformance(portfolio);

  if (!performance.valid) return performance;

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    headline: {
      netPnL: performance.netPnL,
      returnPercent: performance.returnPercent,
      winRatePercent: performance.winRatePercent,
      profitFactor: performance.profitFactor
    },
    trades: {
      total: performance.totalTrades,
      wins: performance.winningTrades,
      losses: performance.losingTrades,
      breakevens: performance.breakevenTrades
    },
    risk: {
      expectancyPerTrade: performance.expectancyPerTrade,
      maxDrawdown: performance.maxDrawdown
    }
  };
}

console.log('AI TRADE PRO — paper performance engine loaded');
