// AI TRADE PRO — STEP 2W
// Trade Journal Engine
// Immutable-style paper trade records. No broker connectivity.

function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function iso() { return new Date().toISOString(); }

export function createJournal() { return { valid: true, paperOnly: true, realOrderPlaced: false, entries: [] }; }

export function recordTrade(journal, trade = {}) {
  if (!journal || journal.paperOnly !== true || journal.realOrderPlaced === true) return { valid: false, reason: 'JOURNAL_NOT_PAPER_ONLY' };
  if (!trade.symbol) return { valid: false, reason: 'SYMBOL_REQUIRED' };
  if (!['BUY', 'SELL'].includes(trade.side)) return { valid: false, reason: 'INVALID_SIDE' };
  const entryPrice = number(trade.entryPrice);
  const exitPrice = number(trade.exitPrice, entryPrice);
  const quantity = number(trade.quantity);
  if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) return { valid: false, reason: 'INVALID_TRADE_VALUES' };
  const pnl = trade.side === 'BUY' ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity;
  const record = { id: trade.id || `PAPER-${Date.now()}-${journal.entries.length + 1}`, symbol: String(trade.symbol).toUpperCase(), side: trade.side, quantity, entryPrice, exitPrice, pnl: Number(pnl.toFixed(2)), status: 'CLOSED', paperOnly: true, realOrderPlaced: false, openedAt: trade.openedAt || iso(), closedAt: iso(), tags: Array.isArray(trade.tags) ? [...trade.tags] : [] };
  journal.entries.push(record);
  return { valid: true, record };
}

export function summarizeJournal(journal) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  const wins = entries.filter(e => e.pnl > 0);
  const losses = entries.filter(e => e.pnl < 0);
  const netPnL = entries.reduce((sum, e) => sum + number(e.pnl), 0);
  const grossProfit = wins.reduce((sum, e) => sum + number(e.pnl), 0);
  const grossLoss = Math.abs(losses.reduce((sum, e) => sum + number(e.pnl), 0));
  return { valid: true, totalTrades: entries.length, winningTrades: wins.length, losingTrades: losses.length, breakevenTrades: entries.filter(e => e.pnl === 0).length, grossProfit: Number(grossProfit.toFixed(2)), grossLoss: Number(grossLoss.toFixed(2)), netPnL: Number(netPnL.toFixed(2)), winRatePercent: entries.length ? Number((wins.length / entries.length * 100).toFixed(2)) : 0, profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? Infinity : 0), paperOnly: true, realOrderPlaced: false };
}

export function clearJournal(journal) { if (!journal || journal.paperOnly !== true) return { valid: false, reason: 'JOURNAL_NOT_PAPER_ONLY' }; journal.entries = []; return { valid: true, cleared: true }; }

console.log('AI TRADE PRO — trade journal engine loaded');
