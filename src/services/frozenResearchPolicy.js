// Completed five-minute candle aligned frozen paper research policy.
// Quote polling (30 seconds) never changes this prediction or its levels.
export const RESEARCH_FREEZE_MS=5*60*1000;
export const RESEARCH_SETTLE_DELAY_MS=12*1000; // allows completed candle to settle
export const RESEARCH_FREEZE_SAFETY=Object.freeze({
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function frozenResearchWindow(asOf=Date.now()){
 const now=Number(new Date(asOf));
 if(!finite(now))return {valid:false,slot:null,nextRefreshAt:null,slotReadyAt:null};
 const slot=Math.floor((now-RESEARCH_SETTLE_DELAY_MS)/RESEARCH_FREEZE_MS);
 return {valid:true,slot,slotReadyAt:slot*RESEARCH_FREEZE_MS+RESEARCH_SETTLE_DELAY_MS,
   nextRefreshAt:(slot+1)*RESEARCH_FREEZE_MS+RESEARCH_SETTLE_DELAY_MS};
}
export function frozenResearchState({asOf=Date.now(),capturedSlot=null,hasSelection=false,
 session=null,visible=true,running=false}={}){
 const time=frozenResearchWindow(asOf);
 if(!time.valid)return {status:'INVALID_CLOCK',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
 if(!hasSelection)return {status:'AWAITING_FIRST_ANALYSIS',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
 if(session?.open!==true)return {status:'MARKET_CLOSED',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
 if(visible!==true)return {status:'TAB_NOT_VISIBLE',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
 if(running===true)return {status:'REFRESH_IN_PROGRESS',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
 if(!Number.isSafeInteger(capturedSlot)||capturedSlot<time.slot)
  return {status:'REFRESH_DUE',shouldRefresh:true,...time,...RESEARCH_FREEZE_SAFETY};
 return {status:'FROZEN',shouldRefresh:false,...time,...RESEARCH_FREEZE_SAFETY};
}
