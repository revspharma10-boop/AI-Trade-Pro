// Server-side, on-demand Upstox research feed for the minimal personal Android screen.
// GET requests only retrieve market evidence; the only upstream POST is Upstox's
// margin ESTIMATE API, never an order API. No simulated fills or executions.
import {marketClockState,publishedEquitySession2026} from '../src/services/intradayMarketClock.js';
import {analyzeIntradayCandles} from '../src/services/intradayTechnicalEngine.js';
import {deriveAutoOptionDirection,chooseAutoOptionContract,calculateAutoOptionPaperPlan}
 from '../src/services/autoOptionResearchEngine.js';
import {deriveOpeningRangeBias} from '../src/services/openingRangeResearch.js';
import {qualifyEarlyIndexConfluence,qualifyEarlyPremiumPlan} from './earlyPaperOptionResearch.js';
import {qualifyOneMinuteOrbWatch} from './oneMinuteOrbPaperWatch.js';
import {extractUpstoxLiveQuoteEvidence} from '../src/services/intradayRiskEngine.js';
import {describePaperRejection} from './recommendationWaitDiagnostics.js';
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
const validIso=value=>typeof value==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&
 Number.isFinite(Date.parse(value));
// An opening-range hypothesis is not an option signal or paper fill.
// Server verification of the exchange key, read-only quote, completed candles
// and current source-clock is necessary before publishing a direction preview.
export function qualifyProvisionalDirection({early,quote,underlyingKey,asOf}={}){
 const observed=Number(new Date(asOf));
 const completed=Date.parse(early?.lastCompletedAt??'');
 if(!Number.isFinite(observed)||!early?.valid||
   early.strategy!=='OPENING_RANGE_15M'||
   early.status!=='PROVISIONAL_OPENING_BIAS'||
   !['CE','PE'].includes(early.direction)||early.optionPlanQualified!==false||
   early.paperOnly!==true||early.orderSubmissionAllowed!==false||
   early.realOrderPlaced!==false||
   !/^(NSE_INDEX|BSE_INDEX)\|[A-Za-z0-9 _-]{1,75}$/.test(underlyingKey??'')||
   quote?.mode!=='READ_ONLY'||quote.instrumentKey!==underlyingKey||
   !positive(quote.lastPrice)||!Number.isFinite(quote.timestamp)||
   quote.timestamp>observed+10000||observed-quote.timestamp>120000||
   !Number.isFinite(completed)||completed+5*60000+12000>observed||
   dayIST(completed)!==dayIST(observed))return null;
 return Object.freeze({
  kind:'PROVISIONAL_DIRECTION',strategy:'OPENING_RANGE_15M',
  direction:early.direction==='CE'?'BULLISH':'BEARISH',
  observedAt:asIso(observed),lastCompletedAt:asIso(completed),
  source:'UPSTOX_READ_ONLY',recordedDurably:false,
  optionPlanQualified:false,paperOnly:true,orderSubmissionAllowed:false,
  realOrderPlaced:false
 });
}

export function qualifyPaperRecommendation(plan,contract,asOf=Date.now()){
 if(plan?.status!=='UNVALIDATED_PAPER_LEVELS'||!contract||
    plan.optionType!==contract.instrumentType||plan.direction!==contract.instrumentType||
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
 // A fresh HTTP response can be backed by an old in-memory result.
 // Require a coherent, dated backend observation before asserting PAPER_SETUP.
 const checkedAt=typeof result?.checkedAt==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result.checkedAt)?
  Date.parse(result.checkedAt):NaN;
 const capturedAt=typeof last?.capturedAt==='string'?Date.parse(last.capturedAt):NaN;
 const verifiedFresh=Number.isFinite(asOf)&&Number.isFinite(checkedAt)&&
  checkedAt<=asOf+10000&&asOf-checkedAt<=6*60000&&
  Number.isFinite(capturedAt)&&capturedAt<=asOf+10000&&
  checkedAt>=capturedAt-10000;
 const isCurrent=!!last&&verifiedFresh&&
  last.date===dayIST(asOf)&&
  fiveMinuteSlot(capturedAt)===fiveMinuteSlot(asOf)&&
  result?.state==='PAPER_SETUP';
 const state=isCurrent?'PAPER_SETUP':last?'PAST_PAPER_IDEA':'WAIT';
 const preview=result?.provisionalDirection;
 const previewAt=validIso(preview?.observedAt)?Date.parse(preview.observedAt):NaN;
 // Distinct provisional directions depend on their own valid read-only
 // observation and do not inherit any price/order fields from paper setup.
 const directionValid=state==='WAIT'&&['nifty','sensex'].includes(tab)&&
  ['OPENING_RANGE','EARLY_OPTION_WATCH','ONE_MINUTE_OPTION_WATCH'].includes(result?.stage)&&
  preview?.kind==='PROVISIONAL_DIRECTION'&&
  ['OPENING_RANGE_15M','ONE_MINUTE_ORB_EMA9_RSI14'].includes(preview.strategy)&&
  ['BULLISH','BEARISH'].includes(preview.direction)&&
  preview.source==='UPSTOX_READ_ONLY'&&
  !['contract','strike','expiry','entry','stopLoss','target','lots','approvedLots'].some(k=>
    Object.hasOwn(preview,k))&&
  preview.recordedDurably===false&&
  preview.paperOnly===true&&preview.optionPlanQualified===false&&
  preview.orderSubmissionAllowed===false&&preview.realOrderPlaced===false&&
  Number.isFinite(previewAt)&&previewAt<=asOf+10000&&
  Number.isFinite(checkedAt)&&checkedAt<=asOf+10000&&
  checkedAt>=previewAt-10000&&asOf-checkedAt<=6*60000&&
  fiveMinuteSlot(previewAt)===fiveMinuteSlot(asOf)&&
  dayIST(previewAt)===dayIST(asOf);
 return {
  tab,symbol:market.symbol,marketName:market.name,
  state,last:last??null,
  provisionalDirection:directionValid?preview:null,
  // Underlying/contract metadata is shown only when independently verified;
  // WAIT never authorizes entering, stopping or exiting a trade.
  verifiedContract:result?.verifiedContract??null,
  stage:result?.stage??null,
  blockers:result?.blockers??[],
  blockerCount:Number.isSafeInteger(result?.blockerCount)?
   result.blockerCount:(result?.blockers?.length??0),
  lastCheckedAt:result?.checkedAt??null,
  message:state==='PAST_PAPER_IDEA'?'Previous paper idea — not a current signal':
   result?.message??'No verified paper recommendation',
  ...RECOMMENDATION_FEED_SAFETY
 };
}
export function createPaperRecommendationFeed({
 searchIndex,searchEquity,searchDerivatives,getContracts,
 getCandles,getQuote,getMargin,getGreeks=async()=>null
}={}){
 if([searchIndex,searchEquity,searchDerivatives,getContracts,
  getCandles,getQuote,getMargin].some(fn=>typeof fn!=='function'))
  throw Error('RECOMMENDATION_FEED_DEPENDENCIES_REQUIRED');
 const lastByTab=new Map(),cache=new Map(),pending=new Map();
 async function research(tab,asOf){
  const market=RECOMMENDATION_MARKETS[tab];
  const session=marketClockState({segment:market.segment,
   underlyingSymbol:market.kind==='MCX'?market.symbol:'',asOf});
  const rejected=(stage,codes,more={})=>({
   ...describePaperRejection({stage,codes,contract:more.contract,asOf,
    fallback:more.fallback}),...(more.extra??{})
  });
  // A weekday within market hours is not automatically a trading session.
  // Check published closures first so holiday/weekend WAIT has an exact reason.
  // Valid option quotes, contract metadata and paper risk gates still apply.
  if(market.kind!=='MCX'){
   const schedule=publishedEquitySession2026({segment:market.segment,asOf});
   if(!schedule.regularSessionPlanned)
    return rejected('MARKET_SESSION',[schedule.reason]);
  }
  if(!session.open)return rejected('MARKET_SESSION',['MARKET_SESSION_CLOSED']);
  let contract=null,plan=null;
  if(market.kind==='MCX'){
   const [f,c,p]=await Promise.all([
    searchDerivatives(market.symbol,'FUT','MCX'),
    searchDerivatives(market.symbol,'CE','MCX'),
    searchDerivatives(market.symbol,'PE','MCX')
   ]);
   const futures=f?.contracts??[],options=[...(c?.contracts??[]),...(p?.contracts??[])];
   const pick=chooseMcxOptionUnderlying({futures,options,symbol:market.symbol,asOf});
   if(!pick.future)return rejected('MCX_UNDERLYING',
    pick.reasons?.length?pick.reasons:['MCX_FUTURE_AND_OPTION_UNDERLYING_LINK_NOT_VERIFIED']);
   const future=pick.future;
   const [bars,rawQuote]=await Promise.all([getCandles(future.instrumentKey,'5m'),
    getQuote(future.instrumentKey)]);
   const candlesticks=bars?.candles??bars??[];
   const underlying=analyzeIntradayCandles(candlesticks,{asOf,session,intervalMinutes:5});
   const quote=extractUpstoxLiveQuoteEvidence(rawQuote,future.instrumentKey,asOf);
   const direction=deriveMcxOptionDirection({future,research:underlying,quote,session,asOf});
   if(!['CE','PE'].includes(direction.direction))
    return rejected('MCX_TECHNICAL',direction.reasons?.length?direction.reasons:
     ['MCX_FUTURES_PRICE_NOT_VERIFIED'],{fallback:'MCX_FUTURES_PRICE_NOT_VERIFIED'});
   const selection=chooseMcxOptionContract({options,future,spot:quote.lastPrice,
    direction:direction.direction,asOf});
   contract=selection.contract;
   if(!contract)return rejected('MCX_CONTRACT',selection.reasons?.length?
    selection.reasons:['EXACT_MCX_OPTION_CONTRACT_NOT_FOUND'],
    {fallback:'EXACT_MCX_OPTION_CONTRACT_NOT_FOUND'});
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
   return rejected('MCX_OPTION_QUALIFICATION',
    [...(plan.reasons??[]),'MCX_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED'],
    {contract,fallback:'MCX_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED'});
  }

  const underlying=market.kind==='INDEX'?await searchIndex(market.symbol):
   await searchEquity(market.symbol);
  if(!underlying?.instrumentKey||
    (market.kind==='STOCK'&&String(underlying.tradingSymbol??'').toUpperCase()!==market.symbol))
   return rejected('UNDERLYING',['UNDERLYING_NOT_VERIFIED']);
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
    const provisionalDirection=qualifyProvisionalDirection({
     early,quote,underlyingKey:key,asOf});
    // Before 10:30 IST, the 35-bar and 15-bar 5m models cannot qualify.
    // Independently verify all 15 opening 1m candles and two later *completed*
    // 1m breakout candles rather than manufacturing a 5m confirmation.
    const nowIST=new Date(asOf+330*60000);
    const minuteIST=nowIST.getUTCHours()*60+nowIST.getUTCMinutes();
    let oneMinuteReasons=[];
    if(technical.completedBars<15&&minuteIST>=572&&minuteIST<915){
     const oneMinuteRead=await Promise.allSettled([getCandles(key,'1m')]);
     const oneMinuteRaw=oneMinuteRead[0].status==='fulfilled'?
      (oneMinuteRead[0].value?.candles??oneMinuteRead[0].value??[]):[];
     const fast=qualifyOneMinuteOrbWatch({
      candles:oneMinuteRaw,quote,session,asOf});
     oneMinuteReasons=oneMinuteRead[0].status==='rejected'?
      ['ONE_MINUTE_CANDLES_UNAVAILABLE']:fast.valid?[]:fast.reasons;
     if(fast.valid){
      const fastPreview=Object.freeze({
       kind:'PROVISIONAL_DIRECTION',strategy:'ONE_MINUTE_ORB_EMA9_RSI14',
       direction:fast.direction==='CE'?'BULLISH':'BEARISH',
       observedAt:asIso(asOf),lastCompletedAt:fast.latestCompletedAt,
       source:'UPSTOX_READ_ONLY',recordedDurably:false,optionPlanQualified:false,
       paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false});
      const contracts=await getContracts(key);
      const selected=chooseAutoOptionContract({contracts,underlyingKey:key,
       spot:quote.lastPrice,direction:fast.direction,asOf});
      contract=selected.contract;
      if(!contract)return rejected('ONE_MINUTE_OPTION_WATCH',selected.reasons?.length?
       selected.reasons:['NO_VERIFIED_FUTURE_EXPIRY_OPTION_CONTRACT'],
       {extra:{provisionalDirection:fastPreview}});
      const [premiumBars,rawPremium,rawGreeks]=await Promise.allSettled([
       getCandles(contract.instrumentKey,'1m'),getQuote(contract.instrumentKey),
       getGreeks(contract.instrumentKey)]);
      const optionCandles=premiumBars.status==='fulfilled'?
       (premiumBars.value?.candles??premiumBars.value??[]):[];
      const optionQuote=extractUpstoxLiveQuoteEvidence(
       rawPremium.status==='fulfilled'?rawPremium.value:null,
       contract.instrumentKey,asOf);
      const greeks=rawGreeks.status==='fulfilled'?rawGreeks.value:null;
      const args={contract,underlyingKey:key,direction:fast.direction,
       rawCandles:optionCandles,optionQuote,greeks,asOf,intervalMinutes:1};
      plan=qualifyEarlyPremiumPlan(args);
      let marginFailed=false;
      if(plan.status==='MARGIN_REQUIRED'){
       try{
        const margin=await getMargin({instrumentKey:contract.instrumentKey,
         side:'BUY',quantity:contract.lotSize,price:plan.entry});
        plan=qualifyEarlyPremiumPlan({...args,marginQuote:margin});
       }catch(_error){marginFailed=true;}
      }
      if(plan.status==='UNVALIDATED_PAPER_LEVELS'){
       const candidate=qualifyPaperRecommendation(plan,contract,asOf);
       if(candidate)return {state:'PAPER_SETUP',stage:'ONE_MINUTE_OPTION_WATCH',
        message:'EXPERIMENTAL 1m paper watch • Not executed or backtested',
        qualified:{...candidate,label:'EXPERIMENTAL 1M PAPER WATCH',
         strategyVersion:fast.strategyVersion,strategyValidated:false,
         modelBacktested:false,optionPremiumGreeksVerified:true,
         feeReserveEstimated:true,feesAndGapsIncluded:false}};
      }
      return rejected('ONE_MINUTE_OPTION_WATCH',[
       ...(plan.reasons??[]),
       ...(premiumBars.status==='rejected'?['ONE_MINUTE_OPTION_CANDLES_UNAVAILABLE']:[]),
       ...(rawPremium.status==='rejected'?['FRESH_EARLY_OPTION_BID_ASK_REQUIRED']:[]),
       ...(rawGreeks.status==='rejected'?['BROKER_OPTION_GREEKS_IV_REQUIRED']:[]),
       ...(marginFailed?['BROKER_MARGIN_ESTIMATE_UNAVAILABLE']:[])
      ],{contract,fallback:'EARLY_PAPER_SETUP_NOT_QUALIFIED',
       extra:{provisionalDirection:fastPreview}});
     }
    }
    const confluence=qualifyEarlyIndexConfluence({candles,quote,opening:early,session,asOf});
    if(confluence.valid){
     // A confirmed index breakout is only the first gate. Never treat it
     // as proof that buying its option premium is a qualified paper idea.
     const contracts=await getContracts(key);
     const selected=chooseAutoOptionContract({contracts,underlyingKey:key,
      spot:quote.lastPrice,direction:confluence.direction,asOf});
     contract=selected.contract;
     if(!contract)return rejected('EARLY_OPTION_WATCH',selected.reasons??[
      'NO_VERIFIED_FUTURE_EXPIRY_OPTION_CONTRACT'],{
       extra:provisionalDirection?{provisionalDirection}:{}});
     const [optionCandlesResult,optionRawResult,optionGreeksResult]=await Promise.allSettled([
      getCandles(contract.instrumentKey,'5m'),
      getQuote(contract.instrumentKey),
      getGreeks(contract.instrumentKey)
     ]);
     const optionBars=optionCandlesResult.status==='fulfilled'?
      (optionCandlesResult.value?.candles??optionCandlesResult.value??[]):[];
     const optionQuote=extractUpstoxLiveQuoteEvidence(
      optionRawResult.status==='fulfilled'?optionRawResult.value:null,
      contract.instrumentKey,asOf);
     const greeks=optionGreeksResult.status==='fulfilled'?optionGreeksResult.value:null;
     const args={contract,underlyingKey:key,direction:confluence.direction,
      rawCandles:optionBars,optionQuote,greeks,asOf};
     plan=qualifyEarlyPremiumPlan(args);
     let marginLookupFailed=false;
     if(plan.status==='MARGIN_REQUIRED'){
      try{
       const margin=await getMargin({instrumentKey:contract.instrumentKey,side:'BUY',
        quantity:contract.lotSize,price:plan.entry});
       plan=qualifyEarlyPremiumPlan({...args,marginQuote:margin});
      }catch(_error){marginLookupFailed=true;}
     }
     if(plan.status==='UNVALIDATED_PAPER_LEVELS'){
      const candidate=qualifyPaperRecommendation(plan,contract,asOf);
      if(candidate)return {state:'PAPER_SETUP',stage:'EARLY_OPTION_WATCH',
       message:'Experimental early paper setup • Not executed or backtested',
       qualified:{...candidate,label:'EXPERIMENTAL PAPER WATCH',
        strategyVersion:confluence.strategyVersion,strategyValidated:false,
        modelBacktested:false,optionPremiumGreeksVerified:true,
        feeReserveEstimated:true,feesAndGapsIncluded:false}};
     }
     return rejected('EARLY_OPTION_WATCH',[
      ...(plan.reasons??[]),
      ...(optionCandlesResult.status==='rejected'?['FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED']:[]),
      ...(optionRawResult.status==='rejected'?['FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED']:[]),
      ...(optionGreeksResult.status==='rejected'?['BROKER_OPTION_GREEKS_IV_REQUIRED']:[]),
      ...(marginLookupFailed?['BROKER_MARGIN_ESTIMATE_UNAVAILABLE']:[])
     ],{contract,fallback:'EARLY_PAPER_SETUP_NOT_QUALIFIED',
      extra:provisionalDirection?{provisionalDirection}:{}});
    }
    return rejected('OPENING_RANGE',
     provisionalDirection?['OPENING_RANGE_BIAS_ONLY',...oneMinuteReasons,...(confluence.reasons??[])]:
      ['OPENING_RANGE_NOT_CONFIRMED',...oneMinuteReasons,...(confluence.reasons??[])],
     {fallback:'OPENING_RANGE_NOT_CONFIRMED',
      extra:provisionalDirection?{provisionalDirection}:{}});
   }
   return rejected('UNDERLYING_TECHNICAL',
    direction.reasons?.length?direction.reasons:['NO_CLEAR_TECHNICAL_DIRECTION'],
    {fallback:'NO_CLEAR_TECHNICAL_DIRECTION'});
  }
  const contracts=await getContracts(key);
  const selected=chooseAutoOptionContract({contracts,underlyingKey:key,
   spot:quote.lastPrice,direction:direction.direction,asOf});
  contract=selected.contract;
  if(!contract)return rejected('OPTION_CONTRACT',
   selected.reasons?.length?selected.reasons:['OPTION_CONTRACT_NOT_VERIFIED'],
   {fallback:'OPTION_CONTRACT_NOT_VERIFIED'});
  // A failed option-quote endpoint must not erase a verified contract. Do not
  // fabricate option prices; the existing option plan will fail closed with
  // exact quote/candle rejection codes when either response is unavailable.
  const [optionBarsResult,optionQuoteResult]=await Promise.allSettled([
   getCandles(contract.instrumentKey,'5m'),getQuote(contract.instrumentKey)]);
  const optionBars=optionBarsResult.status==='fulfilled'?optionBarsResult.value:null;
  const rawOptionQuote=optionQuoteResult.status==='fulfilled'?optionQuoteResult.value:null;
  const optionResearch=analyzeIntradayCandles(optionBars?.candles??optionBars??[],
   {asOf,session,intervalMinutes:5});
  const optionQuote=extractUpstoxLiveQuoteEvidence(rawOptionQuote,contract.instrumentKey,asOf);
  const args={direction:direction.direction,contract,underlyingKey:key,
   optionQuote,optionResearch,asOf};
  plan=calculateAutoOptionPaperPlan(args);
  let marginLookupFailed=false;
  if(plan.status==='UNVALIDATED_PAPER_LEVELS'&&plan.preliminaryRiskLots>=1){
   try{
    const margin=await getMargin({instrumentKey:contract.instrumentKey,side:'BUY',
     quantity:contract.lotSize,price:plan.entry});
    plan=calculateAutoOptionPaperPlan({...args,marginQuote:margin});
   }catch(_e){marginLookupFailed=true;/* No fabricated broker margin. */}
  }
  const qualified=qualifyPaperRecommendation(plan,contract,asOf);
  return qualified?
   {state:'PAPER_SETUP',stage:'PAPER_LEVELS',message:'Provisional paper levels • Not executed',qualified}:
   rejected('OPTION_PREMIUM_AND_RISK',[
    ...(plan.reasons??[]),
    ...(optionBarsResult.status==='rejected'?['FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED']:[]),
    ...(optionQuoteResult.status==='rejected'?['FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED']:[]),
    ...(marginLookupFailed?['BROKER_MARGIN_ESTIMATE_UNAVAILABLE']:[])
   ],{contract,fallback:'PAPER_ENVELOPE_NOT_QUALIFIED'});
 }
 async function getLatest(tab,asOf=Date.now()){
  if(!Object.hasOwn(RECOMMENDATION_MARKETS,tab))throw Error('UNSUPPORTED_RECOMMENDATION_TAB');
  const now=Number(new Date(asOf));
  if(!Number.isFinite(now))throw Error('INVALID_RECOMMENDATION_CLOCK');
  const slot=fiveMinuteSlot(now),previous=cache.get(tab);
  // Freeze each successfully captured early hypothesis for its five-minute
  // window. This is process-local, NOT a durable forecast ledger.
  // Frozen, risk-qualified paper ideas remain unchanged for their 5-minute
  // slot. An unqualified directional preview is NOT an entry; during the
  // early 1m watch it may be rechecked after the short cache TTL.
  const local=new Date(now+330*60000),localMinute=local.getUTCHours()*60+local.getUTCMinutes();
  const fastPreviewRefresh=['nifty','sensex'].includes(tab)&&
   localMinute>=572&&localMinute<630;
  if(previous?.slot===slot&&
     (previous.result.state==='PAPER_SETUP'||
      (!fastPreviewRefresh&&previous.result.provisionalDirection)||
      now-previous.checkedAt<45000)){
   return presentRecommendation({tab,last:lastByTab.get(tab)??null,result:previous.result,asOf:now});
  }
  if(pending.has(tab))return pending.get(tab);
  const promise=(async()=>{
   let result;
   try{result=await research(tab,now);}
   catch(e){
    // Translate only known, sanitized broker codes. Never leak token values,
    // upstream payloads, or arbitrary exceptions to a public mobile UI.
    result=describePaperRejection({stage:'UPSTOX_DATA',
     codes:[safeError(e)],asOf:now,fallback:'RECOMMENDATION_BACKEND_UNAVAILABLE'});
   }
   const checkedAt=asIso(now);
   result={...result,checkedAt};
   if(result.qualified)lastByTab.set(tab,result.qualified);
   cache.set(tab,{slot,checkedAt:now,result});
   // Same observation clock as the broker snapshot: deterministic replay and
   // no accidental comparison of a historical fixture to host wall-clock time.
   return presentRecommendation({tab,last:lastByTab.get(tab)??null,result,asOf:now});
  })();
  pending.set(tab,promise);
  try{return await promise;}finally{pending.delete(tab);}
 }
 return {getLatest,markets:RECOMMENDATION_MARKETS,
  safety:RECOMMENDATION_FEED_SAFETY};
}
