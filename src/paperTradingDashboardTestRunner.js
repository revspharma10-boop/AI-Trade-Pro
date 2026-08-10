import { buildPaperTradingDashboardModel, assertDashboardModelSafe } from './paperTradingDashboardModel.js';

export function runPaperTradingDashboardTests() {
  const runtimeState = {
    paperOnly: true,
    realOrderPlaced: false,
    positions: [{ status: 'OPEN', symbol: 'RELIANCE', side: 'LONG', quantity: 10, entryPrice: 100, markPrice: 110, unrealizedPnL: 100 }],
    orders: [{ status: 'PAPER_FILLED', symbol: 'RELIANCE', quantity: 10, price: 100, paperOnly: true, realOrderPlaced: false }],
    journal: [{ symbol: 'TCS', realizedPnL: 200, paperOnly: true, realOrderPlaced: false }],
    snapshot: { initialCapital: 100000, cash: 99000, equity: 100100, realizedPnL: 200, unrealizedPnL: 100, dailyRealizedPnL: 200, grossExposure: 1100, capitalUtilizationPercent: 1.1, risk: { safe: true, dailyLossPercent: 0, rejectionReasons: [] } }
  };
  const model = buildPaperTradingDashboardModel(runtimeState);
  const checks = [
    ['Dashboard model is PAPER mode', model.mode === 'PAPER'],
    ['Paper-only indicator is true', model.safety.paperOnly === true],
    ['Real orders remain disabled', model.safety.realOrderPlaced === false],
    ['Production trading remains disabled', model.safety.productionRealTradingEnabled === false],
    ['Account metrics are exposed', model.account.equity === 100100 && model.account.realizedPnL === 200],
    ['Risk metrics are exposed', model.risk.capitalUtilizationPercent === 1.1 && model.risk.safe === true],
    ['Open position is visible', model.positions.openCount === 1 && model.positions.open[0].symbol === 'RELIANCE'],
    ['Filled paper order is visible', model.orders.filled === 1],
    ['Performance is calculated', model.performance.totalTrades === 1 && model.performance.winRatePercent === 100],
    ['Journal remains paper-only', model.journal[0].paperOnly === true && model.journal[0].realOrderPlaced === false],
    ['Dashboard safety assertion passes', assertDashboardModelSafe(model)]
  ];
  const passed = checks.filter(x => x[1]).length;
  const failed = checks.length - passed;
  const summary = { passed, failed, allAssertionsPassed: failed === 0, suiteStatus: failed === 0 ? 'PASSED' : 'FAILED', paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, results: checks.map(([name, passed]) => ({ name, passed })) };
  console.table(summary);
  console.log(`PAPER TRADING DASHBOARD VALIDATION: ${summary.suiteStatus}`);
  return summary;
}

if (typeof window !== 'undefined') window.runPaperTradingDashboardTests = runPaperTradingDashboardTests;
