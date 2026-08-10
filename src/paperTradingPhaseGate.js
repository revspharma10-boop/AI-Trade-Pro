/* AI TRADE PRO — PAPER TRADING PHASE GATE
 * Safety-first scaffold for live-market observation with paper execution only.
 */

const PAPER_ONLY = true;
const REAL_ORDER_PLACED = false;
const PRODUCTION_REAL_TRADING_ENABLED = false;

export function createPaperTradingPhaseGate({ marketData, analysis, strategy, risk, execution } = {}) {
  return Object.freeze({
    mode: 'PAPER_ONLY',
    paperOnly: PAPER_ONLY,
    realOrderPlaced: REAL_ORDER_PLACED,
    productionRealTradingEnabled: PRODUCTION_REAL_TRADING_ENABLED,
    ready: Boolean(marketData && analysis && strategy && risk && execution),
    components: Object.freeze({
      marketData: Boolean(marketData),
      analysis: Boolean(analysis),
      strategy: Boolean(strategy),
      risk: Boolean(risk),
      execution: Boolean(execution)
    })
  });
}

export function validatePaperMarketInput(input) {
  if (!input || typeof input !== 'object') return { valid: false, reason: 'INVALID_INPUT' };
  if (!input.symbol || typeof input.symbol !== 'string') return { valid: false, reason: 'INVALID_SYMBOL' };
  if (!Number.isFinite(Number(input.price)) || Number(input.price) <= 0) return { valid: false, reason: 'INVALID_PRICE' };
  if (input.timestamp && !Number.isFinite(new Date(input.timestamp).getTime())) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' };
  }
  return { valid: true, symbol: input.symbol.trim().toUpperCase(), price: Number(input.price) };
}

export function authorizePaperSignal(signal, riskState = {}) {
  if (!signal || typeof signal !== 'object') return { executable: false, reason: 'INVALID_SIGNAL' };
  if (signal.action !== 'BUY' && signal.action !== 'SELL' && signal.action !== 'NO_TRADE') {
    return { executable: false, reason: 'INVALID_ACTION' };
  }
  if (signal.action === 'NO_TRADE') return { executable: false, reason: 'NO_TRADE' };
  if (riskState.safe === false) return { executable: false, reason: 'RISK_BLOCKED' };
  return { executable: true, paperOnly: true, realOrderPlaced: false };
}

export function createPaperTradeRecord({ signal, market, quantity = 0 }) {
  const checked = authorizePaperSignal(signal, { safe: true });
  if (!checked.executable) return { valid: false, reason: checked.reason, paperOnly: true };
  const input = validatePaperMarketInput(market);
  if (!input.valid) return { valid: false, reason: input.reason, paperOnly: true };
  if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    return { valid: false, reason: 'INVALID_QUANTITY', paperOnly: true };
  }
  return Object.freeze({
    valid: true,
    symbol: input.symbol,
    action: signal.action,
    price: input.price,
    quantity: Number(quantity),
    timestamp: market.timestamp || new Date().toISOString(),
    paperOnly: true,
    realOrderPlaced: false
  });
}
