// Server-side, on-demand Upstox research feed for the minimal personal Android screen.
// GET requests only retrieve market evidence; the only upstream POST is Upstox's
// margin ESTIMATE API, never an order API. No simulated fills or executions.
import {marketClockState} from '../src/services/intradayMarketClock.js';
import {analyzeIntradayCandles} from '../src/services/intradayTechnicalEngine.js';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan}
 from '../src/services/autoOptionResearchEngine.js';
import {deriveOpeningRangeBias} from '../src/services/openingRangeResearch.js';
import {extractUpstoxLiveQuoteEvidence} from '../src/services/intradayRiskEngine.js';
import {chooseMcxOptionUnderlying,deriveMcxOptionDirection,
 chooseMcxOptionContract,calculateMcxOptionPaperPlan}
 from '../src/services/mcxAutoOptionResearchEngine.js';

export const RECOMMENDATION_MARKETS=Object.freeze({
 nifty:Object.freeze({symbol:'NIFTY',name:'NIFTY 50',kind:'INDEX',segment:'NSE_INDEX'}),
 sensex:Object.freeze({symbol:'SENSEX',name:'SENSEX',kind:'INDEX',segment:'BSE_INDEX'}),
 options:Object.freeze({symbol:'INFY',name:'STOCK OPTIONS',kind:'STOCK',segment:'NSE_EQ'}),
 commodity:Object.freeze({symbol:'GOLD',name:'MCX COMMODITY',kind:'MCX',segment:'MCX_FO'})
});
export const RECOMMENDATION_FEED_SAFETY=Object.freeze({
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 productionRealTradingEnabled:false,approvedLots:0
});
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const asIso=ms=>new Date(ms).toISOString();
const dayIST=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const fiveMinuteSlot=ms=>Math.floor((ms-12000)/300000);
const safeError=e=>{
 const value=String(e?.message??e??'');
 return /^[A-Z0-9_]{4,110}$/.test(value)?value:'UPSTOX_RESEARCH_DATA_UNAVAILABLE';
};
const fail=(state,message,more={})=>({state,message,...more});

export function qualifyPaperRecommendation(plan,contract,asOf=Date.now()){
 if(plan?.status!=='UNVALIDATED_PAPER_LEVELS'||!contract||
    !['CE','PE'].includes(contract.instrumentType)||
    !positive(contract.strike)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(contract.expiry??'')||
    contract.expiry<=dayIST(asOf)||
    !Number.isSafeInteger(contract.lotSize)||contract.lotSize<1||
    typeof contract.tradingSymbol!=='string'||!contract.tradingSymbol.trim()||
    plan.brokerMarginVerified!==true||!Number.isInteger(plan.paperEnvelopeLots)||
    plan.paperEnvelopeLots<1||plan.orderSubmissionAllowed!==false||
    plan.realOrderPlaced!==false)return null;
 // An MCX multiplier is not independently verified by the existing research engine;
 // retain WAIT instead of presenting MCX paper BUY prices as a qualified setup.
 if(contract.segment==='MCX_FO'&&plan.independentlyVerifiedContractMultiplier!==true)
  return null;
 if(![plan.entry,plan.stopLoss,plan.target1,plan.target2,plan.target3].every(positive)||
    !(plan.stopLoss<plan.entry&&plan.entry<plan.target1&&
      plan.target1<plan.target2&&plan.target2<plan.target3)||
    !positive(plan.riskPerLot)||plan.riskPerLot>500)return null;
 return Object.freeze({
  symbol:String(contract.underlyingSymbol??''),
  contract:String(contract.tradingSymbol),
  optionType:contract.instrumentType,strike:contract.strike,
  expiry:contract.expiry,entry:plan.entry,
  stopLoss:plan.stopLoss,target:plan.target1,
  capturedAt:asIso(asOf),date:dayIST(asOf),
  lotSize:contract.lotSize,
  label:'PAPER BUY',executionStatus:'NOT EXECUTED',
  // We intentionally do not send "approved lots" greater than zero.
  approvedLots:0,paperOnly:true
 });
}
export function presentRecommendation({tab,last=null,result=null,asOf=Date.now()}={}){
 const market=RECOMMENDATION_MARKETS[tab];
 if(!market)throw Error('UNSUPPORTED_RECOMMENDATION_TAB');
 const isCurrent=!!last&&
  last.date===dayIST(asOf)&&
  fiveMinuteSlot(Date.parse(last.capturedAt))===fiveMinuteSlot(asOf)&&
  result?.state==='PAPER_SETUP';
 const state=isCurrent?'PAPER_SETUP':last?'PAST_PAPER_IDEA':'WAIT';
 return {
  tab,symbol:market.symbol,marketName:market.name,
  state,last:last??null,
  lastCheckedAt:result?.checkedAt??null,
  message:state==='PAST_PAPER_IDEA'?'Previous paper idea — not a current signal':
   result?.message??'No verified paper recommendation',
  ...RECOMMENDATION_FEED_SAFETY
 };
}
export function createPaperRecommendationFeed({
 searchIndex,searchEquity,searchDerivatives,getContracts,
 getCandles,getQuote,getMargin
}={}){
 if([searchIndex,searchEquity,searchDerivatives,getContracts,
  getCandles,getQuote,getMargin].some(fn=>typeof fn!=='function'))
  throw Error('RECOMMENDATION_FEED_DEPENDENCIES_REQUIRED');
 const lastByTab=new Map(),cache=new Map(),pending=new Map();
 async function research(tab,asOf){
  const market=RECOMMENDATION_MARKETS[tab];
  const session=marketClockState({segment:market.segment,
   underlyingSymbol:market.kind==='MCX'?market.symbol:'',asOf});
  if(!session.open)return fail('WAIT','Market session closed or not verified');
  let contract=null,plan=null;
  if(market.kind==='MCX'){
   const [f,c,p]=await Promise.all([
    searchDerivatives(market.symbol,'FUT','MCX'),
    searchDerivatives(market.symbol,'CE','MCX'),
    searchDerivatives(market.symbol,'PE','MCX')
   ]);
   const futures=f?.contracts??[],options=[...(c?.contracts??[]),...(p?.contracts??[])];
   const pick=chooseMcxOptionUnderlying({futures,options,symbol:market.symbol,asOf});
   if(!pick.future)return fail('WAIT','MCX futures/option linkage not verified');
   const future=pick.future;
   const [bars,rawQuote]=await Promise.all([getCandles(future.instrumentKey,'5m'),
    getQuote(future.instrumentKey)]);
   const candlesticks=bars?.candles??bars??[];
   const underlying=analyzeIntradayCandles(candlesticks,{asOf,session,intervalMinutes:5});
   const quote=extractUpstoxLiveQuoteEvidence(rawQuote,future.instrumentKey,asOf);
   const direction=deriveMcxOptionDirection({future,research:underlying,quote,session,asOf});
   if(!['CE','PE'].includes(direction.direction))
    return fail('WAIT','No verified commodity CALL/PUT setup');
   contract=chooseMcxOptionContract({options,future,spot:quote.lastPrice,
    direction:direction.direction,asOf}).contract;
   if(!contract)return fail('WAIT','Exact MCX option contract not verified');
   const [optionBars,optionRaw]=await Promise.all([
    getCandles(contract.instrumentKey,'5m'),getQuote(contract.instrumentKey)]);
   const optionResearch=analyzeIntradayCandles(optionBars?.candles??optionBars??[],
    {asOf,session,intervalMinutes:5});
   const optionQuote=extractUpstoxLiveQuoteEvidence(optionRaw,contract.instrumentKey,asOf);
   const args={contract,future,direction:direction.direction,
    quote:optionQuote,research:optionResearch,asOf};
   plan=calculateMcxOptionPaperPlan(args);
   if(plan.status==='UNVALIDATED_PAPER_LEVELS'&&plan.preliminaryRiskLots>=1){
    try{
     const margin=await getMargin({instrumentKey:contract.instrumentKey,side:'BUY',
      quantity:contract.lotSize,price:plan.entry});
     plan=calculateMcxOptionPaperPlan({...args,marginQuote:margin});
    }catch(_e){/* A missing margin must fail closed. */}
   }
   return {state:'WAIT',message:'MCX multiplier/delivery risk not independently verified',
    contract,plan};
  }

  const underlying=market.kind==='INDEX'?await searchIndex(market.symbol):
   await searchEquity(market.symbol);
  if(!underlying?.instrumentKey)return fail('WAIT','Exact underlying instrument not verified');
  const key=underlying.instrumentKey;
  const [bars,rawQuote]=await Promise.all([getCandles(key,'5m'),getQuote(key)]);
  const candles=bars?.candles??bars??[];
  const technical=analyzeIntradayCandles(candles,{asOf,intervalMinutes:5,session});
  const quote=market.kind==='INDEX'?rawQuote:
    extractUpstoxLiveQuoteEvidence(rawQuote,key,asOf);
  const direction=deriveAutoOptionDirection({research:technical,underlyingQuote:quote,
   underlyingSegment:market.segment,session,asOf});
  if(direction.direction==='WAIT'){
   if(market.kind==='INDEX'&&technical.completedBars<35){
    const early=deriveOpeningRangeBias({candles,quote,session,asOf});
    return fail('WAIT',['CE','PE'].includes(early.direction)?
     'Early '+early.direction+' bias only — no verified option premium':
     'WAIT — completed candles or directional evidence incomplete');
   }
   return fail('WAIT','WAIT — five-minute technical checks not aligned');
  }
  const contracts=await getContracts(key);
  contract=chooseAutoOptionContract({contracts,underlyingKey:key,
   spot:quote.lastPrice,direction:direction.direction,asOf}).contract;
  if(!contract)return fail('WAIT','Exact exchange option contract not verified');
  const [optionBars,rawOptionQuote]=await Promise.all([
   getCandles(contract.instrumentKey,'5m'),getQuote(contract.instrumentKey)]);
  const optionResearch=analyzeIntradayCandles(optionBars?.candles??optionBars??[],
   {asOf,session,intervalMinutes:5});
  const optionQuote=extractUpstoxLiveQuoteEvidence(rawOptionQuote,contract.instrumentKey,asOf);
  const args={direction:direction.direction,contract,underlyingKey:key,
   optionQuote,optionResearch,asOf};
  plan=calculateAutoOptionPaperPlan(args);
  if(plan.status==='UNVALIDATED_PAPER_LEVELS'&&plan.preliminaryRiskLots>=1){
   try{
    const margin=await getMargin({instrumentKey:contract.instrumentKey,side:'BUY',
     quantity:contract.lotSize,price:plan.entry});
    plan=calculateAutoOptionPaperPlan({...args,marginQuote:margin});
   }catch(_e){/* No fabricated broker margin. */}
  }
  const qualified=qualifyPaperRecommendation(plan,contract,asOf);
  return qualified?
   {state:'PAPER_SETUP',message:'Provisional paper levels • Not executed',qualified}:
   fail('WAIT','Option premium, risk or broker margin not qualified');
 }
 async function getLatest(tab,asOf=Date.now()){
  if(!Object.hasOwn(RECOMMENDATION_MARKETS,tab))throw Error('UNSUPPORTED_RECOMMENDATION_TAB');
  const now=Number(new Date(asOf));
  if(!Number.isFinite(now))throw Error('INVALID_RECOMMENDATION_CLOCK');
  const slot=fiveMinuteSlot(now),previous=cache.get(tab);
  if(previous?.slot===slot&&now-previous.checkedAt<45000){
   return presentRecommendation({tab,last:lastByTab.get(tab)??null,result:previous.result,asOf:now});
  }
  if(pending.has(tab))return pending.get(tab);
  const promise=(async()=>{
   let result;
   try{result=await research(tab,now);}
   catch(e){result=fail('WAIT','Market data unavailable: '+safeError(e));}
   const checkedAt=asIso(now);
   result={...result,checkedAt};
   if(result.qualified)lastByTab.set(tab,result.qualified);
   cache.set(tab,{slot,checkedAt:now,result});
   return presentRecommendation({tab,last:lastByTab.get(tab)??null,result,asOf:now});
  })();
  pending.set(tab,promise);
  try{return await promise;}finally{pending.delete(tab);}
 }
 return {getLatest,markets:RECOMMENDATION_MARKETS,
  safety:RECOMMENDATION_FEED_SAFETY};
}
