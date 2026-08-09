// AI TRADE PRO — APPLICATION CONTROL CENTER
// Development-complete orchestration facade for the browser UI.
// Real broker execution is intentionally unavailable.

import {
  initializePaperTradingApplication,
  getPaperTradingApplicationState,
  scanPaperCandidates,
  stagePaperCandidate,
  fillPaperOrder,
  closePaperSymbol,
  markPaperSymbol,
  resetPaperDailyRisk
} from './paperTradingApplicationBridge.js';
import { buildScannerCycle } from './scannerOrchestrationEngine.js';
import {
  createWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistSignal,
  getWatchlistSnapshot
} from './watchlistEngine.js';

const CONTROL_STATE = {
  watchlist: createWatchlist({ name: 'AI Trade Pro Core' }),
  lastScannerCycle: null,
  lastAction: 'READY',
  initialized: false
};

function ensureApp() {
  if (!CONTROL_STATE.initialized) {
    initializePaperTradingApplication({
      initialCapital: 100000,
      maxOpenPositions: 5,
      maxCapitalUtilizationPercent: 70,
      maxDailyLossPercent: 2,
      minCashBufferPercent: 20
    });
    CONTROL_STATE.initialized = true;
  }
}

function state() {
  ensureApp();
  return getPaperTradingApplicationState();
}

export function getApplicationControlState() {
  const paper = state();
  return {
    paper,
    watchlist: getWatchlistSnapshot(CONTROL_STATE.watchlist),
    scanner: CONTROL_STATE.lastScannerCycle,
    lastAction: CONTROL_STATE.lastAction,
    paperOnly: true,
    realOrderPlaced: false
  };
}

export function addSymbol(symbol) {
  const result = addToWatchlist(CONTROL_STATE.watchlist, symbol);
  CONTROL_STATE.lastAction = result.valid ? `WATCHLIST_ADD:${String(symbol).toUpperCase()}` : result.reason;
  return result;
}

export function removeSymbol(symbol) {
  const result = removeFromWatchlist(CONTROL_STATE.watchlist, symbol);
  CONTROL_STATE.lastAction = result.valid ? `WATCHLIST_REMOVE:${String(symbol).toUpperCase()}` : result.reason;
  return result;
}

export function updateSymbolSignal(symbol, signal) {
  const result = updateWatchlistSignal(CONTROL_STATE.watchlist, symbol, signal);
  CONTROL_STATE.lastAction = result.valid ? `SIGNAL_UPDATE:${String(symbol).toUpperCase()}` : result.reason;
  return result;
}

export function runPaperScanner(candidates = []) {
  const paper = state().state;
  CONTROL_STATE.lastScannerCycle = buildScannerCycle(candidates, paper, {
    maxCandidates: 5,
    maxCapitalUtilizationPercent: 70,
    minimumScore: 65,
    minimumRiskReward: 1.5
  });
  CONTROL_STATE.lastAction = 'SCANNER_COMPLETE';
  return CONTROL_STATE.lastScannerCycle;
}

export function stageCandidate(candidate) {
  const result = stagePaperCandidate(candidate);
  CONTROL_STATE.lastAction = result?.valid ? 'PAPER_ORDER_STAGED' : `STAGE_BLOCKED:${result?.reason || 'UNKNOWN'}`;
  return result;
}

export function fillOrder(orderId, price) {
  const result = fillPaperOrder(orderId, price);
  CONTROL_STATE.lastAction = result?.valid ? 'PAPER_ORDER_FILLED' : `FILL_BLOCKED:${result?.reason || 'UNKNOWN'}`;
  return result;
}

export function updateMarketPrice(symbol, price) {
  const result = markPaperSymbol(symbol, price);
  CONTROL_STATE.lastAction = result?.valid ? 'MARK_UPDATED' : `MARK_BLOCKED:${result?.reason || 'UNKNOWN'}`;
  return result;
}

export function closePosition(symbol, price) {
  const result = closePaperSymbol(symbol, price);
  CONTROL_STATE.lastAction = result?.valid ? 'PAPER_POSITION_CLOSED' : `CLOSE_BLOCKED:${result?.reason || 'UNKNOWN'}`;
  return result;
}

export function resetDailyRisk() {
  const result = resetPaperDailyRisk();
  CONTROL_STATE.lastAction = 'DAILY_RISK_RESET';
  return result;
}

function money(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '--';
}

function renderControlCenter() {
  const app = document.querySelector('#app');
  if (!app || document.querySelector('#paper-control-center')) return;

  const shell = document.createElement('section');
  shell.id = 'paper-control-center';
  shell.className = 'panel';
  shell.innerHTML = `
    <div class="panel-header">
      <div><h3>🧠 AI Trade Pro Control Center</h3><span>Integrated paper trading orchestration</span></div>
      <span class="panel-status" id="ptc-status">PAPER ONLY</span>
    </div>
    <div class="dashboard-grid" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><div><h3>Portfolio</h3><span>Paper account</span></div></div><div id="ptc-portfolio"></div></div>
      <div class="panel"><div class="panel-header"><div><h3>Watchlist</h3><span>Paper-only symbols</span></div></div><div class="api-test-content"><input id="ptc-symbol" placeholder="INFY:NSE" /><button class="primary-btn" id="ptc-add">Add Symbol</button></div><div id="ptc-watchlist"></div></div>
      <div class="panel"><div class="panel-header"><div><h3>Runtime Safety</h3><span>Broker execution locked</span></div></div><div id="ptc-safety"></div></div>
    </div>`;

  const dashboard = app.querySelector('[data-page="dashboard"]');
  (dashboard || app).appendChild(shell);

  shell.querySelector('#ptc-add').addEventListener('click', () => {
    const input = shell.querySelector('#ptc-symbol');
    if (input.value.trim()) addSymbol(input.value.trim());
    input.value = '';
    renderState();
  });

  function renderState() {
    const data = getApplicationControlState();
    const d = data.paper.dashboard || {};
    shell.querySelector('#ptc-portfolio').innerHTML = `
      <div class="market-list">
        <div class="market-row"><span>Capital</span><strong>₹${money(d.capital)}</strong></div>
        <div class="market-row"><span>Equity</span><strong>₹${money(d.equity)}</strong></div>
        <div class="market-row"><span>Realized P&amp;L</span><strong>₹${money(d.realizedPnL)}</strong></div>
        <div class="market-row"><span>Open Positions</span><strong>${d.openPositions ?? 0}</strong></div>
      </div>`;
    shell.querySelector('#ptc-watchlist').innerHTML = data.watchlist.symbols.length
      ? data.watchlist.symbols.map(x => `<div class="market-row"><span>${x.symbol}</span><strong>${x.status || 'ACTIVE'}</strong></div>`).join('')
      : '<div class="empty-state"><p>No symbols added.</p></div>';
    shell.querySelector('#ptc-safety').innerHTML = `
      <div class="market-list">
        <div class="market-row"><span>Paper Only</span><strong>YES</strong></div>
        <div class="market-row"><span>Real Order Placed</span><strong>NO</strong></div>
        <div class="market-row"><span>Runtime Safe</span><strong>${data.paper.safe ? 'YES' : 'NO'}</strong></div>
        <div class="market-row"><span>Last Action</span><strong>${data.lastAction}</strong></div>
      </div>`;
  }

  renderState();
  window.AITradePro = {
    getState: getApplicationControlState,
    addSymbol,
    removeSymbol,
    updateSymbolSignal,
    runPaperScanner,
    stageCandidate,
    fillOrder,
    updateMarketPrice,
    closePosition,
    resetDailyRisk,
    scanPaperCandidates
  };
}

ensureApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderControlCenter, { once: true });
} else {
  setTimeout(renderControlCenter, 0);
}

console.log('AI TRADE PRO — application control center loaded');
