// ============================================================
// AI TRADE PRO — PAPER TRADE JOURNAL ENGINE
// STEPS 2AA–2AD
// Auditable paper-trade event and performance journal.
// ============================================================

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createTradeJournal() {
  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    entries: []
  };
}

export function recordTradeJournal(journal, entry = {}) {
  if (!journal || journal.paperOnly !== true) {
    return { valid: false, recorded: false, realOrderPlaced: false };
  }

  const safe = {
    timestamp: entry.timestamp || new Date().toISOString(),
    symbol: entry.symbol || null,
    decision: entry.decision || 'NO TRADE',
    action: entry.action || 'NONE',
    entryPrice: finite(entry.entryPrice, 0),
    exitPrice: finite(entry.exitPrice, 0),
    quantity: finite(entry.quantity, 0),
    realizedPnL: finite(entry.realizedPnL, 0),
    paperOnly: true,
    realOrderPlaced: false
  };

  journal.entries.push(safe);
  return { valid: true, recorded: true, entry: safe, realOrderPlaced: false };
}

export function summarizeTradeJournal(journal) {
  if (!journal || journal.paperOnly !== true) return { valid: false };

  const trades = journal.entries.filter(item => item.decision === 'BUY' || item.decision === 'SELL');
  const wins = trades.filter(item => item.realizedPnL > 0);
  const losses = trades.filter(item => item.realizedPnL < 0);
  const netPnL = trades.reduce((sum, item) => sum + finite(item.realizedPnL), 0);
  const grossProfit = wins.reduce((sum, item) => sum + finite(item.realizedPnL), 0);
  const grossLoss = Math.abs(losses.reduce((sum, item) => sum + finite(item.realizedPnL), 0));

  return {
    valid: true,
    paperOnly: true,
    realOrderPlaced: false,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: trades.filter(item => item.realizedPnL === 0).length,
    netPnL: Number(netPnL.toFixed(2)),
    winRatePercent: trades.length ? Number(((wins.length / trades.length) * 100).toFixed(2)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2))
  };
}

console.log('AI TRADE PRO — trade journal engine loaded');
