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

export function safeRecommendationCard(data,selectedTab,asOf=Date.now()){
 const matches=data&&data.tab===selectedTab&&data.orderSubmissionAllowed===false&&
  data.realOrderPlaced===false&&data.paperOnly===true;
 const last=matches&&data.last&&typeof data.last==='object'?data.last:null;
 const pricesValid=!!last&&['CE','PE'].includes(last.optionType)&&
  typeof last.contract==='string'&&last.contract.trim().length>0&&
  [last.entry,last.stopLoss,last.target].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)&&
  last.stopLoss<last.entry&&last.entry<last.target&&
  last.executionStatus==='NOT EXECUTED'&&last.approvedLots===0&&last.paperOnly===true;
 const hasLast=matches&&pricesValid;
 const observed=hasLast?Date.parse(last.capturedAt):NaN;
 const current=Number.isFinite(observed)&&Number.isFinite(asOf)&&
  observed<=asOf+10000&&Math.floor((observed-12000)/300000)===
    Math.floor((asOf-12000)/300000);
 const active=hasLast&&current&&data.state==='PAPER_SETUP';
 const previous=hasLast&&(data.state==='PAST_PAPER_IDEA'||data.state==='PAPER_SETUP'&&!current);
 return {
  state:active?'PAPER_SETUP':previous?'PAST_PAPER_IDEA':'WAIT',
  tag:active?'PAPER BUY':previous?'PAST PAPER IDEA':'WAIT',
  contract:hasLast?last.contract:'NO VERIFIED OPTION CONTRACT',
  entry:hasLast?money(last.entry):'—',
  target:hasLast?money(last.target):'—',
  stopLoss:hasLast?money(last.stopLoss):'—',
  date:hasLast?date(last.date):'—',
  status:active?'Paper idea · Not executed':
   previous?'Previous idea · Not executed':'No paper trade executed',
  explanation:matches&&typeof data.message==='string'?
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
 card.append(market,chips,facts,details,explanation);

 const foot=make('footer','android-simple-footer');
 const refreshed=make('p','','Automatic read-only refresh while the app is open');
 const connect=make('a','','Connect Upstox');
 connect.href=API+'/auth/upstox/start';
 connect.target='_blank';connect.rel='noopener noreferrer';
 foot.append(refreshed,connect);
 app.append(header,heading,card,foot);
 root.append(app);

 const nav=make('nav','android-simple-nav');
 nav.id='android-bottom-tabs';
 nav.setAttribute('aria-label','AI Trade Pro main navigation');
 const buttons=new Map();
 let current='nifty',sequence=0,loading=false,lastPoll=0;
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
 }
 async function refresh(force=false){
  if(document.hidden||loading)return;
  if(!force&&Date.now()-lastPoll<25000)return;
  const tab=current,version=sequence;
  loading=true;lastPoll=Date.now();
  try{
   const response=await fetch(API+'/api/paper-recommendations/latest?tab='+encodeURIComponent(tab),
    {method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
   if(!response.ok)throw Error('BROKER_BACKEND_UNAVAILABLE');
   const payload=await response.json();
   if(version===sequence)display(payload);
  }catch(_e){
   if(version===sequence)display({tab,state:'WAIT',last:null,message:'Broker data unavailable — WAIT',
    paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
  }finally{
   loading=false;
   // A tab switch during a request should not strand the new tab on "Loading".
   if(version!==sequence)void refresh(true);
  }
 }
 function activate(id){
  const tab=androidTabById(id);current=tab.id;sequence++;lastPoll=0;
  marketName.textContent=tab.heading;marketCaption.textContent=tab.caption;
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
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh(true);});
 activate('nifty');
 return true;
}
