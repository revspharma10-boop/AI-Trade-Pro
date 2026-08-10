// AI TRADE PRO — PAPER EXECUTION ACCURACY
const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function createPaperExecutionAccuracy(){const s={orders:0,filled:0,rejected:0,slippageTotal:0,fees:0,realizedPnL:0,positionQty:0,paperOnly:true};return Object.freeze({record(o={}){s.orders++;if(o.accepted===false){s.rejected++;return {accepted:false};}s.filled++;s.slippageTotal+=Math.abs(n(o.slippage));s.fees+=Math.max(0,n(o.fee));s.positionQty+=n(o.side)==='SELL'?-n(o.quantity):n(o.quantity);s.realizedPnL+=n(o.pnl);return {accepted:true};},snapshot(){return Object.freeze({...s,avgSlippage:s.filled?s.slippageTotal/s.filled:0,realOrderPlaced:false,productionRealTradingEnabled:false});}})}
export const assertPaperExecutionSafety=s=>s?.paperOnly===true&&s?.realOrderPlaced===false&&s?.productionRealTradingEnabled===false;
console.log('AI TRADE PRO — paper execution accuracy engine loaded');
