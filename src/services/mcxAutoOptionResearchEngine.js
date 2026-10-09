// MCX long CE/PE paper-research engine. Exchange instruments, no synthetic keys.
// This engine NEVER authorizes orders or actual trading.
import {deriveIntradayPaperSignal} from './intradayPaperSignalEngine.js';
import {AUTO_OPTION_SAFETY} from './autoOptionResearchEngine.js';
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>valid(n)&&n>0;
const dayIST=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const money=n=>Math.ceil((n-1e-9)*100)/100; // Never round estimated risk downward.
const tickOf=i=>positive(i?.tickSize)?Number((i.tickSize/100).toFixed(4)):null;
const aligned=(n,tick,mode)=>Number(((mode==='up'?Math.ceil(n/tick-1e-9):Math.floor(n/tick+1e-9))*tick).toFixed(4));
export const MCX_OPTION_SAFETY=AUTO_OPTION_SAFETY;
const mcxKey=s=>/^MCX_FO\|[A-Za-z0-9_]+$/.test(s||'');
const root=s=>String(s||'').trim().toUpperCase();
const futureValid=(i,now)=>i?.segment==='MCX_FO'&&i.instrumentType==='FUT'&&
  mcxKey(i.instrumentKey)&&root(i.underlyingSymbol)&&root(i.tradingSymbol)&&
  /^\d{4}-\d{2}-\d{2}$/.test(i.expiry||'')&&i.expiry>dayIST(now);
const optionMetadataValid=(i,now)=>i?.segment==='MCX_FO'&&['CE','PE'].includes(i.instrumentType)&&
  mcxKey(i.instrumentKey)&&mcxKey(i.underlyingKey)&&root(i.underlyingSymbol)&&
  root(i.tradingSymbol)&&/^\d{4}-\d{2}-\d{2}$/.test(i.expiry||'')&&
  i.expiry>dayIST(now)&&positive(i.strike)&&
  Number.isSafeInteger(i.lotSize)&&i.lotSize>0&&
  Number.isSafeInteger(i.qtyMultiplier)&&i.qtyMultiplier>0&&
  positive(tickOf(i));

export function chooseMcxOptionUnderlying({futures=[],options=[],symbol='',asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),name=root(symbol);
 if(!/^[A-Z0-9]{2,30}$/.test(name)||!valid(now))
  return {future:null,reasons:['VALID_MCX_UNDERLYING_SYMBOL_REQUIRED']};
 const eligible=(Array.isArray(options)?options:[]).filter(o=>optionMetadataValid(o,now)&&root(o.underlyingSymbol)===name);
 const underlyingKeys=new Set(eligible.map(o=>o.underlyingKey));
 const matches=(Array.isArray(futures)?futures:[]).filter(f=>
  futureValid(f,now)&&root(f.underlyingSymbol)===name&&underlyingKeys.has(f.instrumentKey));
 matches.sort((a,b)=>a.expiry.localeCompare(b.expiry)||a.instrumentKey.localeCompare(b.instrumentKey));
 if(!matches.length)return {future:null,reasons:['MCX_FUTURE_AND_OPTION_UNDERLYING_LINK_NOT_VERIFIED']};
 return {future:matches[0],reasons:[],source:'EXACT_UPSTOX_OPTION_UNDERLYING_KEY'};
}
export function deriveMcxOptionDirection({future=null,research=null,quote=null,session=null,asOf=Date.now()}={}){
 const signal=deriveIntradayPaperSignal({instrument:future??{},research,quote,session,asOf});
 return {direction:signal.direction==='BUY'?'CE':signal.direction==='SELL'?'PE':'WAIT',
  reasons:[...signal.blocks],underlyingDirection:signal.direction,
  status:signal.status,...MCX_OPTION_SAFETY};
}
export function chooseMcxOptionContract({options=[],future=null,spot=null,direction='WAIT',asOf=Date.now()}={}){
 const now=Number(new Date(asOf));
 if(!futureValid(future,now)||!positive(spot)||!['CE','PE'].includes(direction))
  return {contract:null,reasons:['EXACT_MCX_FUTURE_PRICE_AND_DIRECTION_REQUIRED']};
 const eligible=(Array.isArray(options)?options:[]).filter(i=>
  optionMetadataValid(i,now)&&i.underlyingKey===future.instrumentKey&&
  root(i.underlyingSymbol)===root(future.underlyingSymbol)&&i.instrumentType===direction);
 if(!eligible.length)return {contract:null,reasons:['EXACT_MCX_OPTION_CONTRACT_NOT_FOUND']};
 eligible.sort((a,b)=>a.expiry.localeCompare(b.expiry)||
  Math.abs(a.strike-spot)-Math.abs(b.strike-spot)||
  a.strike-b.strike||a.instrumentKey.localeCompare(b.instrumentKey));
 return {contract:eligible[0],reasons:[],selection:'EXACT_FUTURE_LINK_NEAREST_NON_EXPIRY_OPTION_ATM'};
}
export function calculateMcxOptionPaperPlan({contract=null,future=null,direction='WAIT',
 quote=null,research=null,marginQuote=null,capital=50000,riskBudget=500,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),reasons=[],tick=tickOf(contract),units=contract?.lotSize*contract?.qtyMultiplier;
 const base={status:'WAIT',direction,contract:contract?.tradingSymbol??null,optionType:direction,
  capital,riskBudget,lotSize:contract?.lotSize??null,qtyMultiplier:contract?.qtyMultiplier??null,
  exposureUnitsPerLot:Number.isSafeInteger(units)&&units>0?units:null,
  exchangeTick:tick,entry:null,stopLoss:null,target1:null,target2:null,target3:null,
  riskPerLot:null,optionPremiumCostPerLot:null,preliminaryRiskLots:null,
  capitalAffordabilityLots:null,brokerRequiredMarginPerLot:null,
  brokerMarginVerified:false,paperEnvelopeLots:null,approvedLots:0,
  independentlyVerifiedContractMultiplier:false,brokerAvailableFundsVerified:false,
  feesAndGapsIncluded:false,modelBacktested:false,reasons:[],...MCX_OPTION_SAFETY};
 if(!futureValid(future,now)||!optionMetadataValid(contract,now)||
   contract?.underlyingKey!==future?.instrumentKey||root(contract?.underlyingSymbol)!==root(future?.underlyingSymbol)||
   contract?.instrumentType!==direction)
  reasons.push('EXACT_UNEXPIRED_MCX_OPTION_AND_FUTURE_LINK_REQUIRED');
 if(!['CE','PE'].includes(direction))reasons.push('PROVISIONAL_LONG_CE_OR_PE_REQUIRED');
 if(capital!==50000||riskBudget!==500)reasons.push('CAPITAL_AND_500_RISK_BUDGET_LOCKED');
 if(!positive(tick)||!Number.isSafeInteger(units)||units<1)
  reasons.push('MCX_TICK_OR_LOT_MULTIPLIER_NOT_VERIFIED');
 if(!quote?.valid||!positive(quote.bid)||!positive(quote.ask)||quote.ask<quote.bid||!positive(quote.lastPrice)||
   !valid(quote.timestamp)||!valid(quote.lastTradeTime)||
   quote.timestamp>now+10000||quote.lastTradeTime>now+10000||
   now-quote.timestamp>120000||now-quote.lastTradeTime>120000)
  reasons.push('FRESH_MCX_OPTION_BID_ASK_TRADE_REQUIRED');
 if(!valid(quote?.spreadPercent)||quote.spreadPercent<0||quote.spreadPercent>2)
  reasons.push('MCX_OPTION_SPREAD_UNVERIFIED_OR_WIDE');
 if(!positive(quote?.openInterest)||!positive(quote?.tradedVolume))
  reasons.push('MCX_OPTION_OPEN_INTEREST_OR_VOLUME_NOT_VERIFIED');
 // MCX options are quoted in premiums; multiplying raw candle price by traded
 // contract count is NOT verified rupee turnover. Do not reuse the
 // equity/futures ₹10-lakh turnover test for option-premium candles.
 const s=research?.snapshot;
 if(!research?.valid||research.completedBars<35||!positive(s?.atr14)||
    !valid(s?.medianVolume20)||s.medianVolume20<10||
    !valid(s?.lastVolumeRatio)||s.lastVolumeRatio<0.3)
  reasons.push('FRESH_MCX_OPTION_PREMIUM_AND_VOLUME_REQUIRED');
 if(reasons.length){base.reasons=[...new Set(reasons)];return base;}
 const entry=aligned(quote.ask,tick,'up');
 const stopLoss=aligned(entry-Math.max(1.5*research.snapshot.atr14,3*tick),tick,'down');
 const r=entry-stopLoss;
 const target1=aligned(entry+1.5*r,tick,'down'),target2=aligned(entry+2*r,tick,'down'),
  target3=aligned(entry+3*r,tick,'down');
 if(!positive(entry)||!positive(stopLoss)||!positive(r)||target1<=entry||target2<=target1||target3<=target2){
  base.reasons=['MCX_OPTION_PREMIUM_LEVELS_INVALID'];return base;
 }
 const loss=money((r+2*tick)*units),premium=money(entry*units);
 if(!positive(loss)||!positive(premium)){base.reasons=['MCX_OPTION_EXPOSURE_INVALID'];return base;}
 const riskLots=Math.floor(riskBudget/loss),cashLots=Math.floor(capital/premium);
 // Never give a BUY-research level when one contract already exceeds the user's risk or capital.
 if(riskLots<1||cashLots<1){
  base.reasons=[...(riskLots<1?['ONE_MCX_OPTION_LOT_EXCEEDS_500_RISK_BUDGET']:[]),
   ...(cashLots<1?['ONE_MCX_OPTION_LOT_EXCEEDS_50000_PREMIUM_BUDGET']:[])];
  return Object.assign(base,{riskPerLot:loss,optionPremiumCostPerLot:premium,
    preliminaryRiskLots:riskLots,capitalAffordabilityLots:cashLots});
 }
 const margin=Number(marginQuote?.requiredMargin);
 const marginVerified=marginQuote?.verified===true&&positive(margin)&&
   marginQuote.instrumentKey===contract.instrumentKey&&marginQuote.direction==='BUY'&&
   marginQuote.quantity===contract.lotSize&&marginQuote.product==='I'&&
   valid(marginQuote.price)&&Math.abs(marginQuote.price-entry)<0.000001&&
   valid(marginQuote.asOf)&&marginQuote.asOf<=now+10000&&now-marginQuote.asOf<180000;
 const envelope=marginVerified?Math.min(riskLots,cashLots,Math.floor(capital/Math.max(premium,margin))):null;
 return Object.assign(base,{
  status:'UNVALIDATED_PAPER_LEVELS',entry,stopLoss,target1,target2,target3,
  riskPerLot:loss,optionPremiumCostPerLot:premium,
  preliminaryRiskLots:riskLots,capitalAffordabilityLots:cashLots,
  brokerMarginVerified:marginVerified,brokerRequiredMarginPerLot:marginVerified?money(margin):null,
  paperEnvelopeLots:envelope,
  reasons:[...(!marginVerified?['BROKER_MCX_OPTION_MARGIN_QUOTE_UNVERIFIED']:[]),
   'MCX_OPTION_CONTRACT_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED',
   'MCX_HOLIDAYS_TENDER_DELIVERY_AND_BROKER_SQUAREOFF_UNVERIFIED',
   'ACTUAL_BROKER_AVAILABLE_FUNDS_AND_FEES_UNVERIFIED',
   'STRATEGY_NOT_BACKTESTED_OR_FORWARD_VALIDATED',
   'APPROVED_REAL_LOTS_LOCKED_ZERO']
 });
}
