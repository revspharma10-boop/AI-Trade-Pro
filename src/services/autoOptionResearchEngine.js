// Automatic NSE long-option research, never an instruction or an executable order.
const ok=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>ok(n)&&n>0;
const inr=n=>Number(n.toFixed(2));
const todayIST=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const tickOf=x=>positive(Number(x?.tickSize))?Number((Number(x.tickSize)/100).toFixed(4)):null;
const aligned=(value,tick,mode)=>inr((mode==='up'?Math.ceil(value/tick-1e-9):Math.floor(value/tick+1e-9))*tick);
export const AUTO_OPTION_SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,productionRealTradingEnabled:false});
export function deriveAutoOptionDirection({research=null,underlyingQuote=null,underlyingSegment='',session=null,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),s=research?.snapshot,issues=[];
 if(!session?.open)issues.push('INDEX_SESSION_NOT_OPEN');
 if(!research?.valid||!s||research.completedBars<35)issues.push('FRESH_UNDERLYING_5M_CANDLES_REQUIRED');
 if(!underlyingQuote||!positive(underlyingQuote.lastPrice)||!ok(underlyingQuote.timestamp)||
    underlyingQuote.timestamp>now+10000||now-underlyingQuote.timestamp>120000)
   issues.push('FRESH_UNDERLYING_PRICE_REQUIRED');
 const index=['NSE_INDEX','BSE_INDEX'].includes(underlyingSegment);
 if(!index&&(!underlyingQuote?.valid||!s?.liquidityResearchPass||!positive(s?.vwap)))issues.push('UNDERLYING_LIQUIDITY_OR_VWAP_UNVERIFIED');
 if(!s||![s.close,s.ema9,s.ema21,s.atr14].every(positive)||!ok(s.rsi14)||!ok(s.macdHistogram))
   issues.push('TECHNICAL_EVIDENCE_INCOMPLETE');
 if(s&&positive(underlyingQuote?.lastPrice)&&positive(s.atr14)&&
    Math.abs(s.close-underlyingQuote.lastPrice)>Math.max(3*s.atr14,0.015*s.close))
   issues.push('UNDERLYING_CANDLE_QUOTE_MISMATCH');
 const bullish=!!s&&s.ema9>s.ema21&&s.rsi14>=55&&s.rsi14<=75&&s.macdHistogram>0&&
   (index||s.close>s.vwap);
 const bearish=!!s&&s.ema9<s.ema21&&s.rsi14>=25&&s.rsi14<=45&&s.macdHistogram<0&&
   (index||s.close<s.vwap);
 if(!bullish&&!bearish)issues.push('NO_CLEAR_TECHNICAL_DIRECTION');
 return {direction:issues.length?'WAIT':bullish?'CE':'PE',reasons:[...new Set(issues)],
  strategyValidated:false,optionPurchaseOnly:true,...AUTO_OPTION_SAFETY};
}
export function chooseAutoOptionContract({contracts=[],underlyingKey='',spot=null,direction='WAIT',asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),date=todayIST(now);
 if(!['CE','PE'].includes(direction)||!positive(spot)||!underlyingKey)
  return {contract:null,reasons:['DIRECTION_OR_SPOT_UNVERIFIED']};
 const expected=underlyingKey.startsWith('BSE_INDEX|')?'BSE_FO':'NSE_FO';
 const candidates=(Array.isArray(contracts)?contracts:[]).filter(c=>
   c&&c.segment===expected&&c.underlyingKey===underlyingKey&&
   c.instrumentType===direction&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(c.expiry||'')&&
   c.expiry>date&&positive(c.strike)&&Number.isSafeInteger(c.lotSize)&&c.lotSize>0&&
   positive(tickOf(c))&&(String(c.instrumentKey||'').startsWith(expected+'|')&&/^\w+$/.test(String(c.instrumentKey||'').split('|')[1]||''))&&
   typeof c.tradingSymbol==='string'&&c.tradingSymbol.length>0);
 if(!candidates.length)return {contract:null,reasons:['NO_VERIFIED_FUTURE_EXPIRY_OPTION_CONTRACT']};
 const expiry=candidates.map(c=>c.expiry).sort()[0];
 const earliest=candidates.filter(c=>c.expiry===expiry);
 earliest.sort((a,b)=>Math.abs(a.strike-spot)-Math.abs(b.strike-spot)||
  (direction==='CE'?Number(a.strike>spot)-Number(b.strike>spot):Number(a.strike<spot)-Number(b.strike<spot))||
  a.strike-b.strike||a.instrumentKey.localeCompare(b.instrumentKey));
 return {contract:earliest[0],reasons:[],selection:'NEAREST_EXPIRY_NOT_TODAY_ATM'};
}
export function calculateAutoOptionPaperPlan({direction='WAIT',contract=null,underlyingKey='',optionQuote=null,optionResearch=null,
 marginQuote=null,capital=50000,riskBudget=500,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),reasons=[];
 const base={status:'WAIT',direction,optionType:direction,contract:contract?.tradingSymbol??null,
  strike:contract?.strike??null,expiry:contract?.expiry??null,lotSize:contract?.lotSize??null,
  contractMultiplier:1,priceTick:null,entry:null,stopLoss:null,target1:null,target2:null,
  riskPerLot:null,capital,riskBudget,preliminaryRiskLots:null,capitalAffordabilityLots:null,
  brokerRequiredMarginPerLot:null,brokerMarginVerified:false,paperEnvelopeLots:null,approvedLots:0,
  availableBrokerFundsVerified:false,feesAndGapsIncluded:false,modelBacktested:false,
  reasons:[],...AUTO_OPTION_SAFETY};
 if(!contract||contract.underlyingKey!==underlyingKey||contract.segment!==(underlyingKey.startsWith('BSE_INDEX|')?'BSE_FO':'NSE_FO')||contract.instrumentType!==direction||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(contract?.expiry??'')||contract.expiry<=todayIST(now)||
    !positive(contract.strike)||!Number.isSafeInteger(contract.lotSize)||contract.lotSize<1||
    !/^(NSE_FO|BSE_FO)\|[A-Za-z0-9_]+$/.test(contract.instrumentKey??''))
   reasons.push('EXACT_UNEXPIRED_OPTION_CONTRACT_REQUIRED');
 if(!['CE','PE'].includes(direction))reasons.push('PROVISIONAL_CALL_OR_PUT_DIRECTION_REQUIRED');
 if(capital!==50000||riskBudget!==500)reasons.push('CAPITAL_50000_RISK_500_REQUIRED');
 const tick=tickOf(contract);
 if(!positive(tick))reasons.push('CONTRACT_TICK_NOT_VERIFIED');
 if(!optionQuote?.valid||!positive(optionQuote.ask)||!positive(optionQuote.bid)||optionQuote.ask<optionQuote.bid||
    !positive(optionQuote.lastPrice)||!ok(optionQuote.timestamp)||!ok(optionQuote.lastTradeTime)||
    optionQuote.timestamp>now+10000||optionQuote.lastTradeTime>now+10000||
    now-optionQuote.timestamp>120000||now-optionQuote.lastTradeTime>120000)
   reasons.push('FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED');
 if(!ok(optionQuote?.spreadPercent)||optionQuote.spreadPercent<0||optionQuote.spreadPercent>1.5)
   reasons.push('OPTION_SPREAD_TOO_WIDE_OR_UNKNOWN');
 if(!positive(optionQuote?.openInterest)||!positive(optionQuote?.tradedVolume))
   reasons.push('OPTION_OPEN_INTEREST_OR_VOLUME_UNVERIFIED');
 if(!optionResearch?.valid||!positive(optionResearch.snapshot?.atr14)||optionResearch.completedBars<35||
    !optionResearch.snapshot?.liquidityResearchPass)
   reasons.push('FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED');
 base.priceTick=tick;
 if(reasons.length){base.reasons=[...new Set(reasons)];return base;}
 const entry=aligned(optionQuote.ask,tick,'up');
 const rDistance=Math.max(1.5*optionResearch.snapshot.atr14,3*tick);
 const stop=aligned(entry-rDistance,tick,'down');
 const target1=aligned(entry+1.5*(entry-stop),tick,'down');
 const target2=aligned(entry+2*(entry-stop),tick,'down');
 if(!positive(stop)||stop>=entry||target1<=entry||target2<=target1){
  base.reasons=['OPTION_PREMIUM_LEVELS_INVALID'];return base;
 }
 const grossLoss=(entry-stop)*contract.lotSize;
 const slippageReserve=2*tick*contract.lotSize;
 const riskPerLot=inr(grossLoss+slippageReserve);
 const costPerLot=inr(entry*contract.lotSize);
 if(!positive(riskPerLot)||!positive(costPerLot)||!Number.isSafeInteger(contract.lotSize)){
  base.reasons=['LOT_EXPOSURE_INVALID'];return base;
 }
 const marginRequired=Number(marginQuote?.requiredMargin);
 const brokerMarginVerified=marginQuote?.verified===true&&
   marginQuote.instrumentKey===contract.instrumentKey&&marginQuote.direction==='BUY'&&
   marginQuote.product==='I'&&marginQuote.quantity===contract.lotSize&&
   ok(marginQuote.price)&&Math.abs(marginQuote.price-entry)<1e-6&&positive(marginRequired)&&
   ok(marginQuote.asOf)&&marginQuote.asOf<=now+10000&&now-marginQuote.asOf<180000;
 const riskLots=Math.floor(riskBudget/riskPerLot),cashLots=Math.floor(capital/costPerLot);
 const budgetLots=Math.min(riskLots,cashLots);
 const marginLots=brokerMarginVerified?Math.floor(capital/Math.max(costPerLot,marginRequired)):null;
 const envelope=brokerMarginVerified?Math.min(budgetLots,marginLots):null;
 Object.assign(base,{status:'UNVALIDATED_PAPER_LEVELS',entry,stopLoss:stop,target1,target2,
  riskPerLot,optionPremiumCostPerLot:costPerLot,preliminaryRiskLots:riskLots,
  capitalAffordabilityLots:cashLots,brokerRequiredMarginPerLot:brokerMarginVerified?inr(marginRequired):null,
  brokerMarginVerified,paperEnvelopeLots:envelope,
  reasons:[...(riskLots===0?['ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET']:[]),
   ...(cashLots===0?['ONE_LOT_PREMIUM_EXCEEDS_50000_CAPITAL']:[]),
   ...(!brokerMarginVerified?['BROKER_MARGIN_QUOTE_REQUIRED']:[]),
   'BROKER_AVAILABLE_FUNDS_AND_FEES_NOT_VERIFIED',
   'STRATEGY_NOT_BACKTESTED_OR_FORWARD_VALIDATED',
   'REAL_ORDER_LOTS_LOCKED_ZERO']});
 return base;
}
