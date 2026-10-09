// Android-only app shell: routes the existing, fail-closed paper research engine.
// Tab changes select real instruments and use the existing Analyze button; no mock prices,
// alternative prediction engine, or order submission is introduced.
export const ANDROID_TABS=Object.freeze([
 Object.freeze({id:'nifty',label:'Nifty',heading:'NIFTY 50',caption:'NSE index • 5-minute paper research',
  icon:'trend',instrumentType:'INDEX',symbol:'NIFTY'}),
 Object.freeze({id:'sensex',label:'Sensex',heading:'SENSEX',caption:'BSE index • 5-minute paper research',
  icon:'bars',instrumentType:'INDEX',symbol:'SENSEX'}),
 Object.freeze({id:'options',label:'Options Trade',heading:'Options Trade',
  caption:'CE / PE analysis • verified contracts only',icon:'target',instrumentType:'INDEX',symbol:'NIFTY'}),
 Object.freeze({id:'commodity',label:'Commodity',heading:'MCX Commodity',
  caption:'Gold, Silver & MCX option research',icon:'layers',instrumentType:'MCX',symbol:'GOLD'})
]);
export function androidTabById(id){
 return ANDROID_TABS.find(t=>t.id===id)??ANDROID_TABS[0];
}
export function androidSelectionForTab(id,savedOptions={instrumentType:'INDEX',symbol:'NIFTY'},
 savedCommodity='GOLD'){
 const tab=androidTabById(id);
 if(tab.id==='options'){
  const instrumentType=['INDEX','STOCK'].includes(savedOptions?.instrumentType)?
   savedOptions.instrumentType:'INDEX';
  const symbol=typeof savedOptions?.symbol==='string'&&/^[A-Z0-9_-]{1,35}$/.test(savedOptions.symbol)?
   savedOptions.symbol:instrumentType==='STOCK'?'RELIANCE':'NIFTY';
  return {instrumentType,symbol};
 }
 if(tab.id==='commodity'){
  return {instrumentType:'MCX',
   symbol:typeof savedCommodity==='string'&&/^[A-Z0-9_-]{1,35}$/.test(savedCommodity)?
    savedCommodity:'GOLD'};
 }
 return {instrumentType:tab.instrumentType,symbol:tab.symbol};
}
const ICONS=Object.freeze({
 trend:'<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
 bars:'<path d="M4 20V12M10 20V6M16 20v-9M22 20V3"/>',
 target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>'
});
function make(tag,cls='',value=''){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value)el.textContent=value;
 return el;
}
function selectValue(input,value,eventType){
 if(input.value===value)return;
 input.value=value;
 input.dispatchEvent(new Event(eventType,{bubbles:true}));
}
export function mountAndroidBottomNavigation(){
 const app=document.querySelector('#intraday-recommendation-app .ir-app');
 const panel=app?.querySelector('.ir-auto-option-panel');
 const type=panel?.querySelector('#ir-auto-type'),symbol=panel?.querySelector('#ir-auto-symbol');
 const analyze=panel?.querySelector('#ir-auto-analyze');
 const status=panel?.querySelector('#ir-auto-status');
 const researchLabel=panel?.querySelector('#ir-auto-direction');
 const liveLabel=panel?.querySelector('#ir-live-status');
 const liveFacts=panel?.querySelector('#ir-live-facts');
 if(!app||!panel||!type||!symbol||!analyze||!status||!researchLabel||!liveLabel)return false;
 if(document.querySelector('#android-bottom-tabs'))return true;
 document.body.classList.add('android-native-shell');
 const header=app.querySelector('.ir-header');
 header?.classList.add('android-brand-header');
 const heading=header?.querySelector('h1'),subheading=header?.querySelector('p');
 if(heading)heading.textContent='AI TRADE PRO';
 if(subheading)subheading.textContent='MARKET INTELLIGENCE';
 const summary=make('section','android-market-summary');
 summary.setAttribute('aria-label','Selected market research');
 const kicker=make('div','android-market-kicker','UPSTOX • READ-ONLY MARKET DATA');
 const title=make('h2','android-market-title');
 const caption=make('p','android-market-caption');
 const miniGrid=make('div','android-mini-grid');
 const researchBlock=make('div','android-mini-stat');
 researchBlock.append(make('span','','PAPER SIGNAL'));
 const researchValue=make('strong','android-research-value','WAIT');researchBlock.append(researchValue);
 const quoteBlock=make('div','android-mini-stat');
 quoteBlock.append(make('span','','BROKER LAST PRICE'));
 const quoteValue=make('strong','android-quote-value','AWAITING DATA');quoteBlock.append(quoteValue);
 miniGrid.append(researchBlock,quoteBlock);
 const note=make('p','android-market-note','Paper-only research • No real orders');
 summary.append(kicker,title,caption,miniGrid,note);
 header?.insertAdjacentElement('afterend',summary);
 const nav=make('nav','android-bottom-tabs');
 nav.id='android-bottom-tabs';
 nav.setAttribute('aria-label','AI Trade Pro main navigation');
 const buttons=new Map();
 for(const tab of ANDROID_TABS){
  const button=make('button','android-tab');
  button.type='button';
  button.dataset.tab=tab.id;
  button.setAttribute('aria-label',tab.label);
  button.setAttribute('aria-current','false');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('width','23');svg.setAttribute('height','23');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');
  svg.setAttribute('stroke-linejoin','round');
  // Only built-in static icons; never inject untrusted market data as markup.
  svg.innerHTML=ICONS[tab.icon];
  button.append(svg,make('span','',tab.label));
  button.addEventListener('click',()=>activate(tab.id,true));
  nav.append(button);buttons.set(tab.id,button);
 }
 document.body.append(nav);
 let currentTab='nifty',savedOptions={instrumentType:'INDEX',symbol:'NIFTY'},savedCommodity='GOLD';
 function renderSummary(){
  researchValue.textContent=researchLabel.textContent.trim()||'WAIT';
  // Show only the genuine price from the existing Upstox quote facts.
  const last=[...(liveFacts?.querySelectorAll('.ir-fact')??[])].find(f=>
   f.querySelector('span')?.textContent?.trim()==='Underlying last');
  const brokerLast=last?.querySelector('strong')?.textContent?.trim();
  quoteValue.textContent=brokerLast&&brokerLast!=='NOT CURRENT'?brokerLast:
   liveLabel.textContent.includes('Market closed')?'MARKET CLOSED':'NOT VERIFIED';
 }
 function activate(id,runResearch){
  const previous=currentTab;
  if(previous==='options'&&id!=='options'){
   savedOptions={instrumentType:type.value,symbol:symbol.value.trim().toUpperCase()};
  } else if(previous==='commodity'&&id!=='commodity'){
   savedCommodity=symbol.value.trim().toUpperCase();
  }
  const next=androidTabById(id);
  currentTab=next.id;
  const target=androidSelectionForTab(next.id,savedOptions,savedCommodity);
  // IMPORTANT: dispatch the same change/input events as the existing manual UI.
  // Its reset/version safeguards invalidate stale responses from the former tab.
  selectValue(type,target.instrumentType,'change');
  selectValue(symbol,target.symbol,'input');
  document.body.dataset.androidTab=next.id;
  title.textContent=next.heading;
  caption.textContent=next.caption;
  analyze.textContent='Analyze '+(next.id==='options'?'option setup':
   next.id==='commodity'?'commodity':next.heading);
  for(const [tabId,button] of buttons){
   const selected=tabId===next.id;
   button.classList.toggle('is-active',selected);
   button.setAttribute('aria-current',selected?'page':'false');
  }
  renderSummary();
  if(runResearch&&!analyze.disabled)analyze.click();
  if(runResearch&&typeof window.scrollTo==='function')window.scrollTo({top:0,behavior:'auto'});
 }
 // Both labels are genuine outputs from the original read-only research engine.
 const watcher=new MutationObserver(renderSummary);
 watcher.observe(researchLabel,{childList:true,characterData:true,subtree:true});
 watcher.observe(liveLabel,{childList:true,characterData:true,subtree:true});
 watcher.observe(liveFacts,{childList:true,characterData:true,subtree:true});
 activate('nifty',true);
 return true;
}
