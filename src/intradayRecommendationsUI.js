import {evaluateIntradayRecommendation} from './services/intradayRecommendationEngine.js';
import {getUpstoxReadOnlyStatus} from './services/upstoxReadOnlyMarketData.js';
export function mountIntradayRecommendations(){
 const root=document.querySelector('#intraday-recommendation-app');if(!root)return;
 root.innerHTML='<section style="padding:22px;border:1px solid #64748b;border-radius:12px;margin:16px 0"><h2>Intraday AI Recommendations</h2><p>Equities · Futures · Options | Recommendation-only · No broker orders</p><label>Instrument <select id="ir-kind"><option value="NSE_EQ">NSE Stock</option><option value="FUT">NSE Future</option><option value="CE">Call Option</option><option value="PE">Put Option</option></select></label> <label>Symbol <input id="ir-symbol" value="RELIANCE" maxlength="50" /></label> <button id="ir-check">Check recommendation</button><p id="ir-status" role="status">No verified intraday recommendation available.</p><pre id="ir-result" style="white-space:pre-wrap"></pre><p>90% success is a research target, not a proven probability. No fabricated entry, stop or target levels.</p></section>';
 root.querySelector('#ir-check').addEventListener('click',async()=>{
 const type=root.querySelector('#ir-kind').value;const symbol=root.querySelector('#ir-symbol').value.trim().toUpperCase();const status=root.querySelector('#ir-status');status.textContent='Checking connection…';
 let connection='UNAVAILABLE';try{const x=await getUpstoxReadOnlyStatus();connection=x.authenticated?'AUTHENTICATED':'LOGIN_REQUIRED';}catch{connection='BACKEND_UNREACHABLE';}
 const instrument=type==='NSE_EQ'?{segment:'NSE_EQ',tradingSymbol:symbol}:{segment:'NSE_FO',instrumentType:type,tradingSymbol:symbol};
 const result=evaluateIntradayRecommendation({instrument});status.textContent='WAIT — no qualified intraday signal';root.querySelector('#ir-result').textContent='Broker: '+connection+'\\nInstrument: '+result.kind+'\\nDecision: '+result.recommendation+'\\nReasons: '+result.reasons.join(', ')+'\\nWin rate: Not validated';
 });
}
mountIntradayRecommendations();
