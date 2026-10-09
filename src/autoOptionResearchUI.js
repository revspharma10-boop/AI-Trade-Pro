// Dedicated two-field NSE and MCX long-options paper research.
import {getUpstoxReadOnlyStatus,searchUpstoxIndex,searchUpstoxEquity,getUpstoxIntradayCandles,
 getUpstoxLiveQuote,getUpstoxOptionContracts,getUpstoxPaperMarginQuote} from './services/upstoxReadOnlyMarketData.js';
import {extractUpstoxLiveQuoteEvidence} from './services/intradayRiskEngine.js';
import {analyzeIntradayCandles} from './services/intradayTechnicalEngine.js';
import {marketClockState} from './services/intradayMarketClock.js';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan} from './services/autoOptionResearchEngine.js';
import {chooseMcxOptionUnderlying,deriveMcxOptionDirection,chooseMcxOptionContract,calculateMcxOptionPaperPlan} from './services/mcxAutoOptionResearchEngine.js';
import {searchUpstoxDerivatives} from './services/upstoxReadOnlyMarketData.js';
import {describeMcxTechnicalSetup} from './services/mcxWaitDiagnostics.js';
import {MARKET_QUOTE_POLL_MS,assessMarketQuote,mayPollMarketQuote} from './services/marketQuoteRefreshPolicy.js';
import {frozenResearchWindow,frozenResearchState} from './services/frozenResearchPolicy.js';
import {deriveOpeningRangeBias,openingRangeProgress} from './services/openingRangeResearch.js';

const fmt=n=>typeof n==='number'&&Number.isFinite(n)?'₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'NOT VERIFIED';
const time=n=>Number.isFinite(n)?new Date(n).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:true}):'NOT VERIFIED';
function element(tag,text,css=''){
 const node=document.createElement(tag);node.textContent=text;if(css)node.className=css;return node;
}
function row(parent,name,value){
 const box=element('div','','ir-fact'),a=element('span',name),b=element('strong',String(value));
 box.append(a,b);parent.append(box);
}
function candlesChart(container,raw,asOf){
 container.replaceChildren();
 const day=new Date(asOf+330*60000).toISOString().slice(0,10);
 const valid=(Array.isArray(raw)?raw:[]).filter(x=>{
  const stamp=Date.parse(x.datetime);
  return Number.isFinite(stamp)&&new Date(stamp+330*60000).toISOString().slice(0,10)===day&&
   stamp+5*60000+10000<=asOf&&
   [x.high,x.low,x.open,x.close].every(n=>typeof n==='number'&&Number.isFinite(n))&&
   x.low>0&&x.high>=x.low&&x.open>=x.low&&x.open<=x.high&&x.close>=x.low&&x.close<=x.high;
 }).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)).slice(-60);
 if(!valid.length){container.textContent='No completed underlying candles to plot.';return;}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 760 240');svg.setAttribute('role','img');svg.setAttribute('class','ir-option-chart-svg');
 svg.setAttribute('aria-label','Completed 5 minute underlying candlestick chart: green up candles, red down candles');
 const title=document.createElementNS(ns,'title');title.textContent='Completed underlying intraday candles (not option premium)';svg.append(title);
 const low=Math.min(...valid.map(x=>x.low)),high=Math.max(...valid.map(x=>x.high)),range=Math.max(0.01,high-low);
 const y=v=>15+(high-v)/range*190,step=710/valid.length;
 for(let i=0;i<5;i++){const line=document.createElementNS(ns,'line');line.setAttribute('x1','24');line.setAttribute('x2','740');line.setAttribute('y1',String(15+i*47.5));line.setAttribute('y2',String(15+i*47.5));line.setAttribute('stroke','#334155');svg.append(line);}
 valid.forEach((c,i)=>{
  const center=24+(i+0.5)*step,color=c.close>=c.open?'#4ade80':'#fb7185';
  const wick=document.createElementNS(ns,'line');
  wick.setAttribute('x1',String(center));wick.setAttribute('x2',String(center));
  wick.setAttribute('y1',String(y(c.high)));wick.setAttribute('y2',String(y(c.low)));
  wick.setAttribute('stroke',color);wick.setAttribute('stroke-width','1.5');svg.append(wick);
  const body=document.createElementNS(ns,'rect');
  const top=Math.min(y(c.open),y(c.close)),bottom=Math.max(y(c.open),y(c.close));
  const width=Math.max(3,step*.65);
  body.setAttribute('x',String(center-width/2));body.setAttribute('y',String(top));
  body.setAttribute('width',String(width));body.setAttribute('height',String(Math.max(1.5,bottom-top)));
  body.setAttribute('fill',color);svg.append(body);
 });
 container.append(svg,element('p',valid.length+' completed 5m candles • Last close '+fmt(valid.at(-1).close)+' • '+time(Date.parse(valid.at(-1).datetime))+' IST','ir-muted'));
}
export function mountAutoOptionResearch(){
 const root=document.querySelector('#intraday-recommendation-app');
 if(!root)return;
 // Only automatic CE/PE research and the paper-demo journal are mounted.
 // Existing contract search and analysis services remain available to the backend.
 root.innerHTML='<main class="ir-app">'+
  '<header class="ir-header"><span class="ir-logo">↗</span><div>'+
  '<h1>AI TRADE PRO</h1><p>Automatic intraday CE/PE research • Paper demo</p></div>'+
  '<span class="ir-safety">REAL ORDERS BLOCKED</span></header>'+
  '<footer>Upstox read-only market data • Real orders disabled</footer></main>';
 const app=root.querySelector('.ir-app');
 const panel=document.createElement('section');panel.className='ir-panel ir-auto-option-panel';
 panel.innerHTML=[
  '<h2>One-click CALL / PUT research <span class="ir-safety">PAPER ONLY</span></h2>',
  '<p class="ir-muted">Choose just the instrument type and symbol. NSE and MCX research require fresh candles and an authenticated Upstox data connection.</p>',
  '<div class="ir-auto-controls"><label>Instrument type<select id="ir-auto-type"><option value="INDEX">NIFTY / BANKNIFTY / SENSEX Options — Auto CE/PE</option><option value="STOCK">NSE Stock Options — Auto CE/PE</option><option value="MCX">MCX Commodity Options — Auto CE/PE</option></select></label>',
  '<label>Symbol<input id="ir-auto-symbol" value="NIFTY" maxlength="35" autocomplete="off" spellcheck="false" placeholder="NIFTY / RELIANCE / GOLD / SILVER"></label></div>',
  '<div class="ir-actions"><button class="ir-primary" id="ir-auto-analyze" type="button">Analyze chart &amp; find CE / PE</button><a href="https://ai-trade-pro-oauth.onrender.com/auth/upstox/start" target="_blank" rel="noopener noreferrer">Connect Upstox</a></div>',
  '<p id="ir-auto-status" class="ir-status" role="status" aria-live="polite">Select instrument and symbol, then analyze.</p>',
  '<section class="ir-freeze-panel" aria-label="Frozen five-minute research snapshot">',
  '<div class="ir-freeze-head"><h3>Frozen 5-minute prediction</h3><strong id="ir-freeze-state">AWAITING ANALYSIS</strong></div>',
  '<div class="ir-freeze-times"><span id="ir-freeze-taken">Snapshot: not captured</span><span id="ir-freeze-next">Next update: after analysis</span></div>',
  '<p class="ir-muted">CALL/PUT/WAIT, option premium entry, stop and targets freeze for each 5-minute candle interval. They update automatically after the next candle completes. Broker quotes refresh independently every 30 seconds.</p></section>',
  '<section id="ir-live-panel" class="ir-live-panel" aria-label="30-second read-only Upstox price refresh">',
  '<div class="ir-live-head"><h3>Broker quote • 30-second refresh</h3><span id="ir-live-status">Awaiting analysis</span></div>',
  '<div id="ir-live-facts" class="ir-facts"></div>',
  '<p class="ir-muted">Read-only Upstox quotes update approximately every 30 seconds while this tab is visible and the market is open. Not a live WebSocket stream. Strategy candles are 5-minute bars; predictions update after each completed 5-minute candle.</p></section>',
  '<section id="ir-opening-evidence" class="ir-opening-evidence" hidden><h3>09:15–09:30 Opening Range — Provisional Direction Only</h3>',
  '<div id="ir-opening-facts" class="ir-facts"></div><p id="ir-opening-notes" class="ir-muted"></p></section>',
  '<div class="ir-decision ir-option-result"><h3>Option research result</h3><span class="ir-paper-wait" id="ir-auto-direction">WAIT</span></div>',
  '<section id="ir-color-option-card" class="ir-color-option-card ir-card-wait" aria-label="Color-coded paper option prediction" aria-live="polite">',
  '<div class="ir-card-heading"><div><span class="ir-card-overline">OPTION CHAIN • PROVISIONAL PAPER RESEARCH</span>',
  '<h3 id="ir-card-contract">NO VERIFIED OPTION CONTRACT</h3><p id="ir-card-expiry">Strike / expiry not verified</p></div>',
  '<span id="ir-card-state" class="ir-card-state">WAIT</span></div>',
  '<div class="ir-card-prices">',
  '<div class="ir-price-tile ir-price-buy"><span>BUY AT • PREMIUM</span><strong id="ir-card-buy">NOT VERIFIED</strong></div>',
  '<div class="ir-price-tile ir-price-stop"><span>STOP LOSS</span><strong id="ir-card-stop">NOT VERIFIED</strong></div>',
  '<div class="ir-price-tile ir-price-t1"><span>1ST TARGET • 1.5R</span><strong id="ir-card-t1">NOT VERIFIED</strong></div>',
  '<div class="ir-price-tile ir-price-t2"><span>2ND TARGET • 2R</span><strong id="ir-card-t2">NOT VERIFIED</strong></div>',
  '<div class="ir-price-tile ir-price-t3"><span>3RD TARGET • 3R</span><strong id="ir-card-t3">NOT VERIFIED</strong></div>',
  '</div>',
  '<div class="ir-card-footer"><span id="ir-card-lots">Theoretical lots: NOT VERIFIED</span>',
  '<span>₹50,000 capital • ₹500 planned risk • <b>0 REAL ORDERS</b></span></div>',
  '<p id="ir-card-warning" class="ir-card-warning">WAIT — Premium, stop, targets and contract require verified broker evidence. No option order is authorized.</p>',
  '</section>',
  '<p class="ir-paper-warning">Illustrative long-option premium prices, not instructions or order previews. ₹50,000 capital, ₹500 planned risk. Real trading is disabled.</p>',
  '<h3>Underlying 5-minute candle chart</h3><div class="ir-option-chart" id="ir-auto-chart">Awaiting fresh market data.</div>',
  '<section id="ir-mcx-evidence" class="ir-mcx-evidence" hidden><h3>MCX futures technical evidence</h3><div id="ir-mcx-facts" class="ir-facts"></div><h3>CALL vs PUT confirmation checklist</h3><p class="ir-muted" id="ir-mcx-confirm-summary"></p><div id="ir-mcx-checks" class="ir-mcx-checks"></div></section>',
  '<div id="ir-auto-results" class="ir-facts"></div><h3>Qualification and WAIT reasons</h3><ul id="ir-auto-blocks" class="ir-reasons"></ul>',
  '<p class="ir-note">Contract discovery, option selection and risk checks run automatically. Manual advanced search is not required.</p>'
 ].join('');
 const header=app.querySelector('.ir-header');header.insertAdjacentElement('afterend',panel);
 const find=id=>panel.querySelector('#'+id),type=find('ir-auto-type'),symbol=find('ir-auto-symbol');
 const button=find('ir-auto-analyze'),status=find('ir-auto-status'),result=find('ir-auto-results');
 const blocks=find('ir-auto-blocks'),label=find('ir-auto-direction'),chart=find('ir-auto-chart');
 const colorCard=find('ir-color-option-card');
 const mcxEvidence=find('ir-mcx-evidence'),mcxFacts=find('ir-mcx-facts');
 const mcxChecklist=find('ir-mcx-checks'),mcxSummary=find('ir-mcx-confirm-summary');
 const liveLabel=find('ir-live-status'),liveFacts=find('ir-live-facts');
 const openingEvidence=find('ir-opening-evidence'),openingFacts=find('ir-opening-facts'),
  openingNotes=find('ir-opening-notes');
 function showOpeningRange(r){
  openingEvidence.hidden=false;openingFacts.replaceChildren();
  const oh=r?.openingOHLC,fmtRange=n=>Number.isFinite(n)?fmt(n):'NOT VERIFIED';
  [
   ['Opening (09:15)',fmtRange(oh?.open)],['Opening range high',fmtRange(oh?.high)],
   ['Opening range low',fmtRange(oh?.low)],['Closing (09:30)',fmtRange(oh?.close)],
   ['Opening high−low points',Number.isFinite(r?.range)?String(r.range):'NOT VERIFIED'],
   ['Provisional opening bias',r?.direction==='CE'?'CALL (CE) • NOT QUALIFIED':
     r?.direction==='PE'?'PUT (PE) • NOT QUALIFIED':'WAIT'],
   ['Quote-only breakout check',r?.breakoutConfirmedByQuote===true?'YES • NOT 5M CONFIRMED':'NOT CONFIRMED']
  ].forEach(([k,v])=>row(openingFacts,k,v));
  openingNotes.textContent=(r?.evidence||[]).join(' • ')+' • '+
   (r?.reasons||[]).join('; ')+' • Early direction does NOT validate an option entry, strike, SL or target.';
 }
 function clearOpeningRange(){
  openingEvidence.hidden=true;openingFacts.replaceChildren();openingNotes.textContent='';
 }

 function renderColorOptionCard(plan=null,contract=null,earlyBias=null){
  const full=plan?.status==='UNVALIDATED_PAPER_LEVELS'&&contract&&
   contract.instrumentType===plan.optionType&&['CE','PE'].includes(plan.optionType)&&
   [plan.entry,plan.stopLoss,plan.target1,plan.target2,plan.target3].every(
    n=>typeof n==='number'&&Number.isFinite(n)&&n>0)&&
   plan.stopLoss<plan.entry&&plan.entry<plan.target1&&plan.target1<plan.target2&&plan.target2<plan.target3;
  const early=earlyBias==='CE'||earlyBias==='PE';
  colorCard.className='ir-color-option-card '+(full?
   plan.optionType==='CE'?'ir-card-call':'ir-card-put':early?'ir-card-early':'ir-card-wait');
  find('ir-card-contract').textContent=full?String(contract.tradingSymbol):
   early?'EARLY '+(earlyBias==='CE'?'CALL':'PUT')+' INDEX BIAS':'NO VERIFIED OPTION CONTRACT';
  find('ir-card-state').textContent=full?'PAPER BUY '+plan.optionType:early?'UNVALIDATED '+earlyBias:'WAIT';
  find('ir-card-expiry').textContent=full?
   'Strike '+contract.strike+' • '+plan.optionType+' • Expiry '+contract.expiry+' • Lot '+contract.lotSize:
   early?'Opening-range directional hypothesis only — no option contract or premium levels':
    'Strike / expiry not verified';
  for(const [id,n] of [
   ['ir-card-buy',plan?.entry],['ir-card-stop',plan?.stopLoss],
   ['ir-card-t1',plan?.target1],['ir-card-t2',plan?.target2],['ir-card-t3',plan?.target3]
  ])find(id).textContent=full?fmt(n):'NOT VERIFIED';
  find('ir-card-lots').textContent=full?
   'Theoretical paper lots: '+(plan.paperEnvelopeLots??'NOT VERIFIED')+' • Approved: 0':
   'Theoretical lots: NOT VERIFIED • Approved: 0';
  find('ir-card-warning').textContent=full?
   'Provisional premium research, not a verified trade or order instruction. Targets 1.5R / 2R / 3R are hypothetical; fees, gaps, slippage and actual funds are unverified.':
   early?'EARLY BIAS ONLY — Full option-price and risk checks have not passed. Do not treat this as an option purchase.':
   'WAIT — Premium, stop, targets and contract require verified broker evidence. No option order is authorized.';
 }

 let quoteSelection=null,refreshInProgress=false,lastResearchAt=null;
 let hasStartedAnalysis=false,capturedSlot=null,analysisInFlight=false;
 const freezeLabel=find('ir-freeze-state'),freezeTaken=find('ir-freeze-taken'),freezeNext=find('ir-freeze-next');
 const istTime=n=>new Date(n).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:true});
 function selectedExchangeClock(asOf=Date.now()){
  const input=symbol.value.trim().toUpperCase(),mcx=type.value==='MCX',index=type.value==='INDEX';
  return marketClockState({segment:mcx?'MCX_FO':index?(input==='SENSEX'?'BSE_INDEX':'NSE_INDEX'):'NSE_EQ',
   underlyingSymbol:mcx?input:'',asOf});
 }
 function expireOldSnapshot(){
  if(label.textContent==='WAIT — EXPIRED')return;
  label.textContent='WAIT — EXPIRED';label.className='ir-paper-wait';
  renderColorOptionCard();
  for(const fact of result.querySelectorAll('.ir-fact')){
   const name=fact.querySelector('span')?.textContent||'';
   if(/(entry|stop loss|target 1|target 2|theoretical lots|risk: theoretical lots)/i.test(name)){
    const value=fact.querySelector('strong');if(value)value.textContent='EXPIRED — WAIT';
   }
  }
 }
 function paintFrozenResearch(){
  const now=Date.now(),window=frozenResearchWindow(now);
  if(!hasStartedAnalysis){
   freezeLabel.textContent='AWAITING ANALYSIS';freezeTaken.textContent='Snapshot: not captured';
   freezeNext.textContent='Next update: after first analysis';return;
  }
  const state=frozenResearchState({asOf:now,capturedSlot,hasSelection:true,
   session:selectedExchangeClock(now),visible:!document.hidden,running:analysisInFlight});
  freezeTaken.textContent=lastResearchAt?'Analyzed at '+istTime(lastResearchAt)+' IST':'Analyzing...';
  freezeNext.textContent='Next 5-minute candle update: '+istTime(window.nextRefreshAt)+' IST';
  if(capturedSlot!==null&&capturedSlot<window.slot){
   expireOldSnapshot();
   freezeLabel.textContent=analysisInFlight?'UPDATING — WAIT':state.status==='MARKET_CLOSED'?
    'MARKET CLOSED — WAIT':state.status==='TAB_NOT_VISIBLE'?'TAB PAUSED — WAIT':'REFRESH DUE — WAIT';
  }else{
   freezeLabel.textContent=analysisInFlight?'ANALYZING — WAIT':
    state.status==='MARKET_CLOSED'?'FROZEN • MARKET CLOSED':'FROZEN — 5 MIN';
  }
 }
 function maybeRefreshFiveMinuteResearch(){
  if(!hasStartedAnalysis)return;
  const state=frozenResearchState({asOf:Date.now(),capturedSlot,hasSelection:true,
   session:selectedExchangeClock(),visible:!document.hidden,running:analysisInFlight});
  paintFrozenResearch();
  if(state.shouldRefresh&&!button.disabled)button.click();
 }

 function quoteSelectionFor(key,segment,underlyingSymbol){
  quoteSelection={key,segment,underlyingSymbol,optionKey:null,underlyingQuote:null,
    optionQuote:null,underlyingError:null,optionError:null,updatedAt:null};
  paintQuoteStatus();
 }
 function setOptionQuoteKey(key){
  if(!quoteSelection)return;
  quoteSelection.optionKey=key;quoteSelection.optionQuote=null;quoteSelection.optionError=null;
  paintQuoteStatus();
 }
 function observedQuote(role,quote){
  if(!quoteSelection)return;
  if(role==='option'){quoteSelection.optionQuote=quote;quoteSelection.optionError=null;}
  else{quoteSelection.underlyingQuote=quote;quoteSelection.underlyingError=null;}
  quoteSelection.updatedAt=Date.now();paintQuoteStatus();
 }
 function paintQuoteStatus(){
  liveFacts.replaceChildren();
  if(!quoteSelection){liveLabel.textContent='Awaiting analysis';return;}
  const now=Date.now(),session=marketClockState({segment:quoteSelection.segment,
    underlyingSymbol:quoteSelection.underlyingSymbol,asOf:now});
  const cases=[{label:'Underlying',key:quoteSelection.key,raw:quoteSelection.underlyingQuote,
    error:quoteSelection.underlyingError,option:false}];
  if(quoteSelection.optionKey)cases.push({label:'Option premium',key:quoteSelection.optionKey,
    raw:quoteSelection.optionQuote,error:quoteSelection.optionError,option:true});
  const states=[];
  for(const part of cases){
   const evidence=assessMarketQuote({quote:part.raw,expectedInstrumentKey:part.key,asOf:now,option:part.option});
   const state=!session.open?'MARKET CLOSED':part.error?'UNAVAILABLE':evidence.fresh?'FRESH':evidence.state;
   states.push(state);
   const values=[
    [part.label+' status',state],[part.label+' last',evidence.fresh?fmt(evidence.lastPrice):'NOT CURRENT'],
    [part.label+' broker quote time (IST)',evidence.quoteAt?
      new Date(evidence.quoteAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'}):'NOT VERIFIED']
   ];
   if(part.option){values.push(['Option best bid',evidence.fresh?fmt(evidence.bid):'NOT CURRENT'],
     ['Option best ask',evidence.fresh?fmt(evidence.ask):'NOT CURRENT']);}
   if(part.error)values.push([part.label+' data error',part.error]);
   for(const [name,value] of values)row(liveFacts,name,value);
  }
  liveLabel.textContent=!session.open?'Market closed — polling paused':
    states.every(x=>x==='FRESH')?'FRESH • 30s polling':
    states.includes('STALE')?'STALE — no current price':'WAITING FOR FRESH QUOTE';
  // A quote refresh never changes the frozen directional prediction or premium levels.
  paintFrozenResearch();
 }
 async function pollBrokerQuotes(){
  const selection=quoteSelection;
  if(!selection)return;
  const session=marketClockState({segment:selection.segment,underlyingSymbol:selection.underlyingSymbol,asOf:Date.now()});
  if(!mayPollMarketQuote({visible:!document.hidden,session,hasInstrument:!!selection.key,alreadyRunning:refreshInProgress})){
   if(!session.open)paintQuoteStatus();
   return;
  }
  refreshInProgress=true;
  try{
   const keys=[selection.key,...(selection.optionKey?[selection.optionKey]:[])];
   const responses=await Promise.allSettled(keys.map(key=>getUpstoxLiveQuote(key)));
   if(selection!==quoteSelection)return;
   responses.forEach((r,i)=>{
    const option=i===1;
    const value=option?'optionQuote':'underlyingQuote',error=option?'optionError':'underlyingError';
    if(r.status==='fulfilled'){selection[value]=r.value;selection[error]=null;}
    else{selection[value]=null;selection[error]=String(r.reason?.message||'UPSTOX_QUOTE_UNAVAILABLE');}
   });
   selection.updatedAt=Date.now();paintQuoteStatus();
  }finally{refreshInProgress=false;}
 }
 setInterval(()=>{void pollBrokerQuotes().catch(()=>{
  if(quoteSelection){quoteSelection.underlyingQuote=null;quoteSelection.underlyingError='READ_ONLY_QUOTE_REFRESH_FAILED';paintQuoteStatus();}
 });},MARKET_QUOTE_POLL_MS);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollBrokerQuotes();});
 setInterval(maybeRefreshFiveMinuteResearch,MARKET_QUOTE_POLL_MS);
 document.addEventListener('visibilitychange',maybeRefreshFiveMinuteResearch);

 function clearMcxEvidence(){
  mcxEvidence.hidden=true;mcxFacts.replaceChildren();mcxChecklist.replaceChildren();mcxSummary.textContent='';
 }
 function showMcxEvidence({future,research,quote,signal,session}){
  const data=describeMcxTechnicalSetup({future,research,quote,signal,session});
  mcxEvidence.hidden=false;mcxFacts.replaceChildren();mcxChecklist.replaceChildren();
  const v=n=>typeof n==='number'&&Number.isFinite(n)?String(n):'NOT VERIFIED';
  const t=data.lastCompletedAt?Date.parse(data.lastCompletedAt):NaN;
  [
   ['Matched MCX futures contract',data.instrument||'NOT VERIFIED'],
   ['Completed 5m candles',v(data.completedBars)],
   ['Last completed candle (IST)',Number.isFinite(t)?new Date(t).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'NOT VERIFIED'],
   ['Futures last close',fmt(data.close)],['Futures live price',fmt(data.quoteLast)],
   ['VWAP',fmt(data.vwap)],['EMA9 / EMA21',v(data.ema9)+' / '+v(data.ema21)],
   ['RSI14',v(data.rsi14)],['MACD histogram',v(data.macdHistogram)],
   ['ATR14',fmt(data.atr14)],['Quote spread',data.quoteValid?v(data.spreadPercent)+'%':'NOT VERIFIED'],
   ['Preliminary volume gate',data.preliminaryLiquidity?'PASS':'NOT VERIFIED OR FAILED'],
   ['Exchange clock',data.sessionOpen?'OPEN • holiday unverified':'CLOSED']
  ].forEach(([k,val])=>row(mcxFacts,k,val));
  if(!data.checks.length){mcxSummary.textContent='Completed technical evidence is unavailable. WAIT is required.';return;}
  mcxSummary.textContent='CALL: '+data.callConfirmations+'/4 conditions; PUT: '+data.putConfirmations+
   '/4 conditions. Four matching conditions are required; partial confirmation does not authorize a trade.';
  for(const check of data.checks){
   const item=element('div','','ir-mcx-check');
   item.append(element('strong',check.name),
    element('span','Observed: '+check.observed,'ir-mcx-observed'),
    element('span','CALL '+(check.call?'PASS':'BLOCK'),check.call?'ir-mcx-pass':'ir-mcx-block'),
    element('span','PUT '+(check.put?'PASS':'BLOCK'),check.put?'ir-mcx-pass':'ir-mcx-block'));
   mcxChecklist.append(item);
  }
 }

 let version=0;
 const reset=()=>{
  version++;hasStartedAnalysis=false;capturedSlot=null;analysisInFlight=false;button.disabled=false;
  label.textContent='WAIT';label.className='ir-paper-wait';renderColorOptionCard();
  result.replaceChildren();blocks.replaceChildren();chart.textContent='Awaiting fresh market data.';clearMcxEvidence();
  quoteSelection=null;lastResearchAt=null;paintQuoteStatus();paintFrozenResearch();clearOpeningRange();
  status.textContent='Select instrument type and symbol, then analyze.';
 };
 type.addEventListener('change',()=>{symbol.value=type.value==='INDEX'?'NIFTY':type.value==='MCX'?'GOLD':'RELIANCE';reset();});
 symbol.addEventListener('input',reset);
 function showPlan(plan=null,contract=null,issues=[]){
  result.replaceChildren();blocks.replaceChildren();
  renderColorOptionCard(plan,contract);
  const available=plan?.status==='UNVALIDATED_PAPER_LEVELS';
  const noDirection=issues.includes('NO_CLEAR_BUY_OR_SELL_SETUP');
  const skipped=noDirection?'NOT CALCULATED — WAIT':'NOT VERIFIED';
  const optionalPrice=value=>noDirection&&(value===null||value===undefined)?skipped:fmt(value);
  label.textContent=available?'BUY '+plan.optionType:'WAIT';
  label.className=available?'ir-paper-buy':'ir-paper-wait';
  [
   ['Research status',plan?.status??'WAIT'],
   ['Exact option contract',contract?.tradingSymbol??skipped],
   ['Option type',contract?.instrumentType??skipped],
   ['Strike',contract?.strike??skipped],['Expiry',contract?.expiry??skipped],
   ['Buy entry — option premium',optionalPrice(plan?.entry)],
   ['Stop loss — option premium',optionalPrice(plan?.stopLoss)],
   ['Target 1 (1.5R)',optionalPrice(plan?.target1)],['Target 2 (2R)',optionalPrice(plan?.target2)],
   ['Target 3 (3R)',optionalPrice(plan?.target3)],
   ['Contract lot size',contract?.lotSize??'NOT VERIFIED'],
   ['MCX quantity multiplier',contract?.segment==='MCX_FO'?(contract?.qtyMultiplier??'NOT VERIFIED'):'N/A'],
   ['Exposure units per MCX lot',contract?.segment==='MCX_FO'?(plan?.exposureUnitsPerLot??'NOT VERIFIED'):'N/A'],
   ['Gross risk + 2 ticks per lot',fmt(plan?.riskPerLot)],
   ['₹500 risk: theoretical lots',plan?.preliminaryRiskLots??'NOT VERIFIED'],
   ['Required premium/lot',fmt(plan?.optionPremiumCostPerLot)],
   ['Broker required margin/lot',fmt(plan?.brokerRequiredMarginPerLot)],
   ['Combined theoretical paper lots (NOT authorized)',plan?.paperEnvelopeLots??'NOT VERIFIED'],
   ['Actual broker funds','NOT VERIFIED'],['Approved / executable lots','0 — REAL ORDERS BLOCKED']
  ].forEach(([n,v])=>row(result,n,v));
  const explanations={
   NO_CLEAR_BUY_OR_SELL_SETUP:'No clear CALL/PUT setup. EMA9/EMA21, VWAP, RSI14 and MACD must align. See the technical checklist above.',
   FRESH_MCX_OPTION_PREMIUM_AND_VOLUME_REQUIRED:'Option premium candles or volume are insufficient.',
   ONE_MCX_OPTION_LOT_EXCEEDS_500_RISK_BUDGET:'At least one MCX option lot exceeds the ₹500 planned loss threshold.'
  };
  [...new Set([...issues,...(plan?.reasons??[])])].forEach(x=>blocks.append(element('li',explanations[x]??String(x))));
 }
 button.addEventListener('click',async()=>{
  const now=Date.now(),window=frozenResearchWindow(now);
  if(analysisInFlight)return;
  if(hasStartedAnalysis&&capturedSlot===window.slot){
   status.textContent='Frozen research output; next five-minute refresh after '+istTime(window.nextRefreshAt)+' IST.';
   paintFrozenResearch();return;
  }
  const thisRun=++version,input=symbol.value.trim().toUpperCase(),isIndex=type.value==='INDEX',isMcx=type.value==='MCX';
  const current=()=>thisRun===version;
  hasStartedAnalysis=true;capturedSlot=window.slot;analysisInFlight=true;
  button.disabled=true;label.textContent='WAIT';label.className='ir-paper-wait';renderColorOptionCard();
  result.replaceChildren();blocks.replaceChildren();chart.replaceChildren();status.textContent='Loading underlying market evidence...';clearMcxEvidence();
  quoteSelection=null;lastResearchAt=null;paintQuoteStatus();paintFrozenResearch();clearOpeningRange();
  let chosen=null,plan=null,direction='WAIT';
  const issues=[];
  try{
   if(!/^[A-Z0-9_-]{1,35}$/.test(input))throw Error('VALID_SYMBOL_REQUIRED');
   const session=marketClockState({segment:isMcx?'MCX_FO':isIndex?(input==='SENSEX'?'BSE_INDEX':'NSE_INDEX'):'NSE_EQ',underlyingSymbol:isMcx?input:'',asOf:now});
   if(!session.open)throw Error((isMcx?'MCX':'NSE')+'_MARKET_CLOCK_CLOSED_OR_UNVERIFIED');
   const auth=await getUpstoxReadOnlyStatus();
   if(!current())return;
   if(!auth.authenticated)throw Error('UPSTOX_REAUTHENTICATION_REQUIRED');

   if(isMcx){
    status.textContent='Reading MCX futures and CE/PE exchange contracts...';
    const [futureResponse,callResponse,putResponse]=await Promise.allSettled([
      searchUpstoxDerivatives(input,'FUT','MCX'),
      searchUpstoxDerivatives(input,'CE','MCX'),
      searchUpstoxDerivatives(input,'PE','MCX')
    ]);
    if(!current())return;
    const futures=futureResponse.status==='fulfilled'?futureResponse.value.contracts:[];
    const calls=callResponse.status==='fulfilled'?callResponse.value.contracts:[];
    const puts=putResponse.status==='fulfilled'?putResponse.value.contracts:[];
    for(const x of [futureResponse,callResponse,putResponse])
      if(x.status==='rejected')issues.push(String(x.reason?.message||'MCX_LOOKUP_UNAVAILABLE'));
    const linked=chooseMcxOptionUnderlying({futures,options:[...calls,...puts],symbol:input,asOf:now});
    issues.push(...linked.reasons);
    if(!linked.future){showPlan(null,null,issues);status.textContent='WAIT — MCX futures/option underlying link not verified';return;}
    const future=linked.future;
    quoteSelectionFor(future.instrumentKey,'MCX_FO',input);
    const [barsResponse,quoteResponse]=await Promise.allSettled([
      getUpstoxIntradayCandles(future.instrumentKey,'5m'),
      getUpstoxLiveQuote(future.instrumentKey)
    ]);
    if(!current())return;
    const candles=barsResponse.status==='fulfilled'?barsResponse.value.candles:[];
    candlesChart(chart,candles,now);
    const research=analyzeIntradayCandles(candles,{asOf:now,intervalMinutes:5,session});
    const quote=quoteResponse.status==='fulfilled'?
      extractUpstoxLiveQuoteEvidence(quoteResponse.value,future.instrumentKey,now):null;
    if(quoteResponse.status==='fulfilled')observedQuote('underlying',quoteResponse.value);
    if(barsResponse.status==='rejected')issues.push(String(barsResponse.reason?.message||'MCX_FUTURE_CANDLES_UNAVAILABLE'));
    if(quoteResponse.status==='rejected')issues.push(String(quoteResponse.reason?.message||'MCX_FUTURE_QUOTE_UNAVAILABLE'));
    const bias=deriveMcxOptionDirection({future,research,quote,session,asOf:now});
    direction=bias.direction;issues.push(...bias.reasons);
    showMcxEvidence({future,research,quote,signal:bias,session});
    if(direction==='WAIT'){
      showPlan(null,null,issues);
      status.textContent=issues.includes('NO_CLEAR_BUY_OR_SELL_SETUP')?
       'WAIT — No aligned CALL or PUT conditions. Review the technical checklist below.':
       'WAIT — MCX futures technical research not qualified. Review the technical evidence below.';
      return;
    }
    const picked=chooseMcxOptionContract({options:[...calls,...puts],future,
      spot:quote.lastPrice,direction,asOf:now});
    chosen=picked.contract;issues.push(...picked.reasons);
    if(chosen)setOptionQuoteKey(chosen.instrumentKey);
    if(!chosen){showPlan(null,null,issues);status.textContent='WAIT — exact MCX '+direction+' contract not verified';return;}
    const [optionBars,optionQuote]=await Promise.allSettled([
      getUpstoxIntradayCandles(chosen.instrumentKey,'5m'),
      getUpstoxLiveQuote(chosen.instrumentKey)
    ]);
    if(!current())return;
    const premiumResearch=optionBars.status==='fulfilled'?
      analyzeIntradayCandles(optionBars.value.candles,{asOf:now,intervalMinutes:5,session}):null;
    const premiumQuote=optionQuote.status==='fulfilled'?
      extractUpstoxLiveQuoteEvidence(optionQuote.value,chosen.instrumentKey,now):null;
    if(optionQuote.status==='fulfilled')observedQuote('option',optionQuote.value);
    if(optionBars.status==='rejected')issues.push(String(optionBars.reason?.message||'MCX_OPTION_CANDLES_UNAVAILABLE'));
    if(optionQuote.status==='rejected')issues.push(String(optionQuote.reason?.message||'MCX_OPTION_QUOTE_UNAVAILABLE'));
    const inputs={future,contract:chosen,direction,quote:premiumQuote,research:premiumResearch,asOf:now};
    plan=calculateMcxOptionPaperPlan(inputs);
    if(plan.status==='UNVALIDATED_PAPER_LEVELS'){
      try{
        const margin=await getUpstoxPaperMarginQuote(chosen.instrumentKey,'BUY',chosen.lotSize,plan.entry);
        if(!current())return;
        plan=calculateMcxOptionPaperPlan({...inputs,marginQuote:margin});
      }catch(e){issues.push('MCX_BROKER_MARGIN_UNAVAILABLE: '+String(e?.message??'UNKNOWN'));}
    }
    if(!current())return;
    showPlan(plan,chosen,issues);
    status.textContent=plan.status==='UNVALIDATED_PAPER_LEVELS'?
      'MCX provisional BUY '+direction+' premium paper research — NOT executable':
      'WAIT — MCX option contract or risk qualification incomplete';
    return;
   }
   const underlying=isIndex?await searchUpstoxIndex(input):await searchUpstoxEquity(input);
   if(!current())return;
   if(!isIndex&&String(underlying.tradingSymbol||'').toUpperCase()!==input)
    throw Error('EXACT_STOCK_SYMBOL_NOT_RESOLVED');
   const key=underlying.instrumentKey;
   quoteSelectionFor(key,isIndex?underlying.segment:'NSE_EQ',input);
   const [barsResponse,quoteResponse]=await Promise.allSettled([
    getUpstoxIntradayCandles(key,'5m'),getUpstoxLiveQuote(key)
   ]);
   if(!current())return;
   const candles=barsResponse.status==='fulfilled'?barsResponse.value.candles:[];
   candlesChart(chart,candles,now);
   const research=analyzeIntradayCandles(candles,{asOf:now,intervalMinutes:5,session});
   const quote=quoteResponse.status==='fulfilled'?
    isIndex?quoteResponse.value:extractUpstoxLiveQuoteEvidence(quoteResponse.value,key,now):null;
   if(quoteResponse.status==='fulfilled')observedQuote('underlying',quoteResponse.value);
   const side=deriveAutoOptionDirection({research,underlyingQuote:quote,
    underlyingSegment:isIndex?underlying.segment:'NSE_EQ',session,asOf:now});
   direction=side.direction;issues.push(...side.reasons);
   if(barsResponse.status!=='fulfilled')issues.push(String(barsResponse.reason?.message??'UNDERLYING_CANDLES_UNAVAILABLE'));
   if(quoteResponse.status!=='fulfilled')issues.push(String(quoteResponse.reason?.message??'UNDERLYING_PRICE_UNAVAILABLE'));
   if(direction==='WAIT'){
    showPlan(null,null,issues);
    if(isIndex){
     const clock=new Date(now+330*60000),minutes=clock.getUTCHours()*60+clock.getUTCMinutes();
     if(minutes>=555&&minutes<570){
      const progress=openingRangeProgress({candles,asOf:now});
      openingEvidence.hidden=false;openingFacts.replaceChildren();
      [
       ['09:15–09:30 opening candles',progress.completed+' / '+progress.required+' completed'],
       ['Opening OHLC', 'BUILDING — NOT YET VERIFIED'],
       ['First possible early bias','After 09:30:12 IST'],
       ['Current action','WAIT — collecting opening range']
      ].forEach(([name,value])=>row(openingFacts,name,value));
      openingNotes.textContent='An empty 5-minute candle feed immediately after 09:15 is expected while the first bar forms. Auto-retry follows the next completed 5-minute candle while the tab stays visible. After 09:30, three verified candles are required.';
      status.textContent='WAIT — Collecting the 09:15–09:30 opening range ('+
       progress.completed+'/3 completed 5-minute candles). First provisional CE/PE/WAIT research after 09:30:12 IST.';
      return;
     }
     const early=deriveOpeningRangeBias({candles,quote,session,asOf:now});
     if(minutes>=570&&research.completedBars<35){
      showOpeningRange(early);
      if(early.direction==='CE'||early.direction==='PE'){
       renderColorOptionCard(null,null,early.direction);
       label.textContent='EARLY '+(early.direction==='CE'?'CALL':'PUT')+' BIAS';
       label.className='ir-paper-wait';
       status.textContent='PROVISIONAL '+early.direction+' opening-range bias — not a qualified option trade. No contract, premium entry, stop or targets.';
       return;
      }
      status.textContent='WAIT — No clear opening-range direction or fresh market evidence. See 09:15–09:30 OHLC below.';
      return;
     }
    }
    status.textContent='WAIT — technical confirmation unavailable';return;
   }
   status.textContent='Checking exchange-listed '+direction+' contracts and option premium...';
   const contracts=await getUpstoxOptionContracts(key);
   if(!current())return;
   const selection=chooseAutoOptionContract({contracts,underlyingKey:key,spot:quote.lastPrice,direction,asOf:now});
   chosen=selection.contract;issues.push(...selection.reasons);
   if(chosen)setOptionQuoteKey(chosen.instrumentKey);
   if(!chosen){showPlan(null,null,issues);status.textContent='WAIT — verified option contract not found';return;}
   const [optionBars,optionQuote]=await Promise.allSettled([
    getUpstoxIntradayCandles(chosen.instrumentKey,'5m'),getUpstoxLiveQuote(chosen.instrumentKey)
   ]);
   if(!current())return;
   const premiumResearch=optionBars.status==='fulfilled'?
    analyzeIntradayCandles(optionBars.value.candles,{asOf:now,intervalMinutes:5,session}):null;
   const premiumQuote=optionQuote.status==='fulfilled'?
    extractUpstoxLiveQuoteEvidence(optionQuote.value,chosen.instrumentKey,now):null;
   if(optionQuote.status==='fulfilled')observedQuote('option',optionQuote.value);
   if(optionBars.status!=='fulfilled')issues.push(String(optionBars.reason?.message??'OPTION_CANDLES_UNAVAILABLE'));
   if(optionQuote.status!=='fulfilled')issues.push(String(optionQuote.reason?.message??'OPTION_QUOTE_UNAVAILABLE'));
   const inputs={direction,contract:chosen,underlyingKey:key,optionQuote:premiumQuote,
    optionResearch:premiumResearch,asOf:now};
   plan=calculateAutoOptionPaperPlan(inputs);
   if(plan.status==='UNVALIDATED_PAPER_LEVELS'){
    try{
     const margin=await getUpstoxPaperMarginQuote(chosen.instrumentKey,'BUY',chosen.lotSize,plan.entry);
     if(!current())return;
     plan=calculateAutoOptionPaperPlan({...inputs,marginQuote:margin});
    }catch(e){issues.push('BROKER_MARGIN_QUOTE_UNAVAILABLE: '+String(e?.message??'ERROR'));}
   }
   if(!current())return;
   showPlan(plan,chosen,issues);
   status.textContent=plan.status==='UNVALIDATED_PAPER_LEVELS'?
    'Provisional BUY '+direction+' research — NOT validated or executable':
    'WAIT — option quote, candle or risk qualification failed';
  }catch(e){
   if(!current())return;
   issues.push(String(e?.message??'AUTO_OPTION_RESEARCH_UNAVAILABLE'));
   showPlan(plan,chosen,issues);
   status.textContent='WAIT — '+issues.at(-1);
  }finally{
   if(current()){
    lastResearchAt=Date.now();analysisInFlight=false;button.disabled=false;
    paintQuoteStatus();paintFrozenResearch();
   }
  }
 });
}
