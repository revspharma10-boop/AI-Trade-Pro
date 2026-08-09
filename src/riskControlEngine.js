// AI TRADE PRO — STEP 2CE–2CN
// Portfolio risk-control gate. Paper-only by design.

const DEFAULTS = Object.freeze({
  maxExposurePercent: 70,
  maxDailyLossPercent: 2,
  maxOpenPositions: 5,
  minCashPercent: 10
});

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function evaluateRiskControls(snapshot = {}, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const capital = Math.max(0, n(snapshot.accountCapital));
  const cash = Math.max(0, n(snapshot.cash));
  const exposure = Math.max(0, n(snapshot.grossExposure));
  const dailyPnL = n(snapshot.dailyRealizedPnL);
  const openPositions = Math.max(0, n(snapshot.openPositions));

  const exposurePercent = capital > 0 ? exposure / capital * 100 : 0;
  const cashPercent = capital > 0 ? cash / capital * 100 : 0;
  const dailyLossPercent = capital > 0 && dailyPnL < 0 ? Math.abs(dailyPnL) / capital * 100 : 0;
  const rejectionReasons = [];

  if (exposurePercent > cfg.maxExposurePercent) rejectionReasons.push('MAX_EXPOSURE_EXCEEDED');
  if (dailyLossPercent > cfg.maxDailyLossPercent) rejectionReasons.push('DAILY_LOSS_LIMIT_EXCEEDED');
  if (openPositions > cfg.maxOpenPositions) rejectionReasons.push('MAX_OPEN_POSITIONS_EXCEEDED');
  if (capital > 0 && cashPercent < cfg.minCashPercent) rejectionReasons.push('MIN_CASH_BUFFER_BREACHED');

  const safe = rejectionReasons.length === 0;
  return {
    valid: capital >= 0 && cash >= 0,
    safe,
    executable: safe,
    paperOnly: true,
    realOrderPlaced: false,
    accountCapital: Number(capital.toFixed(2)),
    cash: Number(cash.toFixed(2)),
    grossExposure: Number(exposure.toFixed(2)),
    exposurePercent: Number(exposurePercent.toFixed(2)),
    dailyRealizedPnL: Number(dailyPnL.toFixed(2)),
    dailyLossPercent: Number(dailyLossPercent.toFixed(2)),
    openPositions,
    cashPercent: Number(cashPercent.toFixed(2)),
    rejectionReasons
  };
}

export function canStagePaperOrder(snapshot = {}, config = {}) {
  const result = evaluateRiskControls(snapshot, config);
  return {
    ...result,
    stageAllowed: result.safe === true && result.paperOnly === true && result.realOrderPlaced === false
  };
}

export function resetDailyRisk(snapshot = {}) {
  return {
    ...snapshot,
    dailyRealizedPnL: 0,
    dailyLossPercent: 0,
    paperOnly: true,
    realOrderPlaced: false
  };
}

console.log('AI TRADE PRO — risk control engine loaded');
