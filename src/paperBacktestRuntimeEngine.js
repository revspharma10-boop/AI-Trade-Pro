// AI TRADE PRO — PAPER BACKTEST RUNTIME
// Deterministic backtesting over supplied bars/signals. No market or broker writes.

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function sideFromSignal(signal) {
  const value = String(signal || '').toUpperCase();
  return value === 'BUY' ? 'LONG' : value === 'SELL' ? 'SHORT' : '';
}

export function runPaperBacktest({ bars = [], initialCapital = 100000, quantity = 1, strategy = null } = {}) {
  const capital = n(initialCapital);
  const qty = n(quantity);
  if (!(capital > 0) || !(qty > 0) || !Array.isArray(bars)) {
    return { valid: false, rejectionReasons: ['INVALID_BACKTEST_INPUT'], paperOnly: true, realOrderPlaced: false };
  }

  let cash = capital;
  let position = null;
  let realizedPnL = 0;
  let peakEquity = capital;
  let maxDrawdown = 0;
  const trades = [];

  const getSignal = (bar, index) => {
    if (typeof strategy === 'function') return strategy(bar, index);
    return bar.signal || bar.recommendation || '';
  };

  const markEquity = price => {
    const unrealized = position
      ? position.side === 'LONG' ? (price - position.entryPrice) * position.quantity : (position.entryPrice - price) * position.quantity
      : 0;
    const equity = cash + unrealized;
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdown = Math.max(maxDrawdown, peakEquity - equity);
    return equity;
  };

  bars.forEach((bar, index) => {
    const price = n(bar.close ?? bar.price);
    if (!(price > 0)) return;
    const signal = sideFromSignal(getSignal(bar, index));

    if (!position && signal) {
      position = { side: signal, entryPrice: price, quantity: qty, entryIndex: index };
      cash -= price * qty;
    } else if (position && signal && signal !== position.side) {
      const pnl = position.side === 'LONG' ? (price - position.entryPrice) * qty : (position.entryPrice - price) * qty;
      cash += price * qty;
      realizedPnL += pnl;
      trades.push({
        entryIndex: position.entryIndex,
        exitIndex: index,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: price,
        quantity: qty,
        realizedPnL: Number(pnl.toFixed(2)),
        result: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
        paperOnly: true,
        realOrderPlaced: false
      });
      position = { side: signal, entryPrice: price, quantity: qty, entryIndex: index };
      cash -= price * qty;
    }
    markEquity(price);
  });

  if (position && bars.length) {
    const finalPrice = n(bars[bars.length - 1].close ?? bars[bars.length - 1].price);
    if (finalPrice > 0) {
      const pnl = position.side === 'LONG' ? (finalPrice - position.entryPrice) * qty : (position.entryPrice - finalPrice) * qty;
      cash += finalPrice * qty;
      realizedPnL += pnl;
      trades.push({
        entryIndex: position.entryIndex,
        exitIndex: bars.length - 1,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: finalPrice,
        quantity: qty,
        realizedPnL: Number(pnl.toFixed(2)),
        result: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
        paperOnly: true,
        realOrderPlaced: false,
        forcedExit: true
      });
      position = null;
    }
  }

  const winningTrades = trades.filter(t => t.realizedPnL > 0).length;
  const losingTrades = trades.filter(t => t.realizedPnL < 0).length;
  const grossProfit = trades.reduce((s, t) => s + Math.max(0, t.realizedPnL), 0);
  const grossLoss = trades.reduce((s, t) => s + Math.max(0, -t.realizedPnL), 0);
  const finalEquity = capital + realizedPnL;

  return {
    valid: true,
    initialCapital: Number(capital.toFixed(2)),
    finalEquity: Number(finalEquity.toFixed(2)),
    netPnL: Number(realizedPnL.toFixed(2)),
    returnPercent: Number((realizedPnL / capital * 100).toFixed(4)),
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    breakevenTrades: trades.length - winningTrades - losingTrades,
    winRatePercent: trades.length ? Number((winningTrades / trades.length * 100).toFixed(2)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(4)) : grossProfit > 0 ? Infinity : 0,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    trades,
    openPosition: position,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function comparePaperBacktests(a = {}, b = {}) {
  const aPnL = n(a.netPnL);
  const bPnL = n(b.netPnL);
  return {
    valid: a.valid === true && b.valid === true,
    firstNetPnL: aPnL,
    secondNetPnL: bPnL,
    netPnLDelta: Number((bPnL - aPnL).toFixed(2)),
    returnDeltaPercent: Number((n(b.returnPercent) - n(a.returnPercent)).toFixed(4)),
    paperOnly: true,
    realOrderPlaced: false
  };
}

console.log('AI TRADE PRO — paper backtest runtime loaded');
