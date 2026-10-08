// Intraday instrument contract — classification only; no execution capability.
export const INTRADAY_SAFETY=Object.freeze({PAPER_ONLY:true,REAL_ORDER_PLACED:false,PRODUCTION_REAL_TRADING_ENABLED:false});
export function classifyIntradayInstrument(input={}){
  const segment=String(input.segment||'').toUpperCase();
  const type=String(input.instrumentType||input.instrument_type||'').toUpperCase();
  const symbol=String(input.tradingSymbol||input.trading_symbol||'').trim();
  const expiry=String(input.expiry||'');
  const lotSize=Number(input.lotSize??input.lot_size);
  const strike=Number(input.strike??input.strike_price);
  const underlyingSymbol=String(input.underlyingSymbol??input.underlying_symbol??'').trim().toUpperCase();
  const tickSize=Number(input.tickSize??input.tick_size);
  const qtyMultiplier=Number(input.qtyMultiplier??input.qty_multiplier);
  const reasons=[];
  let kind='UNSUPPORTED';
  if(segment==='NSE_EQ'&&(!type||type==='EQ'))kind='EQUITY';
  else if(segment==='NSE_FO'&&['FUT','FUTSTK','FUTIDX'].includes(type))kind='FUTURE';
  else if(segment==='NSE_FO'&&['CE','OPTSTK_CE','OPTIDX_CE'].includes(type))kind='CALL_OPTION';
  else if(segment==='NSE_FO'&&['PE','OPTSTK_PE','OPTIDX_PE'].includes(type))kind='PUT_OPTION';
  else if(segment==='MCX_FO'&&type==='FUT')kind='COMMODITY_FUTURE';
  else if(segment==='MCX_FO'&&type==='CE')kind='COMMODITY_CALL_OPTION';
  else if(segment==='MCX_FO'&&type==='PE')kind='COMMODITY_PUT_OPTION';
  if(!symbol)reasons.push('SYMBOL_REQUIRED');
  if(kind==='UNSUPPORTED')reasons.push('UNSUPPORTED_INSTRUMENT');
  if(kind!=='EQUITY'&&kind!=='UNSUPPORTED'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry))reasons.push('VALID_EXPIRY_REQUIRED');
    if(!Number.isInteger(lotSize)||lotSize<1)reasons.push('VALID_LOT_SIZE_REQUIRED');
    if(kind.includes('OPTION')&&!(strike>0))reasons.push('VALID_STRIKE_REQUIRED');
    if(segment==='MCX_FO'){
      if(!underlyingSymbol)reasons.push('MCX_UNDERLYING_REQUIRED');
      if(!(tickSize>0))reasons.push('MCX_TICK_SIZE_REQUIRED');
      if(!(qtyMultiplier>0))reasons.push('MCX_QTY_MULTIPLIER_REQUIRED');
    }
  }
  return {valid:reasons.length===0,kind,exchange:segment==='MCX_FO'?'MCX':segment.startsWith('NSE_')?'NSE':'UNKNOWN',
    segment,symbol,underlyingSymbol:underlyingSymbol||null,expiry:expiry||null,
    lotSize:Number.isInteger(lotSize)&&lotSize>0?lotSize:null,
    strike:kind.includes('OPTION')&&strike>0?strike:null,
    tickSize:tickSize>0?tickSize:null,qtyMultiplier:qtyMultiplier>0?qtyMultiplier:null,
    reasons,paperOnly:true,orderSubmissionAllowed:false};
}
export function intradayEligibility(input={}){
  const instrument=classifyIntradayInstrument(input.instrument);
  const reasons=[...instrument.reasons];
  if(!input.completedCandleFresh)reasons.push('INTRADAY_CANDLE_NOT_FRESH');
  if(!input.sessionOpen)reasons.push('MARKET_SESSION_NOT_OPEN');
  if(!input.liquidityVerified)reasons.push('INTRADAY_LIQUIDITY_NOT_VERIFIED');
  if(!input.instrumentRiskVerified)reasons.push('INSTRUMENT_RISK_NOT_VERIFIED');
  if(!input.paperAccountingVerified)reasons.push('PAPER_ACCOUNTING_NOT_VERIFIED');
  return {recommendation:'WAIT',qualified:false,reasons:[...new Set(reasons)],instrument,paperOnly:true,orderSubmissionAllowed:false};
}
