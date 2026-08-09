// AI TRADE PRO — STEP 2CO–2CX
// Paper order queue lifecycle. Real orders are structurally impossible here.

const ALLOWED = new Set(['BUY', 'SELL']);
const TERMINAL = new Set(['PAPER_FILLED', 'PAPER_CANCELLED', 'PAPER_REJECTED']);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOrder(order = {}) {
  const symbol = String(order.symbol || '').trim().toUpperCase();
  const side = String(order.recommendation || order.side || '').trim().toUpperCase();
  const quantity = num(order.quantity);
  const price = num(order.price);
  return { symbol, side, quantity, price };
}

export function validatePaperOrder(order = {}) {
  const o = normalizeOrder(order);
  const reasons = [];
  if (!o.symbol) reasons.push('INVALID_SYMBOL');
  if (!ALLOWED.has(o.side)) reasons.push('INVALID_SIDE');
  if (!(o.quantity > 0)) reasons.push('INVALID_QUANTITY');
  if (!(o.price > 0)) reasons.push('INVALID_PRICE');
  return { valid: reasons.length === 0, ...o, rejectionReasons: reasons, paperOnly: true, realOrderPlaced: false };
}

export function createPaperOrder(order = {}) {
  const check = validatePaperOrder(order);
  const id = String(order.id || `PAPER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  if (!check.valid) return { ...check, id, status: 'PAPER_REJECTED', executable: false };
  return { ...check, id, status: 'PAPER_QUEUED', executable: true, orderValue: Number((check.quantity * check.price).toFixed(2)) };
}

export function transitionPaperOrder(order = {}, status) {
  const current = String(order.status || 'PAPER_QUEUED');
  const allowed = {
    PAPER_QUEUED: new Set(['PAPER_FILLED', 'PAPER_CANCELLED', 'PAPER_REJECTED']),
    PAPER_FILLED: new Set(), PAPER_CANCELLED: new Set(), PAPER_REJECTED: new Set()
  };
  if (!allowed[current]?.has(status)) return { ...order, transitionValid: false, paperOnly: true, realOrderPlaced: false };
  return { ...order, status, transitionValid: true, paperOnly: true, realOrderPlaced: false };
}

export function cancelPaperOrder(order = {}) {
  return transitionPaperOrder(order, 'PAPER_CANCELLED');
}

export function fillPaperOrder(order = {}, fillPrice = order.price) {
  const price = num(fillPrice);
  if (!(price > 0)) return { ...order, transitionValid: false, paperOnly: true, realOrderPlaced: false };
  return { ...transitionPaperOrder(order, 'PAPER_FILLED'), fillPrice: price, filledValue: Number((num(order.quantity) * price).toFixed(2)) };
}

export function buildPaperQueue(orders = []) {
  const source = Array.isArray(orders) ? orders : [];
  const created = source.map(createPaperOrder);
  return {
    valid: true,
    queued: created.filter(x => x.status === 'PAPER_QUEUED'),
    rejected: created.filter(x => x.status === 'PAPER_REJECTED'),
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function summarizePaperQueue(queue = {}) {
  const all = [...(queue.queued || []), ...(queue.rejected || []), ...(queue.filled || []), ...(queue.cancelled || [])];
  return {
    total: all.length,
    queued: all.filter(x => x.status === 'PAPER_QUEUED').length,
    filled: all.filter(x => x.status === 'PAPER_FILLED').length,
    cancelled: all.filter(x => x.status === 'PAPER_CANCELLED').length,
    rejected: all.filter(x => x.status === 'PAPER_REJECTED').length,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function assertPaperQueueSafe(queue = {}) {
  const all = [...(queue.queued || []), ...(queue.rejected || []), ...(queue.filled || []), ...(queue.cancelled || [])];
  return queue.paperOnly === true && queue.realOrderPlaced === false && all.every(x => x.paperOnly === true && x.realOrderPlaced === false && TERMINAL.has(x.status) || ['PAPER_QUEUED'].includes(x.status));
}

console.log('AI TRADE PRO — paper order queue engine loaded');
