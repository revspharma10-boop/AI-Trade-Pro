// ============================================================
// AI TRADE PRO — PAPER PORTFOLIO ENGINE
// STEP 2M
// PAPER ORDER / POSITION / P&L MANAGEMENT
// ============================================================
//
// Purpose:
// - Manage paper-only cash, positions and order history.
// - Convert authorized paper orders into open positions.
// - Mark open positions to market.
// - Close positions and calculate realized P&L.
// - Prevent duplicate positions for the same symbol.
// - Never call a broker and never place real orders.
// ============================================================

const EPSILON = 1e-9;

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number !== null && number > 0;
}

function round(value, decimals = 2) {
  const number = finiteNumber(value, 0);
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function createId(prefix = 'PAPER') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeSide(order = {}) {
  if (order.side === 'BUY' || order.decision === 'BUY') return 'BUY';
  if (order.side === 'SELL' || order.decision === 'SELL') return 'SELL';
  return null;
}

function normalizeAction(order = {}) {
  if (order.action === 'LONG') return 'LONG';
  if (order.action === 'SHORT') return 'SHORT';
  return null;
}

function validatePortfolioInput({ initialCapital = 0 } = {}) {
  const capital = finiteNumber(initialCapital);

  if (capital === null || capital <= 0) {
    throw new Error('Initial paper-trading capital must be greater than zero.');
  }

  return capital;
}

function clonePosition(position) {
  return position ? { ...position } : null;
}

export function createPaperPortfolio({ initialCapital = 1000000 } = {}) {
  const capital = validatePortfolioInput({ initialCapital });

  return {
    valid: true,
    paperOnly: true,
    initialCapital: round(capital),
    cash: round(capital),
    reservedCapital: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    equity: round(capital),
    positions: [],
    closedPositions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
    realOrderPlaced: false
  };
}

function getOpenPosition(portfolio, symbol) {
  return portfolio.positions.find(
    position => position.symbol === symbol
  ) || null;
}

function calculatePositionPnL(position, marketPrice) {
  const price = finiteNumber(marketPrice);
  if (!position || price === null || price <= 0) return null;

  const multiplier = position.action === 'LONG' ? 1 : -1;
  return round(
    (price - position.entryPrice) *
    position.quantity *
    multiplier
  );
}

export function getPortfolioSummary(portfolio) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return {
      valid: false,
      reason: 'Valid paper portfolio is required.'
    };
  }

  const unrealizedPnL = round(
    portfolio.positions.reduce(
      (total, position) => total + finiteNumber(position.unrealizedPnL, 0),
      0
    )
  );

  const realizedPnL = round(portfolio.realizedPnL);
  const equity = round(portfolio.cash + portfolio.reservedCapital + unrealizedPnL);

  return {
    valid: true,
    paperOnly: true,
    initialCapital: round(portfolio.initialCapital),
    cash: round(portfolio.cash),
    reservedCapital: round(portfolio.reservedCapital),
    realizedPnL,
    unrealizedPnL,
    equity,
    openPositions: portfolio.positions.length,
    closedPositions: portfolio.closedPositions.length,
    totalOrders: portfolio.orders.length,
    realOrderPlaced: false
  };
}

export function openPaperPosition(portfolio, paperOrder = {}) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return { valid: false, created: false, reason: 'Valid paper portfolio is required.' };
  }

  const symbol = paperOrder.symbol;
  const side = normalizeSide(paperOrder);
  const action = normalizeAction(paperOrder);
  const quantity = finiteNumber(paperOrder.quantity);
  const entryPrice = finiteNumber(paperOrder.entryPrice);
  const stopLoss = finiteNumber(paperOrder.stopLoss);
  const targetPrice = finiteNumber(paperOrder.targetPrice);

  if (!symbol) return { valid: false, created: false, reason: 'Symbol is required.' };
  if (!side || !action) return { valid: false, created: false, reason: 'Valid side and action are required.' };
  if (quantity === null || quantity <= 0) return { valid: false, created: false, reason: 'Quantity must be greater than zero.' };
  if (entryPrice === null || entryPrice <= 0) return { valid: false, created: false, reason: 'Entry price must be greater than zero.' };
  if (stopLoss === null || stopLoss <= 0) return { valid: false, created: false, reason: 'Stop-loss must be greater than zero.' };
  if (targetPrice === null || targetPrice <= 0) return { valid: false, created: false, reason: 'Target price must be greater than zero.' };

  if ((side === 'BUY' && action !== 'LONG') || (side === 'SELL' && action !== 'SHORT')) {
    return { valid: false, created: false, reason: 'Side and action mismatch.' };
  }

  if (getOpenPosition(portfolio, symbol)) {
    return { valid: false, created: false, reason: 'DUPLICATE_OPEN_POSITION' };
  }

  const positionValue = round(quantity * entryPrice);
  if (positionValue > portfolio.cash + EPSILON) {
    return { valid: false, created: false, reason: 'INSUFFICIENT_PAPER_CASH' };
  }

  const position = {
    positionId: createId('POS'),
    symbol,
    side,
    action,
    quantity: round(quantity, 6),
    entryPrice: round(entryPrice, 4),
    stopLoss: round(stopLoss, 4),
    targetPrice: round(targetPrice, 4),
    positionValue,
    currentPrice: round(entryPrice, 4),
    unrealizedPnL: 0,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    closedAt: null,
    realizedPnL: 0,
    realOrderPlaced: false
  };

  portfolio.cash = round(portfolio.cash - positionValue);
  portfolio.reservedCapital = round(portfolio.reservedCapital + positionValue);
  portfolio.positions.push(position);
  portfolio.orders.push({
    orderId: createId('ORD'),
    status: 'PAPER_FILLED',
    symbol,
    side,
    action,
    quantity: position.quantity,
    fillPrice: position.entryPrice,
    positionId: position.positionId,
    realOrderPlaced: false,
    createdAt: new Date().toISOString()
  });

  portfolio.lastUpdated = new Date().toISOString();

  return {
    valid: true,
    created: true,
    paperOnly: true,
    position: clonePosition(position),
    portfolio: getPortfolioSummary(portfolio),
    realOrderPlaced: false
  };
}

export function markPaperPosition(portfolio, symbol, marketPrice) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return { valid: false, updated: false, reason: 'Valid paper portfolio is required.' };
  }

  const price = finiteNumber(marketPrice);
  if (price === null || price <= 0) {
    return { valid: false, updated: false, reason: 'Valid market price is required.' };
  }

  const position = getOpenPosition(portfolio, symbol);
  if (!position) {
    return { valid: false, updated: false, reason: 'OPEN_POSITION_NOT_FOUND' };
  }

  position.currentPrice = round(price, 4);
  position.unrealizedPnL = calculatePositionPnL(position, price);
  portfolio.unrealizedPnL = round(
    portfolio.positions.reduce((total, item) => total + finiteNumber(item.unrealizedPnL, 0), 0)
  );
  portfolio.equity = round(portfolio.cash + portfolio.reservedCapital + portfolio.unrealizedPnL);
  portfolio.lastUpdated = new Date().toISOString();

  return {
    valid: true,
    updated: true,
    position: clonePosition(position),
    portfolio: getPortfolioSummary(portfolio),
    realOrderPlaced: false
  };
}

export function closePaperPosition(portfolio, symbol, exitPrice, reason = 'MANUAL_EXIT') {
  if (!portfolio || portfolio.paperOnly !== true) {
    return { valid: false, closed: false, reason: 'Valid paper portfolio is required.' };
  }

  const price = finiteNumber(exitPrice);
  if (price === null || price <= 0) {
    return { valid: false, closed: false, reason: 'Valid exit price is required.' };
  }

  const index = portfolio.positions.findIndex(
    position => position.symbol === symbol
  );

  if (index < 0) {
    return { valid: false, closed: false, reason: 'OPEN_POSITION_NOT_FOUND' };
  }

  const position = portfolio.positions[index];
  const realizedPnL = calculatePositionPnL(position, price);
  const proceeds = round(position.quantity * price);

  portfolio.cash = round(portfolio.cash + proceeds);
  portfolio.reservedCapital = round(
    Math.max(0, portfolio.reservedCapital - position.positionValue)
  );
  portfolio.realizedPnL = round(portfolio.realizedPnL + realizedPnL);
  portfolio.unrealizedPnL = round(
    portfolio.unrealizedPnL - finiteNumber(position.unrealizedPnL, 0)
  );

  const closed = {
    ...position,
    currentPrice: round(price, 4),
    realizedPnL,
    unrealizedPnL: 0,
    status: 'CLOSED',
    closeReason: reason,
    closedAt: new Date().toISOString(),
    realOrderPlaced: false
  };

  portfolio.positions.splice(index, 1);
  portfolio.closedPositions.push(closed);
  portfolio.orders.push({
    orderId: createId('ORD'),
    status: 'PAPER_CLOSED',
    symbol,
    side: position.action === 'LONG' ? 'SELL' : 'BUY',
    action: position.action,
    quantity: position.quantity,
    fillPrice: round(price, 4),
    positionId: position.positionId,
    closeReason: reason,
    realOrderPlaced: false,
    createdAt: new Date().toISOString()
  });

  portfolio.equity = round(portfolio.cash + portfolio.reservedCapital + portfolio.unrealizedPnL);
  portfolio.lastUpdated = new Date().toISOString();

  return {
    valid: true,
    closed: true,
    paperOnly: true,
    position: clonePosition(closed),
    realizedPnL,
    portfolio: getPortfolioSummary(portfolio),
    realOrderPlaced: false
  };
}

export function resetPaperPortfolio(portfolio, initialCapital = portfolio?.initialCapital) {
  if (!portfolio || portfolio.paperOnly !== true) {
    return { valid: false, reason: 'Valid paper portfolio is required.' };
  }

  const fresh = createPaperPortfolio({ initialCapital });
  Object.keys(portfolio).forEach(key => delete portfolio[key]);
  Object.assign(portfolio, fresh);

  return {
    valid: true,
    reset: true,
    portfolio: getPortfolioSummary(portfolio),
    realOrderPlaced: false
  };
}

console.log('AI TRADE PRO — paper portfolio engine loaded');
