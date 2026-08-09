// ============================================================
// AI TRADE PRO — PAPER BACKTEST ENGINE
// STEP 2S
// ============================================================
// Deterministic historical/paper simulation only.
// No broker API. No live order placement.
// ============================================================

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((number(value) + Number.EPSILON) * factor) / factor;
}

function tradePnL(trade) {
  const quantity = Math.abs(number(trade.quantity));
  const entry = number(trade.entryPrice);
  const exit = number(trade.exitPrice);
  if (trade.action === 'SHORT') return round((entry - exit) * quantity);
  return round((exit - entry) * quantity);
}

export function runPaperBacktest({ trades = [], initialCapital = 100000 } = {}) {
  if (!Array.isArray(trades)) {
    return { valid: false, paperOnly: true, realOrderPlaced: false, reason: 'Trades must be an array.' };
  }
  const capital = number(initialCapital);
  if (capital <= 0) {
    return { valid: false, paperOnly: true, realOrderPlaced: false, reason: 'Initial capital must be greater than zero.' };
  }

  let equity = capital;
  let peak = capital;
  let maxDrawdown = 0;
  const normalizedTrades = [];

  for (let i = 0; i < trades.length; i += 1) {
    const trade = trades[i] || {};
    const pnl = trade.realizedPnL !== undefined ? round(trade.realizedPnL) : tradePnL(trade);
    equity = round(equity + pnl);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    normalizedTrades.push({
      id: trade.id || `BT-${i + 1}`,
      symbol: trade.symbol || null,
      action: trade.action || null,
      entryPrice: number(trade.entryPrice),
      exitPrice: number(trade.exitPrice),
      quantity: Math.abs(number(trade.quantity)),
      realizedPnL: pnl,
      outcome: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
      equityAfterTrade: equity
    });
  }

  const wins = normalizedTrades.filter(t => t.realizedPnL > 0);
  const losses = normalizedTrades.filter(t => t.realizedPnL < 0);
  const grossProfit = round(wins.reduce((s, t) => s + t.realizedPnL, 0));
  const grossLoss = round(Math.abs(losses.reduce((s, t) => s + t.realizedPnL, 0)));
  const netPnL = round(equity - capital);
  const total = normalizedTrades.length;

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    initialCapital: capital,
    finalEquity: equity,
    netPnL,
    returnPercent: round((netPnL / capital) * 100),
    totalTrades: total,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: total - wins.length - losses.length,
    winRatePercent: total ? round((wins.length / total) * 100) : 0,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0,
    expectancyPerTrade: total ? round(netPnL / total) : 0,
    maxDrawdown: round(maxDrawdown),
    trades: normalizedTrades
  };
}

export function compareBacktests(first, second) {
  if (!first?.valid || !second?.valid) {
    return { valid: false, reason: 'Two valid backtest results are required.' };
  }
  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    netPnLDelta: round(second.netPnL - first.netPnL),
    returnPercentDelta: round(second.returnPercent - first.returnPercent),
    winRateDelta: round(second.winRatePercent - first.winRatePercent),
    drawdownDelta: round(second.maxDrawdown - first.maxDrawdown),
    profitFactorDelta: second.profitFactor === Infinity || first.profitFactor === Infinity
      ? null
      : round(second.profitFactor - first.profitFactor)
  };
}

console.log('AI TRADE PRO — paper backtest engine loaded');
