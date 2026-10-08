// Paper-only price levels and position-size envelope.
// This is a research calculation, not an executable recommendation.
// DO NOT infer account available margin from a user's declared capital.
import {classifyIntradayInstrument} from './intradayInstrumentContract.js';

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>finite(n)&&n>0;
const rup=n=>Number(n.toFixed(2));
const align=(n,tick,mode)=>rup((mode==='up'?Math.ceil(n/tick-1e-9):
  mode==='down'?Math.floor(n/tick+1e-9):Math.round(n/tick))*tick);
const isoDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);

// Upstox BOD JSON 'tick_size' is in hundredths of the displayed price unit:
// a raw 5 corresponds to ₹0.05, raw 100 to ₹1.00.
// Keep this assumption explicit and mark price precision as provisional.
export function instrumentPriceTick(instrument={}){
 const raw=Number(instrument.tickSize??instrument.tick_size);
 return positive(raw)?rup(raw/100):null;
}

export function calculateIntradayPaperTradePlan({
 signal=null,instrument={},quote=null,research=null,marginQuote=null,
 capital=50000,riskPercent=1,asOf=Date.now(),
 brokerAvailableMargin=null,brokerAvailableMarginVerified=false
}={}){
 const meta=classifyIntradayInstrument(instrument);
 const now=Number(new Date(asOf));
 const cash=Number(capital),risk=Number(riskPercent);
 const riskBudget=positive(cash)&&risk===1?rup(cash*0.01):null;
 const reasons=[];
 const direction=signal?.direction;
 const isFuture=meta.kind==='COMMODITY_FUTURE'||meta.kind==='FUTURE';
 const isEquity=meta.kind==='EQUITY';
 if(!['BUY','SELL'].includes(direction)||signal?.status!=='PROVISIONAL_UNVALIDATED')
  reasons.push('PROVISIONAL_BUY_OR_SELL_SIGNAL_REQUIRED');
 if(!isEquity&&!isFuture)reasons.push('POSITION_CALCULATOR_SUPPORTS_EQUITY_AND_FUTURES_ONLY');
 if(!meta.valid)reasons.push(...meta.reasons);
 if(!riskBudget||riskBudget>500)reasons.push('FIFTY_THOUSAND_ONE_PERCENT_CAP_REQUIRED');
 if(!positive(now)||!quote?.valid||!positive(quote.lastPrice)||!positive(quote.bid)||!positive(quote.ask)||quote.ask<quote.bid||
    !finite(quote.timestamp)||!finite(quote.lastTradeTime)||
    now-quote.timestamp>120000||now-quote.lastTradeTime>120000||
    quote.timestamp>now+10000||quote.lastTradeTime>now+10000)
  reasons.push('FRESH_VERIFIED_QUOTE_REQUIRED');
 if(!research?.valid||!positive(research.snapshot?.atr14))reasons.push('VALID_ATR_REQUIRED');
 if(isFuture&&(!meta.expiry||meta.expiry<=isoDate(now)))reasons.push('FUTURE_EXPIRED_OR_EXPIRY_DAY');
 const tick=instrumentPriceTick(instrument); // Require the exact instrument tick for every segment.
 if(!positive(tick))reasons.push('UPSTOX_EXCHANGE_TICK_REQUIRED');
 const lotSize=isEquity?1:meta.lotSize;
 const unitMultiplier=isEquity?1:meta.segment==='MCX_FO'?meta.qtyMultiplier:1;
 if(!positive(lotSize)||!positive(unitMultiplier))reasons.push('LOT_SIZE_OR_QUANTITY_MULTIPLIER_UNVERIFIED');
 const expectedEntry=positive(tick)&&positive(quote?.bid)&&positive(quote?.ask)&&['BUY','SELL'].includes(direction)?
   align(direction==='BUY'?quote.ask:quote.bid,tick,direction==='BUY'?'up':'down'):null;
 const brokerRequiredMargin=Number(marginQuote?.requiredMargin);
 const marginVerified=marginQuote?.verified===true&&positive(brokerRequiredMargin)&&
   marginQuote.instrumentKey===instrument.instrumentKey&&
   marginQuote.direction===direction&&
   marginQuote.quantity===lotSize&&
   marginQuote.product==='I'&&
   finite(marginQuote.price)&&positive(expectedEntry)&&
   Math.abs(marginQuote.price-expectedEntry)<0.000001&&
   finite(marginQuote.asOf)&&marginQuote.asOf<=now+10000&&now-marginQuote.asOf<180000;
 const fundsVerified=brokerAvailableMarginVerified===true&&finite(brokerAvailableMargin)&&brokerAvailableMargin>=0;
 const base={
  status:'WAIT',direction:direction==='BUY'||direction==='SELL'?direction:'WAIT',
  entry:null,stopLoss:null,target1:null,target2:null,
  riskBudget,riskPercent:1,capital:cash,
  exchangeTick:tick,lotSize:positive(lotSize)?lotSize:null,
  qtyMultiplier:positive(unitMultiplier)?unitMultiplier:null,
  grossLossPerLot:null,estimatedLossPerLotWithSlippage:null,
  preliminaryRiskBasedLots:null,brokerMarginPerLot:marginVerified?rup(brokerRequiredMargin):null,
  marginEstimateVerified:marginVerified,brokerAvailableMarginVerified:fundsVerified,
  contractMultiplierSource:isFuture?'UPSTOX_INSTRUMENT_METADATA':'NSE_EQUITY_SHARE',
  contractMultiplierIndependentlyVerified:false,
  brokerAvailableMargin:fundsVerified?rup(brokerAvailableMargin):null,
  theoreticalBudgetMarginLots:marginVerified?Math.floor(cash/brokerRequiredMargin):null,
  riskAndMarginEnvelopeLots:null,approvedLots:0,
  orderSubmissionAllowed:false,paperOnly:true,realOrderPlaced:false,
  netRiskIncludesBrokerage:false,performanceValidated:false,
  reasons:[],notes:[
   'Entry, SL and targets are HYPOTHETICAL research levels, not executable orders.',
   'Brokerage, taxes, exchange charges, fill slippage and gaps may increase loss.',
   '₹50,000 is the declared capital ceiling, NOT verified Upstox available funds.',
   'Price tick is normalized from the exact Upstox instrument raw tick_size ÷ 100 and is provisional.',
   'Contract multiplier from Upstox instrument metadata is not independently exchange-certified.'
  ]
 };
 // Keep broker-margin and cash fields visible even during WAIT.
 if(reasons.length){base.reasons=[...new Set(reasons)];return base;}
 const atr=research.snapshot.atr14;
 const buy=direction==='BUY';
 // Adverse entry rounding: BUY at ask or higher, SELL at bid or lower.
 const entry=expectedEntry;
 const stopDistance=Math.max(1.5*atr,3*tick);
 const stopLoss=align(buy?entry-stopDistance:entry+stopDistance,tick,buy?'down':'up');
 const r=Math.abs(entry-stopLoss);
 // Targets rounded toward entry; realized prices are not guaranteed.
 const target1=align(buy?entry+1.5*r:entry-1.5*r,tick,buy?'down':'up');
 const target2=align(buy?entry+2*r:entry-2*r,tick,buy?'down':'up');
 if(!positive(entry)||!positive(stopLoss)||!positive(target1)||!positive(target2)||!positive(r)){
  base.reasons=['PRICE_LEVEL_CALCULATION_INVALID'];return base;
 }
 const perLotUnits=lotSize*unitMultiplier;
 const grossLossPerLot=r*perLotUnits;
 const illustrativeSlippageReserve=2*tick*perLotUnits; // 1 tick per side
 const estimatedLossPerLotWithSlippage=grossLossPerLot+illustrativeSlippageReserve;
 if(!positive(estimatedLossPerLotWithSlippage)||!Number.isSafeInteger(perLotUnits)){
  base.reasons=['INVALID_CONTRACT_EXPOSURE'];return base;
 }
 const riskLots=Math.floor(riskBudget/estimatedLossPerLotWithSlippage);
 const marginBudgetLots=marginVerified?Math.floor(cash/brokerRequiredMargin):null;
 const riskAndMarginEnvelopeLots=marginVerified?Math.min(riskLots,marginBudgetLots):null;
 const verifiedFundsLots=marginVerified&&fundsVerified?
   Math.min(riskAndMarginEnvelopeLots,Math.floor(brokerAvailableMargin/brokerRequiredMargin)):0;
 base.status='PAPER_LEVELS_ONLY';
 Object.assign(base,{
  entry,stopLoss,target1,target2,
  grossLossPerLot:rup(grossLossPerLot),estimatedLossPerLotWithSlippage:rup(estimatedLossPerLotWithSlippage),
  preliminaryRiskBasedLots:riskLots,
  riskAndMarginEnvelopeLots,
  // No lot is ever authorized until broker funds, brokerage, holiday/tender,
  // square-off and strategy validation have independently passed.
  approvedLots:0,
  brokerFundsMathematicalLots:verifiedFundsLots,
  entryBasis:buy?'CURRENT_ASK_PLUS_TICK_ROUNDING':'CURRENT_BID_MINUS_TICK_ROUNDING',
  atrStopMultiple:1.5,
  rewardRisk:[1.5,2],
  reasons:[
   ...(riskLots===0?['ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET']:[]),
   ...(!marginVerified?['BROKER_REQUIRED_MARGIN_NOT_VERIFIED']:[]),
   ...(isFuture?['CONTRACT_MULTIPLIER_INDEPENDENT_VERIFICATION_PENDING']:[]),
   ...(!fundsVerified?['ACTUAL_UPSTOX_AVAILABLE_FUNDS_NOT_VERIFIED']:[]),
   'BROKERAGE_AND_ALL_SLIPPAGE_NOT_VERIFIED',
   'HOLIDAY_DELIVERY_SQUAREOFF_AND_STRATEGY_NOT_QUALIFIED',
   'REAL_TRADE_LOTS_LOCKED_AT_ZERO'
  ]
 });
 return base;
}
