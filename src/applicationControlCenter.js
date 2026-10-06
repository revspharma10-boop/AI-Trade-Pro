// AI TRADE PRO — APPLICATION CONTROL CENTER
// Browser UI facade for paper-only trading. No broker order APIs are imported.

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
import { createWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistSignal, getWatchlistSnapshot } from './watchlistEngine.js';

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
      maxExposurePercent: 70,
      maxDailyLossPercent: 2,
      minCashPercent: 20
    });
    CONTROL_STATE.initialized = true;
  }
}

export function getApplicationControlState() {
  ensureApp();
  return {
    paper: getPaperTradingApplicationState(),
    watchlist: getWatchlistSnapshot(CONTROL_STATE.watchlist),
    scanner: CONTROL_STATE.lastScannerCycle,
    lastAction: CONTROL_STATE.lastAction,
    paperOnly: true,
    realOrderPlaced: false
  };
}
export function addSymbol(symbol) {
  const result=addToWatchlist(CONTROL_STATE.watchlist,symbol);
  CONTROL_STATE.lastAction=result.valid?'WATCHLIST_ADD':'WATCHLIST_BLOCKED';
  return result;
}
export function removeSymbol(symbol) { const r=removeFromWatchlist(CONTROL_STATE.watchlist,symbol); CONTROL_STATE.lastAction=r.valid?'WATCHLIST_REMOVE':'WATCHLIST_BLOCKED'; return r; }
export function updateSymbolSignal(symbol,signal) { return updateWatchlistSignal(CONTROL_STATE.watchlist,symbol,signal); }
export function runPaperScanner(candidates=[]) { ensureApp(); const r=scanPaperCandidates(candidates); CONTROL_STATE.lastScannerCycle=r; CONTROL_STATE.lastAction='SCANNER_COMPLETE'; return r; }
export function stageCandidate(candidate) { const r=stagePaperCandidate(candidate); CONTROL_STATE.lastAction=r?.valid?'PAPER_ORDER_STAGED':'PAPER_STAGE_BLOCKED'; return r; }
export function fillOrder(id,price) { const r=fillPaperOrder(id,price); CONTROL_STATE.lastAction=r?.paperOnly?'PAPER_ORDER_FILL':'PAPER_FILL_BLOCKED'; return r; }
export function updateMarketPrice(symbol,price) { return markPaperSymbol(symbol,price); }
export function closePosition(symbol,price) { const r=closePaperSymbol(symbol,price); CONTROL_STATE.lastAction=r?.paperOnly?'PAPER_POSITION_CLOSE':'PAPER_CLOSE_BLOCKED'; return r; }
export function resetDailyRisk() { return resetPaperDailyRisk(); }

function money(v) { const n=Number(v); return Number.isFinite(n)?n.toLocaleString('en-IN',{maximumFractionDigits:2}):'--'; }

function renderControlCenter() {
  const app=document.querySelector('#app');
  if(!app||document.querySelector('#paper-control-center')) return;
  const shell=document.createElement('section');
  shell.id='paper-control-center'; shell.className='panel';
  shell.innerHTML=`
    <div class="panel-header"><div><h3>🧠 Paper Trading Control Center</h3><span>Simulation runtime — no broker execution capability</span></div><span class="panel-status">PAPER ONLY</span></div>
    <div class="dashboard-grid" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><div><h3>Portfolio</h3><span>Simulated account</span></div></div><div id="ptc-portfolio"></div></div>
      <div class="panel"><div class="panel-header"><div><h3>Watchlist</h3><span>Research symbols</span></div></div><div class="api-test-content"><input id="ptc-symbol" placeholder="INFY:NSE"><button class="primary-btn" id="ptc-add">Add</button></div><div id="ptc-watchlist"></div></div>
      <div class="panel"><div class="panel-header"><div><h3>Runtime Safety</h3><span>Hard execution boundary</span></div></div><div id="ptc-safety"></div></div>
    </div>`;
  (app.querySelector('[data-page="dashboard"]')||app).appendChild(shell);

  function render() {
    const data=getApplicationControlState(), d=data.paper.dashboard||{}, a=d.account||{}, p=d.positions||{}, perf=d.performance||{};
    shell.querySelector('#ptc-portfolio').innerHTML=`<div class="market-list">
      <div class="market-row"><span>Initial Capital</span><strong>₹${money(a.initialCapital)}</strong></div>
      <div class="market-row"><span>Cash</span><strong>₹${money(a.cash)}</strong></div>
      <div class="market-row"><span>Equity</span><strong>₹${money(a.equity)}</strong></div>
      <div class="market-row"><span>Realized P&amp;L</span><strong>₹${money(a.realizedPnL)}</strong></div>
      <div class="market-row"><span>Unrealized P&amp;L</span><strong>₹${money(a.unrealizedPnL)}</strong></div>
      <div class="market-row"><span>Open Positions</span><strong>${p.openCount||0}</strong></div>
      <div class="market-row"><span>Win Rate</span><strong>${perf.winRatePercent||0}%</strong></div></div>`;
    shell.querySelector('#ptc-watchlist').innerHTML=data.watchlist.symbols.length?data.watchlist.symbols.map(x=>`<div class="market-row"><span>${x.symbol}</span><strong>${x.status||'ACTIVE'}</strong></div>`).join(''):'<div class="market-row"><span>Watchlist</span><strong>EMPTY</strong></div>';
    shell.querySelector('#ptc-safety').innerHTML=`<div class="market-list"><div class="market-row"><span>Paper Only</span><strong>YES</strong></div><div class="market-row"><span>Real Orders</span><strong>BLOCKED</strong></div><div class="market-row"><span>Runtime Safe</span><strong>${data.paper.safe?'YES':'NO'}</strong></div><div class="market-row"><span>Last Action</span><strong>${data.lastAction}</strong></div></div>`;
  }
  shell.querySelector('#ptc-add').addEventListener('click',()=>{ const input=shell.querySelector('#ptc-symbol'); if(input.value.trim()) addSymbol(input.value); input.value=''; render(); });
  render();
  window.AITradePro={getState:getApplicationControlState,addSymbol,removeSymbol,updateSymbolSignal,runPaperScanner,stageCandidate,fillOrder,updateMarketPrice,closePosition,resetDailyRisk,scanPaperCandidates};
}
ensureApp();
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',renderControlCenter,{once:true}); else setTimeout(renderControlCenter,0);
console.log('AI TRADE PRO — paper-only application control center loaded');
