// AI TRADE PRO — PHASE 3: MONITORING & RELIABILITY
// Read-only health aggregation. Never creates or enables real orders.

const finite = value => Number.isFinite(Number(value));
const ageMs = timestamp => {
  const t = Date.parse(timestamp || '');
  return Number.isFinite(t) ? Math.max(0, Date.now() - t) : Infinity;
};

export function evaluateMarketDataHealth(data = {}, options = {}) {
  const maxAgeMs = Number(options.maxAgeMs ?? 120000);
  const symbols = Array.isArray(data.symbols) ? data.symbols : [];
  const stale = symbols.filter(x => ageMs(x.timestamp || x.updatedAt) > maxAgeMs).map(x => x.symbol);
  const invalid = symbols.filter(x => !x.symbol || !finite(x.price) || Number(x.price) <= 0).map(x => x.symbol || 'UNKNOWN');
  const healthy = stale.length === 0 && invalid.length === 0 && (data.connected !== false);
  return { healthy, status: healthy ? 'HEALTHY' : 'DEGRADED', staleSymbols: stale, invalidSymbols: invalid, connected: data.connected !== false, checkedAt: new Date().toISOString() };
}

export function evaluateSignalHealth(signals = {}) {
  const history = Array.isArray(signals.history) ? signals.history : [];
  const healthy = signals.paperOnly === true && signals.realOrderPlaced === false && signals.productionRealTradingEnabled === false && history.every(x => x.paperOnly === true && x.realOrderPlaced === false);
  return { healthy, status: healthy ? 'HEALTHY' : 'FAILED', count: history.length, checkedAt: new Date().toISOString() };
}

export function evaluateExecutionHealth(execution = {}) {
  const healthy = execution.paperOnly === true && execution.realOrderPlaced === false && execution.productionRealTradingEnabled === false && (!Array.isArray(execution.orders) || execution.orders.every(x => x.paperOnly === true && x.realOrderPlaced === false));
  return { healthy, status: healthy ? 'HEALTHY' : 'FAILED', orderCount: Array.isArray(execution.orders) ? execution.orders.length : 0, checkedAt: new Date().toISOString() };
}

export function evaluatePortfolioConsistency(portfolio = {}) {
  const capital = Number(portfolio.capital);
  const equity = Number(portfolio.equity);
  const used = Number(portfolio.capitalUsed ?? 0);
  const consistent = finite(capital) && finite(equity) && finite(used) && capital >= 0 && equity >= 0 && used >= 0 && used <= Math.max(capital, equity);
  return { healthy: consistent, status: consistent ? 'HEALTHY' : 'FAILED', consistent, checkedAt: new Date().toISOString() };
}

export function evaluateRiskHealth(risk = {}) {
  const healthy = risk.paperOnly !== false && risk.realOrderPlaced !== true && risk.productionRealTradingEnabled !== true && risk.safe !== false;
  return { healthy, status: healthy ? 'HEALTHY' : 'BLOCKED', checkedAt: new Date().toISOString() };
}

export function evaluateSessionHealth(session = {}) {
  const validStatus = ['OPEN', 'CLOSED', 'NOT_STARTED'].includes(session.status);
  const healthy = validStatus && session.paperOnly !== false && session.realOrderPlaced !== true && session.productionRealTradingEnabled !== true;
  return { healthy, status: healthy ? 'HEALTHY' : 'FAILED', sessionStatus: session.status || 'NOT_STARTED', checkedAt: new Date().toISOString() };
}

export function evaluateErrorHealth(errors = []) {
  const list = Array.isArray(errors) ? errors : [];
  const unresolved = list.filter(x => x && x.resolved !== true);
  return { healthy: unresolved.length === 0, status: unresolved.length ? 'DEGRADED' : 'HEALTHY', total: list.length, unresolved: unresolved.length, checkedAt: new Date().toISOString() };
}

export function buildPaperReliabilitySnapshot(input = {}, options = {}) {
  const checks = {
    marketData: evaluateMarketDataHealth(input.marketData, options.marketData),
    signals: evaluateSignalHealth(input.signals),
    execution: evaluateExecutionHealth(input.execution),
    portfolio: evaluatePortfolioConsistency(input.portfolio),
    risk: evaluateRiskHealth(input.risk),
    session: evaluateSessionHealth(input.session),
    errors: evaluateErrorHealth(input.errors)
  };
  const failedDomains = Object.entries(checks).filter(([, x]) => !x.healthy).map(([name]) => name);
  return Object.freeze({
    status: failedDomains.length ? 'DEGRADED' : 'HEALTHY',
    healthy: failedDomains.length === 0,
    failedDomains,
    checks,
    paperOnly: true,
    realOrderPlaced: false,
    productionRealTradingEnabled: false,
    checkedAt: new Date().toISOString()
  });
}

export function assertPaperReliabilitySafe(snapshot) {
  return Boolean(snapshot && snapshot.paperOnly === true && snapshot.realOrderPlaced === false && snapshot.productionRealTradingEnabled === false);
}

console.log('AI TRADE PRO — paper monitoring reliability engine loaded');
