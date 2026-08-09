// ============================================================
// AI TRADE PRO — PORTFOLIO RISK ENGINE
// STEPS 2AA–2AD FOUNDATION
// PAPER-ONLY RISK CONTROLS
// ============================================================

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculatePortfolioRisk(portfolio = {}, config = {}) {
  const equity = finite(portfolio.equity, finite(portfolio.cash, 0));
  const initialCapital = finite(portfolio.initialCapital, equity);
  const openPositions = Array.isArray(portfolio.positions) ? portfolio.positions : [];
  const maxDrawdownPercent = Math.max(0, finite(config.maxDrawdownPercent, 10));
  const maxOpenPositions = Math.max(1, Math.floor(finite(config.maxOpenPositions, 10)));
  const maxCapitalPerTradePercent = clamp(finite(config.maxCapitalPerTradePercent, 20), 0, 100);

  const drawdownPercent = initialCapital > 0
    ? Math.max(0, ((initialCapital - equity) / initialCapital) * 100)
    : 100;

  const exposure = openPositions.reduce(
    (sum, position) => sum + finite(position.positionValue, 0),
    0
  );

  const exposurePercent = equity > 0 ? (exposure / equity) * 100 : 100;

  return {
    valid: equity > 0 && initialCapital > 0,
    paperOnly: true,
    realOrderPlaced: false,
    equity,
    initialCapital,
    openPositions: openPositions.length,
    exposure,
    exposurePercent: Number(exposurePercent.toFixed(2)),
    drawdownPercent: Number(drawdownPercent.toFixed(2)),
    limits: {
      maxDrawdownPercent,
      maxOpenPositions,
      maxCapitalPerTradePercent
    },
    gates: {
      capitalValid: equity > 0,
      drawdownAcceptable: drawdownPercent <= maxDrawdownPercent,
      positionCountAcceptable: openPositions.length < maxOpenPositions,
      exposureAcceptable: exposurePercent <= 100
    }
  };
}

export function authorizePaperTrade({
  portfolio = {},
  order = {},
  config = {}
} = {}) {
  const risk = calculatePortfolioRisk(portfolio, config);
  const equity = risk.equity;
  const positionValue = finite(order.quantity, 0) * finite(order.entryPrice, 0);
  const maxTradeValue = equity * risk.limits.maxCapitalPerTradePercent / 100;

  const gates = {
    ...risk.gates,
    orderValid: Boolean(order.symbol) && positionValue > 0,
    tradeSizeAcceptable: positionValue <= maxTradeValue,
    paperOnly: order.paperOnly !== false
  };

  const authorized = Object.values(gates).every(Boolean);

  return {
    valid: true,
    authorized,
    paperOnly: true,
    realOrderPlaced: false,
    positionValue: Number(positionValue.toFixed(2)),
    maxTradeValue: Number(maxTradeValue.toFixed(2)),
    gates,
    rejectionReasons: Object.entries(gates)
      .filter(([, passed]) => !passed)
      .map(([name]) => name.toUpperCase())
  };
}

console.log('AI TRADE PRO — portfolio risk engine loaded');
