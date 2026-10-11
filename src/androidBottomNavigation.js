// Personal Android edition: four minimalist last-recommendation screens.
// All candle/technical/contract/option-margin research is calculated on Render.
// The device receives a read-only summary; no trade orders or fake premiums.
export const ANDROID_TABS=Object.freeze([
 Object.freeze({id:'nifty',label:'Nifty',heading:'NIFTY 50',caption:'NSE index option research',icon:'trend'}),
 Object.freeze({id:'sensex',label:'Sensex',heading:'SENSEX',caption:'BSE index option research',icon:'bars'}),
 Object.freeze({id:'options',label:'Options Trade',heading:'Stock Options',caption:'INFY option research',icon:'target'}),
 Object.freeze({id:'commodity',label:'Commodity',heading:'Commodity',caption:'MCX GOLD option research',icon:'layers'})
]);
export function androidTabById(id){return ANDROID_TABS.find(t=>t.id===id)??ANDROID_TABS[0];}
const ICONS=Object.freeze({
 trend:'<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
 bars:'<path d="M4 20V12M10 20V6M16 20v-9M22 20V3"/>',
 target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>'
});
const API=import.meta.env?.VITE_UPSTOX_READONLY_API_BASE||
 'https://ai-trade-pro-oauth.onrender.com';
const make=(tag,className='',text='')=>{
 const el=document.createElement(tag);if(className)el.className=className;
 el.textContent=text;return el;
};
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?
 '₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const date=n=>typeof n==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(n)?
 n.slice(8,10)+'/'+n.slice(5,7)+'/'+n.slice(0,4):'—';
const STAGE_LABELS=Object.freeze({
 MARKET_SESSION:'MARKET SESSION',
 UNDERLYING:'UNDERLYING INSTRUMENT',
 UPSTOX_DATA:'BROKER MARKET DATA',
 OPENING_RANGE:'OPENING RANGE',
 UNDERLYING_TECHNICAL:'FIVE-MINUTE TECHNICAL SIGNAL',
 OPTION_CONTRACT:'OPTION CONTRACT',
 OPTION_PREMIUM_AND_RISK:'OPTION PREMIUM AND RISK',
 MCX_UNDERLYING:'COMMODITY UNDERLYING',
 MCX_TECHNICAL:'COMMODITY TECHNICAL SIGNAL',
 MCX_CONTRACT:'COMMODITY OPTION CONTRACT',
 MCX_OPTION_QUALIFICATION:'COMMODITY PREMIUM AND RISK'
});
const NOT_CHECKED_STAGES=new Set([
 'MARKET_SESSION','UNDERLYING','UPSTOX_DATA','OPENING_RANGE',
 'UNDERLYING_TECHNICAL','MCX_UNDERLYING','MCX_TECHNICAL'
]);

export function safeRecommendationCard(data,selectedTab,asOf=Date.now()){
 const matches=data&&data.tab===selectedTab&&data.orderSubmissionAllowed===false&&
  data.realOrderPlaced===false&&data.paperOnly===true;
 const last=matches&&data.last&&typeof data.last==='object'?data.last:null;
 const pricesValid=!!last&&['CE','PE'].includes(last.optionType)&&
  typeof last.contract==='string'&&last.contract.trim().length>0&&
  [last.entry,last.stopLoss,last.target].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)&&
  last.stopLoss<last.entry&&last.entry<last.target&&
  last.executionStatus==='NOT EXECUTED'&&last.approvedLots===0&&last.paperOnly===true&&
  last.orderSubmissionAllowed!==true&&last.realOrderPlaced!==true;
 const hasLast=matches&&pricesValid;
 const lastObserved=hasLast?Date.parse(last.capturedAt):NaN;
 const lastTimestampValid=Number.isFinite(lastObserved)&&
  Number.isFinite(asOf)&&lastObserved<=asOf+10000;
 // A successful browser fetch is NOT proof that server-side market research
 // was freshly evaluated. The read-only backend supplies lastCheckedAt.
 const checkedText=matches?data.lastCheckedAt:null;
 const checkedAt=typeof checkedText==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(checkedText)?
  Date.parse(checkedText):NaN;
 const checkedClockValid=Number.isFinite(asOf)&&Number.isFinite(checkedAt)&&
  checkedAt<=asOf+10000;
 // Allow one frozen five-minute research slot, but fail closed on old cache.
 const backendFresh=checkedClockValid&&asOf-checkedAt<=6*60000;
 const backendConsistent=!hasLast||checkedAt>=lastObserved-10000;
 // Broker-confirmed exchange metadata may be shown during WAIT, but never
 // interpreted as verified option premium, entry, SL, target, or trade approval.
 const candidate=matches&&!hasLast&&data.state==='WAIT'?data.verifiedContract:null;
 const marketDate=new Date(asOf+330*60000).toISOString().slice(0,10);
 const hasCandidate=!!candidate&&candidate.paperOnly===true&&
  candidate.orderSubmissionAllowed===false&&
  ['CE','PE'].includes(candidate.optionType)&&
  typeof candidate.tradingSymbol==='string'&&candidate.tradingSymbol.trim().length>0&&
  typeof candidate.strike==='number'&&candidate.strike>0&&
  /^\d{4}-\d{2}-\d{2}$/.test(candidate.expiry??'')&&candidate.expiry>marketDate;
 const current=lastTimestampValid&&
  Math.floor((lastObserved-12000)/300000)===
    Math.floor((asOf-12000)/300000);
 const active=hasLast&&current&&data.state==='PAPER_SETUP'&&
  backendFresh&&backendConsistent;
 const blockedStaleSetup=hasLast&&current&&data.state==='PAPER_SETUP'&&!active;
 const previous=hasLast&&lastTimestampValid&&
  (data.state==='PAST_PAPER_IDEA'||data.state==='PAPER_SETUP'&&!current);
 const early=matches&&data.state==='WAIT'?data.provisionalDirection:null;
 const earlyTime=typeof early?.observedAt==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(early.observedAt)?
  Date.parse(early.observedAt):NaN;
 const earlySafe=backendFresh&&checkedClockValid&&!previous&&!active&&
  ['nifty','sensex'].includes(selectedTab)&&
  early?.kind==='PROVISIONAL_DIRECTION'&&
  early.strategy==='OPENING_RANGE_15M'&&
  ['BULLISH','BEARISH'].includes(early.direction)&&
  early.source==='UPSTOX_READ_ONLY'&&early.recordedDurably===false&&
  early.optionPlanQualified===false&&early.paperOnly===true&&
  early.orderSubmissionAllowed===false&&early.realOrderPlaced===false&&
  !['contract','strike','expiry','entry','stopLoss','target','lots'].some(k=>Object.hasOwn(early,k))&&
  Number.isFinite(earlyTime)&&earlyTime<=asOf+10000&&
  checkedAt>=earlyTime-10000&&
  Math.floor((earlyTime-12000)/300000)===Math.floor((asOf-12000)/300000);
 const activeWait=matches&&!active&&!previous;
 const stage=activeWait&&Object.hasOwn(STAGE_LABELS,data.stage??'')?data.stage:null;
 const failures=activeWait&&Array.isArray(data.blockers)?
  data.blockers.filter(x=>x&&typeof x.code==='string'&&/^[A-Z0-9_]{4,110}$/.test(x.code)&&
   typeof x.message==='string'&&x.message.length>0&&x.message.length<=220).slice(0,8):[];
 const count=activeWait&&Number.isSafeInteger(data.blockerCount)&&
  data.blockerCount>=failures.length&&data.blockerCount<=100?
  data.blockerCount:failures.length;
 return {
  state:active?'PAPER_SETUP':previous?'PAST_PAPER_IDEA':'WAIT',
  provisionalDirection:earlySafe?{
   label:early.direction,observedAt:new Date(earlyTime).toLocaleTimeString('en-IN',{
    timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' IST'
  }:null,
  tag:active?'PAPER BUY':previous?'PAST PAPER IDEA':'WAIT',
  contract:(active||previous)?last.contract:hasCandidate?
   candidate.tradingSymbol:stage&&NOT_CHECKED_STAGES.has(stage)?
    'OPTION CONTRACT NOT CHECKED':'NO VERIFIED OPTION CONTRACT',
  entry:(active||previous)?money(last.entry):'—',
  target:(active||previous)?money(last.target):'—',
  stopLoss:(active||previous)?money(last.stopLoss):'—',
  date:(active||previous)?date(last.date):'—',
  status:active?'Paper idea · Not executed':
   previous?'Previous idea · Not executed':hasCandidate?
    'Contract verified · Setup WAIT':'No paper trade executed',
  diagnosticStage:stage?STAGE_LABELS[stage]:null,
  failedChecks:failures.slice(0,3).map(x=>({code:x.code,message:x.message})),
  otherChecks:Math.max(0,count-Math.min(3,failures.length)),
  backendStatus:!checkedClockValid?'Backend research time: unverified':
   !backendFresh?'Backend research: stale · WAIT':
   !backendConsistent?'Backend research: timestamp mismatch · WAIT':
   'Backend research checked '+new Date(checkedAt).toLocaleString('en-IN',{
    timeZone:'Asia/Kolkata',day:'2-digit',month:'short',
    hour:'2-digit',minute:'2-digit',second:'2-digit'})+' IST',
  explanation:blockedStaleSetup?
   'Backend research timestamp missing, stale, or inconsistent — WAIT until revalidated':
   matches&&typeof data.message==='string'?
    data.message:'Awaiting verified broker research'
 };
}
export function mountAndroidBottomNavigation(){
 const root=document.querySelector('#intraday-recommendation-app');
 if(!root)return false;
 document.body.classList.add('android-minimal-shell');
 root.replaceChildren();
 const app=make('main','android-simple-app');
 const header=make('header','android-simple-header');
 const brand=make('div','android-simple-brand');
 const logo=make('span','android-simple-logo','↗');
 const brandText=make('div','android-simple-brand-text');
 brandText.append(make('strong','','AI TRADE PRO'),
  make('span','','PAPER MARKET RESEARCH'));
 brand.append(logo,brandText);
 const paper=make('span','android-simple-safe','PAPER ONLY');
 header.append(brand,paper);

 const heading=make('section','android-simple-heading');
 const topLine=make('span','android-simple-kicker','LAST RECOMMENDATION');
 const title=make('h1','','Last Recommendation');
 const subtitle=make('p','','Verified paper results only');
 heading.append(topLine,title,subtitle);

 const card=make('section','android-simple-card');
 card.setAttribute('aria-label','Last paper recommendation');
 const market=make('div','android-simple-market');
 const marketName=make('strong','','NIFTY 50');
 const marketCaption=make('span','','NSE index option research');
 market.append(marketName,marketCaption);
 const chips=make('div','android-simple-chips');
 const action=make('span','android-simple-action is-wait','WAIT');
 const contract=make('strong','android-simple-contract','NO VERIFIED OPTION CONTRACT');
 chips.append(action,contract);

 const facts=make('div','android-simple-facts');
 function fact(labelName){
  const item=make('div','android-simple-fact');
  const number=make('strong','','—');
  item.append(number,make('span','',labelName));facts.append(item);
  return number;
 }
 const buy=fact('Reco Price'),target=fact('Target Price'),stop=fact('Stop Loss');
 const details=make('div','android-simple-details');
 function detail(labelName){
  const item=make('div','android-simple-detail');
  const value=make('strong','','—');
  item.append(value,make('span','',labelName));details.append(item);
  return value;
 }
 const observedDate=detail('Date'),tradeStatus=detail('Status');
 const explanation=make('p','android-simple-message','Waiting for verified broker data');
 explanation.setAttribute('role','status');
 explanation.setAttribute('aria-live','polite');
 const directional=make('section','android-simple-direction');
 directional.setAttribute('aria-label','Provisional market direction without option trade');
 directional.hidden=true;
 const directionalLabel=make('strong','android-simple-direction-value');
 const directionalTime=make('span','android-simple-direction-time');
 directional.append(
  make('span','android-simple-direction-title','OPENING RANGE · DIRECTION ONLY'),
  directionalLabel,directionalTime,
  make('p','android-simple-direction-note',
   'Unvalidated market hypothesis • Not a CE/PE entry • No option order or recorded result'));
 const diagnostics=make('section','android-simple-diagnostics');
 diagnostics.setAttribute('aria-label','Why the paper recommendation is waiting');
 diagnostics.hidden=true;
 const diagnosticHeading=make('strong','android-simple-diagnostic-title','WHY WAIT?');
 const diagnosticStage=make('span','android-simple-diagnostic-stage');
 const diagnosticList=make('ul','android-simple-diagnostic-list');
 const diagnosticMore=make('p','android-simple-diagnostic-more');
 diagnostics.append(diagnosticHeading,diagnosticStage,diagnosticList,diagnosticMore);
 card.append(market,chips,facts,details,explanation,directional,diagnostics);

 const foot=make('footer','android-simple-footer');
 const refreshed=make('p','','Read-only updates every 30 seconds while visible');
 refreshed.setAttribute('role','status');
 const backendChecked=make('p','','Backend research time: unverified');
 const manualRefresh=make('button','android-simple-manual-refresh','Refresh now');
 manualRefresh.type='button';
 manualRefresh.setAttribute('aria-label','Refresh current market research now');
 manualRefresh.addEventListener('click',()=>{void refresh(true);});
 const connect=make('a','','Connect Upstox');
 connect.href=API+'/auth/upstox/start';
 connect.target='_blank';connect.rel='noopener noreferrer';
 foot.append(refreshed,backendChecked,manualRefresh,connect);
 app.append(header,heading,card,foot);
 root.append(app);

 const nav=make('nav','android-simple-nav');
 nav.id='android-bottom-tabs';
 nav.setAttribute('aria-label','AI Trade Pro main navigation');
 const buttons=new Map();
 let current='nifty',sequence=0,loading=false,lastPoll=0;
 let pendingTabRefresh=false;
 for(const tab of ANDROID_TABS){
  const button=make('button','android-simple-tab');
  button.type='button';button.dataset.tab=tab.id;
  button.setAttribute('aria-label',tab.label);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','23');
  svg.setAttribute('height','23');svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.innerHTML=ICONS[tab.icon]; // static, local icons only
  button.append(svg,make('span','',tab.label));
  button.addEventListener('click',()=>activate(tab.id));
  buttons.set(tab.id,button);nav.append(button);
 }
 document.body.append(nav);
 function display(data){
  const view=safeRecommendationCard(data,current);
  action.textContent=view.tag;
  action.className='android-simple-action '+(view.state==='PAPER_SETUP'?'is-buy':
   view.state==='PAST_PAPER_IDEA'?'is-past':'is-wait');
  contract.textContent=view.contract;
  buy.textContent=view.entry;
  target.textContent=view.target;
  stop.textContent=view.stopLoss;
  observedDate.textContent=view.date;
  tradeStatus.textContent=view.status;
  explanation.textContent=view.explanation;
  backendChecked.textContent=view.backendStatus;
  directional.hidden=!view.provisionalDirection;
  directionalLabel.textContent=view.provisionalDirection?.label??'';
  directionalLabel.className='android-simple-direction-value '+(
   view.provisionalDirection?.label==='BULLISH'?'is-bullish':
   view.provisionalDirection?.label==='BEARISH'?'is-bearish':'');
  directionalTime.textContent=view.provisionalDirection?.observedAt??'';
  diagnostics.hidden=view.state!=='WAIT'||view.failedChecks.length===0;
  diagnosticStage.textContent=view.diagnosticStage??'RESEARCH DATA';
  diagnosticList.replaceChildren();
  for(const check of view.failedChecks){
   // DOM textContent prevents Upstox-originated messages from inserting markup.
   diagnosticList.append(make('li','',check.message));
  }
  diagnosticMore.textContent=view.otherChecks>0?
   '+'+view.otherChecks+' additional blocker'+(view.otherChecks===1?'':'s')+
   ' recorded by the backend':'';
 }
 async function refresh(force=false){
  if(document.hidden)return;
  if(loading){
   if(force)pendingTabRefresh=true;
   return;
  }
  if(!force&&Date.now()-lastPoll<25000)return;
  const tab=current,version=sequence;
  loading=true;lastPoll=Date.now();
  manualRefresh.disabled=true;
  try{
   const response=await fetch(API+'/api/paper-recommendations/latest?tab='+encodeURIComponent(tab),
    {method:'GET',headers:{Accept:'application/json'},cache:'no-store',
     signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('BROKER_BACKEND_UNAVAILABLE');
   const payload=await response.json();
   if(version===sequence&&!document.hidden){
    display(payload);
    refreshed.textContent='Browser received '+new Date().toLocaleTimeString('en-IN',{
     hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Kolkata'
    })+' IST · 30-second refresh while visible';
   }
  }catch(_e){
   if(version===sequence&&!document.hidden){
    display({tab,state:'WAIT',last:null,message:'Broker unavailable or timed out — WAIT',
     paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
    refreshed.textContent='Broker connection unavailable · Retrying automatically';
   }
  }finally{
   loading=false;
   manualRefresh.disabled=false;
   // One pending tab/visibility change is replayed after the in-flight request.
   // Avoid recursive polling loops when an upstream request is slow.
   if(version!==sequence||pendingTabRefresh){
    pendingTabRefresh=false;
    if(!document.hidden)void refresh(true);
   }
  }
 }
 function activate(id){
  const tab=androidTabById(id);current=tab.id;sequence++;lastPoll=0;
  marketName.textContent=tab.heading;marketCaption.textContent=tab.caption;
  refreshed.textContent='Checking broker research · Paper-only mode';
  manualRefresh.disabled=loading;
  for(const [tabId,button] of buttons){
   const active=tab.id===tabId;
   button.classList.toggle('is-active',active);
   button.setAttribute('aria-current',active?'page':'false');
  }
  display({tab:tab.id,state:'WAIT',message:'Checking latest verified paper recommendation…',
   paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
  void refresh(true);
 }
 setInterval(()=>{void refresh();},30000);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)void refresh(true);
  else refreshed.textContent='Paused while browser is hidden · PAPER ONLY';
 });
 activate('nifty');
 return true;
}
