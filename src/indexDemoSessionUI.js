// Browser-bound index paper observation lab. Explicit arm required.
// Records stay in this browser; not an autonomous cloud runner or model trainer.
import {getUpstoxReadOnlyStatus,searchUpstoxIndex,getUpstoxIntradayCandles,getUpstoxLiveQuote,
 getUpstoxOptionContracts,getUpstoxPaperMarginQuote} from './services/upstoxReadOnlyMarketData.js';
import {analyzeIntradayCandles} from './services/intradayTechnicalEngine.js';
import {marketClockState} from './services/intradayMarketClock.js';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan} from './services/autoOptionResearchEngine.js';
import {extractUpstoxLiveQuoteEvidence} from './services/intradayRiskEngine.js';
import {deriveOpeningRangeBias} from './services/openingRangeResearch.js';
import {DEMO_SYMBOLS,DEMO_VERSION,createDemoObservation,evaluateDemoObservations,mergeDemoObservation,demoSummary,demoCsv} from './services/indexDemoJournal.js';

const DATE='2026-10-09',STATE_KEY='AI_TRADE_PRO_DEMO_OCT09_V1',ARM_KEY=STATE_KEY+'_ARM';
const nowIST=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const asText=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'—';
const make=(tag,value='',className='')=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
async function captureIndex(symbol,asOf,authenticated){
 const segment=symbol==='SENSEX'?'BSE_INDEX':'NSE_INDEX';
 const session=marketClockState({segment,asOf});
 let underlyingKey=null,research=null,quote=null,signal={direction:'WAIT',reasons:[]},contract=null,plan=null,openingRange=null;
 const errors=[];
 try{
  if(!authenticated)throw Error('UPSTOX_READ_ONLY_LOGIN_REQUIRED');
  const underlying=await searchUpstoxIndex(symbol);
  underlyingKey=underlying.instrumentKey;
  const [bars,live]=await Promise.allSettled([
   getUpstoxIntradayCandles(underlyingKey,'5m'),getUpstoxLiveQuote(underlyingKey)
  ]);
  const candles=bars.status==='fulfilled'?bars.value.candles:[];
  if(bars.status==='rejected')errors.push(String(bars.reason?.message??'CANDLES_UNAVAILABLE'));
  if(live.status==='rejected')errors.push(String(live.reason?.message??'INDEX_QUOTE_UNAVAILABLE'));
  research=analyzeIntradayCandles(candles,{asOf,intervalMinutes:5,session});
  quote=live.status==='fulfilled'?live.value:null;
  const minutes=new Date(asOf+330*60000).getUTCHours()*60+
   new Date(asOf+330*60000).getUTCMinutes();
  const earlyWindow=minutes>=570&&research.completedBars<35;
  if(earlyWindow){
   openingRange=deriveOpeningRangeBias({candles,quote,session,asOf});
   signal={direction:openingRange.direction,reasons:openingRange.reasons};
  }else signal=deriveAutoOptionDirection({research,underlyingQuote:quote,underlyingSegment:segment,session,asOf});
  // Early directional hypotheses are research-only, never auto-selected option trades.
  if(['CE','PE'].includes(signal.direction)&&!earlyWindow){
   try{
    const choices=await getUpstoxOptionContracts(underlyingKey);
    const selected=chooseAutoOptionContract({contracts:choices,underlyingKey,spot:quote.lastPrice,direction:signal.direction,asOf});
    contract=selected.contract;
    errors.push(...selected.reasons);
    if(contract){
     const [premBars,premQuote]=await Promise.allSettled([
      getUpstoxIntradayCandles(contract.instrumentKey,'5m'),getUpstoxLiveQuote(contract.instrumentKey)
     ]);
     const optionResearch=premBars.status==='fulfilled'?
      analyzeIntradayCandles(premBars.value.candles,{asOf,intervalMinutes:5,session}):null;
     const optionQuote=premQuote.status==='fulfilled'?
      extractUpstoxLiveQuoteEvidence(premQuote.value,contract.instrumentKey,asOf):null;
     if(premBars.status==='rejected')errors.push(String(premBars.reason?.message??'OPTION_CANDLES_UNAVAILABLE'));
     if(premQuote.status==='rejected')errors.push(String(premQuote.reason?.message??'OPTION_QUOTE_UNAVAILABLE'));
     const args={direction:signal.direction,contract,underlyingKey,optionQuote,optionResearch,asOf};
     plan=calculateAutoOptionPaperPlan(args);
     if(plan.status==='UNVALIDATED_PAPER_LEVELS'){
      try{
       const margin=await getUpstoxPaperMarginQuote(contract.instrumentKey,'BUY',contract.lotSize,plan.entry);
       plan=calculateAutoOptionPaperPlan({...args,marginQuote:margin});
      }catch(e){errors.push('MARGIN_QUOTE: '+String(e?.message??'UNAVAILABLE'));}
     }
    }
   }catch(e){errors.push(String(e?.message??'OPTION_LOOKUP_FAILED'));}
  }
  // Returns actual completed candles only; no lookahead or backfilled fabricated entries.
  return {observation:createDemoObservation({symbol,asOf,underlyingKey,session,research,quote,signal,
    contract,plan,openingRange,diagnostics:errors}),candles};
 }catch(e){
  errors.push(String(e?.message??'INDEX_CAPTURE_ERROR'));
  return {observation:createDemoObservation({symbol,asOf,underlyingKey,session,research,quote,
    signal:{direction:'WAIT',reasons:errors},openingRange,diagnostics:errors}),candles:[]};
 }
}
function downloadData(content,name,mime){
 const file=new Blob([content],{type:mime}),url=URL.createObjectURL(file);
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function mountIndexDemoJournal(){
 const page=document.querySelector('#intraday-recommendation-app .ir-app');
 const optionPanel=page?.querySelector('.ir-auto-option-panel');
 if(!optionPanel)return;
 const panel=document.createElement('section');
 panel.className='ir-panel ir-demo-panel';
 panel.innerHTML=[
  '<h2>Today: 9:30 opening-range index demo</h2>',
  '<p class="ir-muted">9:15–9:30 IST: record the 15-minute opening OHLC/high/low from 3 completed 5-minute candles. Starting about 9:30:15 IST, scan NIFTY / BANKNIFTY / SENSEX every 5 minutes for provisional CALL / PUT / WAIT opening-range bias. Full strategy still needs 35 candles. Browser must be armed and awake; real orders disabled.</p>',
  '<div class="ir-actions"><button id="demo-arm" class="ir-primary" type="button">Arm today’s paper demo</button>',
  '<button id="demo-stop" class="ir-secondary" type="button">Stop demo</button>',
  '<button id="demo-csv" class="ir-secondary" type="button">Export CSV</button>',
  '<button id="demo-json" class="ir-secondary" type="button">Export JSON</button></div>',
  '<p id="demo-status" class="ir-status" role="status">Demo inactive. Arm this browser and leave the tab open for automated paper observations.</p>',
  '<div id="demo-stats" class="ir-facts"></div>',
  '<h3>Latest frozen research records</h3><div id="demo-recent" class="ir-demo-recent"></div>',
  '<h3>Self-review after each measured outcome</h3><div id="demo-reviews" class="ir-demo-recent"></div>',
  '<h3>Proposed improvements (not automatic rule changes)</h3><ul id="demo-lessons" class="ir-reasons"></ul>',
  '<p class="ir-muted">Original prediction is recorded first; post-prediction technical and fundamental audits appear only after a measured outcome. Fundamentals need dated sourced data; absent evidence is labeled NOT VERIFIED. 30-minute labels measure index direction, not option P&L. Browser must stay awake and connected. Data stays in this browser only.</p>'
 ].join('');
 optionPanel.insertAdjacentElement('afterend',panel);
 const $=id=>panel.querySelector('#'+id),status=$('demo-status');
 let records=[],armed=false,running=false,lastBucket=null,storageAvailable=true;
 try{
  const stored=JSON.parse(localStorage.getItem(STATE_KEY)||'[]');
  if(Array.isArray(stored))records=stored.filter(x=>x&&DEMO_SYMBOLS.includes(x.symbol)&&x.version===DEMO_VERSION).slice(-1000);
  armed=localStorage.getItem(ARM_KEY)==='true';
 }catch(_e){storageAvailable=false;status.textContent='Local browser storage blocked — cannot arm a reliable persistent demo.';}
 function save(){
  if(!storageAvailable)return false;
  try{localStorage.setItem(STATE_KEY,JSON.stringify(records));return true;}
  catch(_e){storageAvailable=false;armed=false;status.textContent='Browser storage failed. Demo paused; export any captured records.';return false;}
 }
 function show(){
  const summary=demoSummary(records);
  $('demo-stats').replaceChildren();$('demo-recent').replaceChildren();$('demo-reviews').replaceChildren();$('demo-lessons').replaceChildren();
  const pairs=[
   ['Snapshots',summary.total],['WAIT (not a forecast)',summary.wait],
   ['Directional hypotheses',summary.predictions],['Awaiting 30m follow-up',summary.pending],
   ['Correct index direction',summary.correct],['Wrong index direction',summary.wrong],
   ['Inconclusive',summary.inconclusive],['Real / approved orders',0]
  ];
  for(const [k,v] of pairs){
   const n=make('div','','ir-fact');n.append(make('span',k),make('strong',String(v)));$('demo-stats').append(n);
  }
  for(const r of records.slice(-10).reverse()){
   const el=make('div','','ir-demo-item'),name=make('strong',r.symbol+' • '+r.direction+' • '+r.status);
   const range=r.openingOHLC?make('span','09:15–09:30 OHLC: '+
    [r.openingOHLC.open,r.openingOHLC.high,r.openingOHLC.low,r.openingOHLC.close].map(asText).join(' / ')+
    ' • Opening H '+asText(r.openingRangeHigh)+' L '+asText(r.openingRangeLow)):
    make('span',r.predictionType||'Standard 5m');
   const when=make('span',new Date(r.recordedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+' IST');
   const notes=r.outcome?make('span',r.outcome.verdict+' • '+(r.learningNotes||[]).join(' ')):
     make('span',(r.reasons||[]).slice(0,2).join('; ')||'Outcome not yet measured');
   el.append(name,when,range,notes);$('demo-recent').append(el);
  }
  for(const record of records.filter(x=>x.review).slice(-6).reverse()){
   const review=record.review;
   const item=make('article','','ir-demo-review');
   item.append(make('strong',record.symbol+' • '+record.direction+' • '+review.verdict),
    make('p','Original prediction: '+new Date(record.recordedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+
     ' IST • Index '+asText(record.indexQuote)+' → '+asText(record.outcome?.observedClose)),
    make('p',review.summary),
    make('p','Technical review: '+review.technical.conclusion),
    make('p','Fundamental evidence: '+review.fundamental.status+' — '+review.fundamental.limitation),
    make('p','Potential improvement (requires testing): '+(review.improvementCandidates?.[0]??'More verified data needed')),
    make('p','Option target/stop profit: NOT VERIFIED • Real orders: 0'));
   $('demo-reviews').append(item);
  }
  if(!records.some(x=>x.review))$('demo-reviews').append(
   make('p','No completed prediction reviews yet. An original CE/PE prediction must first be recorded; outcome and diagnostics follow only after fresh 30-minute evidence.','ir-muted'));
  for(const tip of summary.proposals.slice(0,5))$('demo-lessons').append(make('li',tip));
  $('demo-arm').disabled=!storageAvailable||armed;$('demo-stop').disabled=!armed;
 }
 $('demo-arm').addEventListener('click',()=>{
  if(!storageAvailable)return;
  armed=true;localStorage.setItem(ARM_KEY,'true');lastBucket=null;
  status.textContent='Armed for 9 Oct 2026, 09:30 IST opening-range research. Keep this browser tab open and authenticated.';
  show();void tick();
 });
 $('demo-stop').addEventListener('click',()=>{
  armed=false;if(storageAvailable)localStorage.setItem(ARM_KEY,'false');
  status.textContent='Demo disarmed. Existing evidence preserved.';show();
 });
 $('demo-csv').addEventListener('click',()=>downloadData(demoCsv(records),'ai-trade-pro-index-demo-2026-10-09.csv','text/csv;charset=utf-8'));
 $('demo-json').addEventListener('click',()=>downloadData(JSON.stringify({version:DEMO_VERSION,safety:{paperOnly:true,orderSubmissionAllowed:false},
  observations:records,summary:demoSummary(records)},null,2),'ai-trade-pro-index-demo-2026-10-09.json','application/json'));
 async function tick(){
  if(!armed||running||!storageAvailable)return;
  const now=Date.now(),date=nowIST(now),ist=new Date(now+330*60000),minutes=ist.getUTCHours()*60+ist.getUTCMinutes();
  if(date!==DATE){if(date>DATE){armed=false;localStorage.setItem(ARM_KEY,'false');status.textContent='Demo date completed. Export the local journal.';show();}return;}
  if(minutes<570||minutes>=920)return; // Do not issue predictions before the 09:15–09:30 opening range closes.
  // Settle the last 09:25 candle for 12 seconds before evaluating and deduplicating each new slot.
  const bucket=Math.floor((now-12000)/300000);
  if(minutes===570&&new Date(now+330*60000).getUTCSeconds()<12)return;
  if(bucket===lastBucket)return;
  lastBucket=bucket;running=true;
  status.textContent='Collecting read-only snapshots — '+new Date(now).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+' IST';
  try{
   let authenticated=false;
   try{authenticated=(await getUpstoxReadOnlyStatus()).authenticated===true;}catch(_e){}
   for(const symbol of DEMO_SYMBOLS){
    if(!armed)break;
    const point=await captureIndex(symbol,Date.now(),authenticated);
    records=evaluateDemoObservations(records,symbol,point.candles,Date.now());
    records=mergeDemoObservation(records,point.observation);
    if(!save())break;
    show();
   }
   status.textContent='Last demo check '+new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+
    ' IST • '+(authenticated?'Data source authenticated':'Upstox login/data unavailable')+
    ' • 0 real orders';
  }catch(e){status.textContent='Demo scan interrupted: '+String(e?.message??'UNKNOWN')+' • zero orders';}
  finally{running=false;show();}
 }
 show();
 if(armed)status.textContent='Opening range demo armed • First possible prediction after 09:30:12 IST.';
 setInterval(()=>{if(!document.hidden)void tick();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void tick();});
}
