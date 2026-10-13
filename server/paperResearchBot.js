// Best-effort automatic paper research while the free Render process is awake.
// Never submits broker orders, simulates fills, or promises durable storage.
import {marketClockState,publishedEquitySession2026} from '../src/services/intradayMarketClock.js';

export const PAPER_BOT_SAFETY=Object.freeze({
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 productionRealTradingEnabled:false,approvedLots:0
});
const OFFSET=330*60000,FIVE=300000,GRACE=12000;
const iso=ms=>new Date(ms).toISOString();
function eligible(asOf){
 if(!Number.isFinite(asOf))return {ready:false,reason:'INVALID_CLOCK'};
 const session=marketClockState({segment:'NSE_INDEX',asOf});
 const schedule=publishedEquitySession2026({segment:'NSE_INDEX',asOf});
 if(!session.open||!schedule.regularSessionPlanned)
  return {ready:false,reason:schedule.regularSessionPlanned?session.reason:schedule.reason};
 const ist=new Date(asOf+OFFSET),mins=ist.getUTCHours()*60+ist.getUTCMinutes();
 if(mins<570||mins>=915)return {ready:false,reason:'OUTSIDE_BOT_RESEARCH_WINDOW'};
 // The one-minute ORB model needs a fresh completed candle after 09:30.
 // Keep 5-minute cadence outside its early research window; check at most
 // once per 1-minute slot from 09:32 to 10:29 IST while this host is awake.
 const early=mins>=572&&mins<630;
 const step=early?60000:FIVE;
 const slot=Math.floor((asOf-GRACE)/step),age=asOf-(slot*step+GRACE);
 if(age<0||age>(early?45000:90000))
  return {ready:false,reason:'NEXT_COMPLETED_CANDLE_WINDOW'};
 return {ready:true,slot:(early?'1m:':'5m:')+slot};
}
export function createPaperResearchBot({feed,now=()=>Date.now(),tabs=['nifty','sensex'],
 intervalMs=30000,setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}){
 if(!feed||typeof feed.getLatest!=='function'||!tabs.length||
  !tabs.every(tab=>['nifty','sensex'].includes(tab)))
  throw Error('PAPER_BOT_VERIFIED_DEPENDENCIES_REQUIRED');
 let timer=null,inflight=false,lastSlot=null,cycles=0,lastAttemptAt=null,lastCompletedAt=null;
 let nextReason='AWAITING_COMPLETED_CANDLE',results={};
 const getStatus=()=>({
  state:timer?'RUNNING_WHILE_SERVER_AWAKE':'NOT_STARTED',
  cadence:'1M_COMPLETED_CANDLE_SLOTS_0932_1029__5M_OTHERWISE',
  lastAttemptAt,lastCompletedAt,completedCycles:cycles,
  latest:{...results},nextReason,
  processLocal:true,recordedDurably:false,
  browserRequired:false,freeHostMaySleep:true,
  ...PAPER_BOT_SAFETY
 });
 async function tick(at=now()){
  if(inflight)return getStatus();
  const window=eligible(at);
  nextReason=window.ready?'READY':window.reason;
  if(!window.ready||window.slot===lastSlot)return getStatus();
  lastSlot=window.slot;
  lastAttemptAt=iso(at);
  inflight=true;
  try{
   const settled=await Promise.all(tabs.map(async tab=>{
    try{
     const r=await feed.getLatest(tab,at);
     return {tab,state:r?.state==='PAPER_SETUP'?'PAPER_SETUP':'WAIT',
      stage:typeof r?.stage==='string'&&/^[A-Z_]{3,60}$/.test(r.stage)?r.stage:null,
      blockerCount:Number.isSafeInteger(r?.blockerCount)?r.blockerCount:null,
      checkedAt:typeof r?.lastCheckedAt==='string'?r.lastCheckedAt:null};
    }catch(_error){return {tab,state:'WAIT',stage:'DATA_UNAVAILABLE',blockerCount:null,checkedAt:null};}
   }));
   results=Object.fromEntries(settled.map(({tab,...rest})=>[tab,rest]));
   lastCompletedAt=iso(now());
   cycles++;
  }finally{inflight=false;}
  return getStatus();
 }
 function start(){
  if(timer)return getStatus();
  timer=setIntervalFn(()=>{void tick().catch(()=>{nextReason='RESEARCH_CYCLE_ERROR';});},intervalMs);
  if(typeof timer?.unref==='function')timer.unref();
  return getStatus();
 }
 function stop(){if(timer)clearIntervalFn(timer);timer=null;return getStatus();}
 return {start,stop,tick,getStatus};
}
