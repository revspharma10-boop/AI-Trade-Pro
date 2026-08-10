// AI TRADE PRO — SIGNAL QUALITY EVALUATION
// Paper observation only. No broker/live-order capability.

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const pct = (a,b) => b > 0 ? (a / b) * 100 : 0;

export function createSignalQualityEngine() {
  const state = { total:0, accepted:0, rejected:0, riskBlocked:0, duplicates:0, falseSignals:0, byAction:{BUY:0,SELL:0,HOLD:0,OTHER:0}, byStrategy:{}, scores:[], outcomes:{wins:0,losses:0,flat:0}, pnl:0, paperOnly:true };
  const ids = new Set();
  function observe(signal = {}) {
    state.total++;
    const action = ['BUY','SELL','HOLD'].includes(String(signal.action).toUpperCase()) ? String(signal.action).toUpperCase() : 'OTHER';
    state.byAction[action]++;
    const strategy = signal.strategy || 'UNSPECIFIED';
    state.byStrategy[strategy] ||= { total:0, accepted:0, rejected:0, riskBlocked:0, wins:0, losses:0, pnl:0 };
    state.byStrategy[strategy].total++;
    const id = signal.id ?? `${signal.symbol}|${action}|${signal.timestamp ?? ''}|${n(signal.price)}`;
    if (ids.has(id) || signal.duplicate) { state.duplicates++; state.rejected++; state.byStrategy[strategy].rejected++; return { accepted:false, reason:'DUPLICATE_SIGNAL' }; }
    ids.add(id);
    const score = n(signal.score); if (Number.isFinite(score)) state.scores.push(score);
    if (signal.riskPassed === false) { state.riskBlocked++; state.rejected++; state.byStrategy[strategy].rejected++; return { accepted:false, reason:'RISK_BLOCKED' }; }
    if (signal.accepted === false) { state.rejected++; state.byStrategy[strategy].rejected++; return { accepted:false, reason:'REJECTED' }; }
    state.accepted++; state.byStrategy[strategy].accepted++; return { accepted:true, reason:'ACCEPTED' };
  }
  function recordOutcome(o = {}) {
    const pnl=n(o.pnl); state.pnl += pnl;
    if (o.falseSignal || o.outcome === 'FALSE') state.falseSignals++;
    if (pnl > 0) state.outcomes.wins++; else if (pnl < 0) state.outcomes.losses++; else state.outcomes.flat++;
    const strategy=o.strategy || 'UNSPECIFIED'; state.byStrategy[strategy] ||= {total:0,accepted:0,rejected:0,riskBlocked:0,wins:0,losses:0,pnl:0};
    if (pnl>0) state.byStrategy[strategy].wins++; if (pnl<0) state.byStrategy[strategy].losses++; state.byStrategy[strategy].pnl += pnl;
  }
  function snapshot(){ const scores=state.scores; return Object.freeze({ ...state, scores:scores.slice(), byAction:{...state.byAction}, byStrategy:JSON.parse(JSON.stringify(state.byStrategy)), scoreStats:{count:scores.length,min:scores.length?Math.min(...scores):0,max:scores.length?Math.max(...scores):0,average:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0}, acceptanceRate:pct(state.accepted,state.total), winRate:pct(state.outcomes.wins,state.outcomes.wins+state.outcomes.losses), realOrderPlaced:false,productionRealTradingEnabled:false }); }
  return Object.freeze({observe,recordOutcome,snapshot});
}
export function assertSignalQualitySafety(s){ return s?.paperOnly===true && s?.realOrderPlaced===false && s?.productionRealTradingEnabled===false; }
console.log('AI TRADE PRO — signal quality engine loaded');
