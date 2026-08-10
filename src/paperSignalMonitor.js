// AI TRADE PRO — CONTINUOUS PAPER SIGNAL MONITOR
// Observation/history layer only. No broker or real-order execution.

export function createPaperSignalMonitor(options = {}) {
  const maxHistory = Math.max(1, Number(options.maxHistory || 100));
  const history = [];

  function record(observation = {}) {
    const event = Object.freeze({
      id: observation.id || `PAPER-${Date.now()}-${history.length + 1}`,
      timestamp: observation.timestamp || new Date().toISOString(),
      symbol: String(observation.symbol || '').toUpperCase(),
      action: observation.action || 'NO_TRADE',
      price: Number(observation.price || 0),
      score: Number(observation.score || 0),
      executable: observation.executable === true,
      reason: observation.reason || null,
      paperOnly: true,
      realOrderPlaced: false
    });
    history.push(event);
    while (history.length > maxHistory) history.shift();
    return event;
  }

  function snapshot() {
    const signals = [...history];
    return Object.freeze({
      mode: 'PAPER_ONLY',
      paperOnly: true,
      realOrderPlaced: false,
      productionRealTradingEnabled: false,
      count: signals.length,
      executableCount: signals.filter(s => s.executable).length,
      buyCount: signals.filter(s => s.action === 'BUY').length,
      sellCount: signals.filter(s => s.action === 'SELL').length,
      noTradeCount: signals.filter(s => s.action === 'NO_TRADE').length,
      history: signals
    });
  }

  return Object.freeze({ record, snapshot, clear: () => history.splice(0, history.length) });
}

export function assertPaperSignalMonitorSafe(snapshot) {
  return Boolean(snapshot && snapshot.mode === 'PAPER_ONLY' && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false && (snapshot.history || []).every(x => x.paperOnly === true && x.realOrderPlaced === false));
}

console.log('AI TRADE PRO — paper signal monitor loaded');
