import './intradayRecommendations.css';
import {evaluateIntradayRecommendation} from './services/intradayRecommendationEngine.js';
import {analyzeIntradayCandles} from './services/intradayTechnicalEngine.js';
import {marketClockState} from './services/intradayMarketClock.js';
import {assessIntradayInstrumentRisk,extractUpstoxLiveQuoteEvidence} from './services/intradayRiskEngine.js';
import {classifyIntradayInstrument} from './services/intradayInstrumentContract.js';
import {getUpstoxReadOnlyStatus,getUpstoxIntradayCandles,getUpstoxLiveQuote,getUpstoxOptionGreeks,searchUpstoxEquity,searchUpstoxDerivatives} from './services/upstoxReadOnlyMarketData.js';

function addRow(parent,label,value){
 const el=document.createElement('div');el.className='ir-fact';
 const title=document.createElement('span');title.textContent=label;
 const content=document.createElement('strong');content.textContent=value===null||value===undefined?'Not verified':String(value);
 el.append(title,content);parent.append(el);
}
function addReason(node,reason){const li=document.createElement('li');li.textContent=String(reason);node.append(li);}
export function mountIntradayRecommendations(){
 const root=document.querySelector('#intraday-recommendation-app');
 if(!root)return;
 root.innerHTML=[
 '<main class="ir-app"><header class="ir-header"><span class="ir-logo">↗</span><div><h1>AI TRADE PRO</h1><p>Intraday market research • Recommendations only</p></div><span class="ir-safety">REAL ORDERS BLOCKED</span></header>',
 '<section class="ir-panel"><h2>Intraday AI Recommendations</h2><p class="ir-muted">NSE equities, NSE futures/options and MCX commodity futures/options • Live-read research only</p>',
 '<div class="ir-controls"><label>Instrument type<select id="ir-kind"><option value="NSE_EQ">NSE Stock</option><option value="FUT">NSE Future</option><option value="CE">Call Option (CE)</option><option value="PE">Put Option (PE)</option><option value="MCX_FUT">MCX Commodity Future</option><option value="MCX_CE">MCX Commodity Call (CE)</option><option value="MCX_PE">MCX Commodity Put (PE)</option></select></label>',
 '<label>Symbol / underlying<input id="ir-symbol" value="RELIANCE" maxlength="50" autocomplete="off" spellcheck="false"></label>',
 '<label>Timeframe<select id="ir-interval"><option value="5m">5 minutes</option><option value="1m">1 minute</option><option value="15m">15 minutes</option></select></label>',
 '<button id="ir-find" class="ir-secondary" type="button" hidden>Find contracts</button></div>',
 '<label id="ir-contract-wrap" class="ir-contract" hidden>Exact exchange contract<select id="ir-contract"><option value="">Find and select a contract first</option></select></label>',
 '<div class="ir-actions"><button id="ir-check" class="ir-primary" type="button">Analyze Intraday</button><button id="ir-auto" class="ir-secondary" type="button" aria-pressed="false">Start 30s refresh</button>',
 '<a href="https://ai-trade-pro-oauth.onrender.com/auth/upstox/start" target="_blank" rel="noopener noreferrer">Connect Upstox</a></div>',
 '<p id="ir-status" class="ir-status" role="status" aria-live="polite">Ready • No qualified intraday signal</p><p id="ir-updated" class="ir-muted">No live market refresh yet. REST polling is not tick streaming.</p></section>',
 '<section class="ir-panel"><div class="ir-decision"><h2>AI Decision</h2><span id="ir-decision">WAIT</span></div>',
 '<div id="ir-facts" class="ir-facts"></div><h3>Intraday technical evidence</h3><div id="ir-technical" class="ir-facts"></div>',
 '<h3>Qualification reasons</h3><ul id="ir-reasons" class="ir-reasons"><li>Run analysis to see evidence.</li></ul>',
 '<p class="ir-note">90% success is a research target, not an achieved result. No buy/sell or entry/stop/target values without strategy and out-of-sample qualification.</p></section>',
 '<footer>Upstox read-only market data. No automated orders or real trading.</footer></main>'
 ].join('');
 const $=id=>root.querySelector(id);
 const kind=$('#ir-kind'),symbol=$('#ir-symbol'),contract=$('#ir-contract'),status=$('#ir-status');
 let contracts=[],timer=null,autoRefresh=false,requestVersion=0;
 const refreshButton=$('#ir-auto');
 function stopRefresh(reason=''){
  if(timer!==null){clearInterval(timer);timer=null;}
  autoRefresh=false;requestVersion++;
  refreshButton.textContent='Start 30s refresh';refreshButton.setAttribute('aria-pressed','false');
  if(reason){
   status.textContent=reason;$('#ir-decision').textContent='WAIT';
   $('#ir-updated').textContent='Previous evidence invalidated; refresh to analyze again.';
   $('#ir-facts').replaceChildren();$('#ir-technical').replaceChildren();
   $('#ir-reasons').replaceChildren();
   addReason($('#ir-reasons'),'SELECTION_CHANGED_REANALYSIS_REQUIRED');
  }
 }
 function resetContracts(){
  stopRefresh();
  const derivative=kind.value!=='NSE_EQ';
  $('#ir-find').hidden=!derivative;$('#ir-contract-wrap').hidden=!derivative;
  contract.replaceChildren(new Option('Find and select a contract first',''));contracts=[];
  status.textContent=derivative?'Select an exact futures/options contract first.':'Ready • No qualified intraday signal';
  $('#ir-decision').textContent='WAIT';
  $('#ir-facts').replaceChildren();$('#ir-technical').replaceChildren();
  $('#ir-reasons').replaceChildren();
  addReason($('#ir-reasons'),'SELECT_INSTRUMENT_AND_ANALYZE');
 }
 kind.addEventListener('change',resetContracts);
 $('#ir-interval').addEventListener('change',()=>stopRefresh('Timeframe changed — analyze again.'));
 contract.addEventListener('change',()=>stopRefresh('Contract changed — analyze again.'));
 refreshButton.addEventListener('click',()=>{
  if(autoRefresh){stopRefresh('Automatic refresh stopped.');return;}
  if(kind.value!=='NSE_EQ'&&!contract.value){status.textContent='Select an exact contract before enabling refresh.';return;}
  autoRefresh=true;refreshButton.textContent='Stop 30s refresh';refreshButton.setAttribute('aria-pressed','true');
  $('#ir-check').click();
  timer=setInterval(()=>{if(!document.hidden&&!$('#ir-check').disabled)$('#ir-check').click();},30000);
 });
 document.addEventListener('visibilitychange',()=>{
  if(autoRefresh&&!document.hidden&&!$('#ir-check').disabled)$('#ir-check').click();
 });
 symbol.addEventListener('input',()=>{stopRefresh('Symbol changed — analyze again.');if(kind.value!=='NSE_EQ'){contracts=[];contract.replaceChildren(new Option('Find and select a contract first',''));}});
 $('#ir-find').addEventListener('click',async()=>{
  const button=$('#ir-find');stopRefresh();button.disabled=true;status.textContent='Searching exchange contracts…';
  try{
   if(!(await getUpstoxReadOnlyStatus()).authenticated)throw new Error('UPSTOX_REAUTHENTICATION_REQUIRED');
   const exchange=kind.value.startsWith('MCX_')?'MCX':'NSE';
   const type=kind.value.replace('MCX_','');
   const result=await searchUpstoxDerivatives(symbol.value.trim(),type,exchange);
   contracts=result.contracts.filter(item=>classifyIntradayInstrument(item).valid);
   contract.replaceChildren(new Option(contracts.length?'Choose exact contract':'No matching valid contracts',''));
   contracts.forEach((item,i)=>contract.add(new Option(item.tradingSymbol+' • '+item.expiry+' • '+(item.strike||'FUT')+' • Lot '+item.lotSize,String(i))));
   status.textContent=contracts.length?'Select an exact contract, then analyze.':'No matching valid exchange contract returned.';
  }catch(e){status.textContent='Contract lookup: '+String(e?.message||'ERROR');}
  finally{button.disabled=false;}
 });
 $('#ir-check').addEventListener('click',async()=>{
  const button=$('#ir-check'),now=Date.now(),interval=$('#ir-interval').value,version=requestVersion;
  button.disabled=true;status.textContent='Checking read-only market data…';
  $('#ir-facts').replaceChildren();$('#ir-technical').replaceChildren();$('#ir-reasons').replaceChildren();
  let instrument={segment:'NSE_EQ',tradingSymbol:symbol.value.trim().toUpperCase()};
  let connection='BACKEND_UNREACHABLE',dataStatus='NOT_LOADED',candles=[],quote=null,research=null,risk=null,greeks=null;
  let session=marketClockState({segment:'NSE_EQ',asOf:now});
  try{
   const state=await getUpstoxReadOnlyStatus();
   connection=state.authenticated?'AUTHENTICATED':'LOGIN_REQUIRED';
   if(state.authenticated){
    let key=null;
    if(kind.value==='NSE_EQ'){
     const match=await searchUpstoxEquity(instrument.tradingSymbol);
     instrument={segment:'NSE_EQ',instrumentType:'EQ',tradingSymbol:match.tradingSymbol};key=match.instrumentKey;
    }else{
     const i=Number(contract.value);
     if(contract.value===''||!Number.isInteger(i)||!contracts[i])throw new Error('SELECT_EXACT_DERIVATIVE_CONTRACT');
     instrument=contracts[i];key=instrument.instrumentKey;
    }
    session=marketClockState({segment:instrument.segment,underlyingSymbol:instrument.underlyingSymbol,asOf:now});
    const needsGreeks=instrument.instrumentType==='CE'||instrument.instrumentType==='PE';
    const results=await Promise.allSettled([
      getUpstoxIntradayCandles(key,interval),getUpstoxLiveQuote(key),
      needsGreeks?getUpstoxOptionGreeks(key):Promise.resolve(null)
    ]);
    if(results[0].status==='fulfilled'){
     candles=results[0].value.candles;dataStatus=candles.length+' candles retrieved ('+interval+')';
     research=analyzeIntradayCandles(candles,{asOf:now,intervalMinutes:Number(interval.replace('m','')),session});
    }else dataStatus=String(results[0].reason?.message||'INTRADAY_DATA_UNAVAILABLE');
    quote=results[1].status==='fulfilled'?extractUpstoxLiveQuoteEvidence(results[1].value,key,now):
      {valid:false,spreadPercent:null,reasons:[String(results[1].reason?.message||'QUOTE_UNAVAILABLE')]};
    if(results[2].status==='fulfilled')greeks=results[2].value?.greeks??null;
    risk=assessIntradayInstrumentRisk({instrument,quote,research,asOf:now,session,
      openInterest:quote?.openInterest,greeks,
      impliedVolatility:greeks?.iv??null});
   }
  }catch(e){dataStatus=String(e?.message||'MARKET_DATA_UNAVAILABLE');}
  if(version!==requestVersion){button.disabled=false;return;}
  const decision=evaluateIntradayRecommendation({instrument,candles,asOf:now,sessionOpen:session.open,
    spreadPercent:quote?.spreadPercent,research,risk});
  const facts=$('#ir-facts'),technical=$('#ir-technical'),reasonsNode=$('#ir-reasons');
  [['Decision',decision.recommendation],['Instrument',decision.kind+' • '+decision.symbol],
    ['Upstox session',connection],['Intraday candles',dataStatus],
    ['Market',session.exchange+' • '+session.group+' • '+session.reason],
    ['Quote LTP',quote?.valid?quote.lastPrice:'Not verified'],
    ['Quote response (IST)',quote?.timestamp?new Date(quote.timestamp).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true}):'Not verified'],
    ['Quote response age',quote?.timestamp?Math.max(0,Math.round((now-quote.timestamp)/1000))+' seconds':'Not verified'],
    ['Last actual trade (IST)',quote?.lastTradeTime?new Date(quote.lastTradeTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true}):'Not verified'],
    ['Last trade age',quote?.lastTradeTime?Math.max(0,Math.round((now-quote.lastTradeTime)/1000))+' seconds':'Not verified'],
    ['Open interest',quote?.openInterest??'Not verified'],
    ['Exchange close (IST)',session.closeMinutes===null?'Unknown':String(Math.floor(session.closeMinutes/60)).padStart(2,'0')+':'+String(session.closeMinutes%60).padStart(2,'0')],
    ['Lot / expiry',instrument.lotSize?instrument.lotSize+' / '+instrument.expiry:'N/A'],
    ['Option IV',greeks?.iv??'Not verified'],
    ['Verified spread',quote?.valid?quote.spreadPercent+'%':'Unavailable'],
    ['Technical bias',decision.researchBias],['Proven win probability','Not established']]
    .forEach(([k,v])=>addRow(facts,k,v));
  if(research?.valid){
   const s=research.snapshot;
   [['Latest completed candle',s.lastCompletedAt],['Close',s.close],['VWAP',s.vwap],
    ['EMA9 / EMA21',s.ema9+' / '+s.ema21],['RSI14',s.rsi14],
    ['MACD histogram',s.macdHistogram],['ATR14',s.atr14],
    ['Relative volume',s.lastVolumeRatio===null?'Unavailable':s.lastVolumeRatio+'x'],
    ['Average traded value (20 candles)',s.averageTurnover20],
    ['Preliminary volume gate',s.liquidityResearchPass?'PASS':'BLOCK']]
    .forEach(([k,v])=>addRow(technical,k,v));
  }else addRow(technical,'Indicator status',research?.reasons?.join(', ')||'No verified candles');
  const reasons=[...new Set([...decision.reasons,...(quote?.reasons||[]),
    ...(dataStatus==='NOT_LOADED'?['MARKET_DATA_NOT_LOADED']:dataStatus.includes('candles retrieved')?[]:[dataStatus])])];
  reasons.forEach(reason=>addReason(reasonsNode,reason));
  $('#ir-decision').textContent='WAIT';
  const timestamp=new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:true});
  $('#ir-updated').textContent='Last request finished '+timestamp+' IST • '+(autoRefresh?'30s polling active':'Manual refresh')+' • Prices are not a WebSocket tick stream.';
  status.textContent='Analysis complete • '+reasons.length+' qualification issue(s) • No trade';
  button.disabled=false;
 });
}
mountIntradayRecommendations();
