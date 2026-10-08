// Dedicated two-field NSE and MCX long-options paper research.
import {getUpstoxReadOnlyStatus,searchUpstoxIndex,searchUpstoxEquity,getUpstoxIntradayCandles,
 getUpstoxLiveQuote,getUpstoxOptionContracts,getUpstoxPaperMarginQuote} from './services/upstoxReadOnlyMarketData.js';
import {extractUpstoxLiveQuoteEvidence} from './services/intradayRiskEngine.js';
import {analyzeIntradayCandles} from './services/intradayTechnicalEngine.js';
import {marketClockState} from './services/intradayMarketClock.js';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan} from './services/autoOptionResearchEngine.js';
import {chooseMcxOptionUnderlying,deriveMcxOptionDirection,chooseMcxOptionContract,calculateMcxOptionPaperPlan} from './services/mcxAutoOptionResearchEngine.js';
import {searchUpstoxDerivatives} from './services/upstoxReadOnlyMarketData.js';

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
 const legacy=document.querySelector('#intraday-recommendation-app .ir-app');
 if(!legacy)return;
 const oldPanels=[...legacy.querySelectorAll(':scope > section')];
 oldPanels.forEach(p=>p.hidden=true);
 const panel=document.createElement('section');panel.className='ir-panel ir-auto-option-panel';
 panel.innerHTML=[
  '<h2>One-click CALL / PUT research <span class="ir-safety">PAPER ONLY</span></h2>',
  '<p class="ir-muted">Choose just the instrument type and symbol. NSE and MCX research require fresh candles and an authenticated Upstox data connection.</p>',
  '<div class="ir-auto-controls"><label>Instrument type<select id="ir-auto-type"><option value="INDEX">NSE Index Options — Auto CE/PE</option><option value="STOCK">NSE Stock Options — Auto CE/PE</option><option value="MCX">MCX Commodity Options — Auto CE/PE</option></select></label>',
  '<label>Symbol<input id="ir-auto-symbol" value="NIFTY" maxlength="35" autocomplete="off" spellcheck="false" placeholder="NIFTY / RELIANCE / GOLD / SILVER"></label></div>',
  '<div class="ir-actions"><button class="ir-primary" id="ir-auto-analyze" type="button">Analyze chart &amp; find CE / PE</button></div>',
  '<p id="ir-auto-status" class="ir-status" role="status" aria-live="polite">Select instrument and symbol, then analyze.</p>',
  '<div class="ir-decision ir-option-result"><h3>Option research result</h3><span class="ir-paper-wait" id="ir-auto-direction">WAIT</span></div>',
  '<p class="ir-paper-warning">Illustrative long-option premium prices, not instructions or order previews. ₹50,000 capital, ₹500 planned risk. Real trading is disabled.</p>',
  '<h3>Underlying 5-minute candle chart</h3><div class="ir-option-chart" id="ir-auto-chart">Awaiting fresh market data.</div>',
  '<div id="ir-auto-results" class="ir-facts"></div><h3>What is not verified?</h3><ul id="ir-auto-blocks" class="ir-reasons"></ul>',
  '<button class="ir-secondary ir-advanced-toggle" id="ir-auto-advanced" type="button" aria-expanded="false">Show advanced research controls</button>'
 ].join('');
 const header=legacy.querySelector('.ir-header');header.insertAdjacentElement('afterend',panel);
 const find=id=>panel.querySelector('#'+id),type=find('ir-auto-type'),symbol=find('ir-auto-symbol');
 const button=find('ir-auto-analyze'),status=find('ir-auto-status'),result=find('ir-auto-results');
 const blocks=find('ir-auto-blocks'),label=find('ir-auto-direction'),chart=find('ir-auto-chart');
 let version=0;
 const reset=()=>{
  version++;label.textContent='WAIT';label.className='ir-paper-wait';
  result.replaceChildren();blocks.replaceChildren();chart.textContent='Awaiting fresh market data.';
  status.textContent='Select instrument type and symbol, then analyze.';
 };
 type.addEventListener('change',()=>{symbol.value=type.value==='INDEX'?'NIFTY':type.value==='MCX'?'GOLD':'RELIANCE';reset();});
 symbol.addEventListener('input',reset);
 find('ir-auto-advanced').addEventListener('click',()=>{
  const visible=oldPanels[0]?.hidden!==false;
  oldPanels.forEach(p=>p.hidden=!visible);
  const toggle=find('ir-auto-advanced');toggle.setAttribute('aria-expanded',String(visible));
  toggle.textContent=visible?'Hide advanced research controls':'Show advanced research controls';
 });
 function showPlan(plan=null,contract=null,issues=[]){
  result.replaceChildren();blocks.replaceChildren();
  const available=plan?.status==='UNVALIDATED_PAPER_LEVELS';
  label.textContent=available?'BUY '+plan.optionType:'WAIT';
  label.className=available?'ir-paper-buy':'ir-paper-wait';
  [
   ['Research status',plan?.status??'WAIT'],
   ['Exact option contract',contract?.tradingSymbol??'NOT VERIFIED'],
   ['Option type',contract?.instrumentType??'NOT VERIFIED'],
   ['Strike',contract?.strike??'NOT VERIFIED'],['Expiry',contract?.expiry??'NOT VERIFIED'],
   ['Buy entry — option premium',fmt(plan?.entry)],
   ['Stop loss — option premium',fmt(plan?.stopLoss)],
   ['Target 1 (1.5R)',fmt(plan?.target1)],['Target 2 (2R)',fmt(plan?.target2)],
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
  [...new Set([...issues,...(plan?.reasons??[])])].forEach(x=>blocks.append(element('li',String(x))));
 }
 button.addEventListener('click',async()=>{
  const thisRun=++version,now=Date.now(),input=symbol.value.trim().toUpperCase(),isIndex=type.value==='INDEX',isMcx=type.value==='MCX';
  const current=()=>thisRun===version;
  button.disabled=true;label.textContent='WAIT';label.className='ir-paper-wait';
  result.replaceChildren();blocks.replaceChildren();chart.replaceChildren();status.textContent='Loading underlying market evidence...';
  let chosen=null,plan=null,direction='WAIT';
  const issues=[];
  try{
   if(!/^[A-Z0-9_-]{1,35}$/.test(input))throw Error('VALID_SYMBOL_REQUIRED');
   const session=marketClockState({segment:isMcx?'MCX_FO':'NSE_EQ',underlyingSymbol:isMcx?input:'',asOf:now});
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
    if(barsResponse.status==='rejected')issues.push(String(barsResponse.reason?.message||'MCX_FUTURE_CANDLES_UNAVAILABLE'));
    if(quoteResponse.status==='rejected')issues.push(String(quoteResponse.reason?.message||'MCX_FUTURE_QUOTE_UNAVAILABLE'));
    const bias=deriveMcxOptionDirection({future,research,quote,session,asOf:now});
    direction=bias.direction;issues.push(...bias.reasons);
    if(direction==='WAIT'){showPlan(null,null,issues);status.textContent='WAIT — MCX futures technical research not qualified';return;}
    const picked=chooseMcxOptionContract({options:[...calls,...puts],future,
      spot:quote.lastPrice,direction,asOf:now});
    chosen=picked.contract;issues.push(...picked.reasons);
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
   const [barsResponse,quoteResponse]=await Promise.allSettled([
    getUpstoxIntradayCandles(key,'5m'),getUpstoxLiveQuote(key)
   ]);
   if(!current())return;
   const candles=barsResponse.status==='fulfilled'?barsResponse.value.candles:[];
   candlesChart(chart,candles,now);
   const research=analyzeIntradayCandles(candles,{asOf:now,intervalMinutes:5,session});
   const quote=quoteResponse.status==='fulfilled'?
    isIndex?quoteResponse.value:extractUpstoxLiveQuoteEvidence(quoteResponse.value,key,now):null;
   const side=deriveAutoOptionDirection({research,underlyingQuote:quote,
    underlyingSegment:isIndex?'NSE_INDEX':'NSE_EQ',session,asOf:now});
   direction=side.direction;issues.push(...side.reasons);
   if(barsResponse.status!=='fulfilled')issues.push(String(barsResponse.reason?.message??'UNDERLYING_CANDLES_UNAVAILABLE'));
   if(quoteResponse.status!=='fulfilled')issues.push(String(quoteResponse.reason?.message??'UNDERLYING_PRICE_UNAVAILABLE'));
   if(direction==='WAIT'){showPlan(null,null,issues);status.textContent='WAIT — technical confirmation unavailable';return;}
   status.textContent='Checking exchange-listed '+direction+' contracts and option premium...';
   const contracts=await getUpstoxOptionContracts(key);
   if(!current())return;
   const selection=chooseAutoOptionContract({contracts,underlyingKey:key,spot:quote.lastPrice,direction,asOf:now});
   chosen=selection.contract;issues.push(...selection.reasons);
   if(!chosen){showPlan(null,null,issues);status.textContent='WAIT — verified option contract not found';return;}
   const [optionBars,optionQuote]=await Promise.allSettled([
    getUpstoxIntradayCandles(chosen.instrumentKey,'5m'),getUpstoxLiveQuote(chosen.instrumentKey)
   ]);
   if(!current())return;
   const premiumResearch=optionBars.status==='fulfilled'?
    analyzeIntradayCandles(optionBars.value.candles,{asOf:now,intervalMinutes:5,session}):null;
   const premiumQuote=optionQuote.status==='fulfilled'?
    extractUpstoxLiveQuoteEvidence(optionQuote.value,chosen.instrumentKey,now):null;
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
   if(current())button.disabled=false;
  }
 });
}
