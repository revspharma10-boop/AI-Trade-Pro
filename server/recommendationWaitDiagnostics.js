// Presentation-only rejection diagnostics for the personal Android paper-research feed.
// Derived exclusively from broker-backed evidence and existing deterministic engine
// reason codes. No prices, trades, or authorization can be created here.
const LABELS=Object.freeze({
 MARKET_SESSION_CLOSED:'Exchange session is closed or not verified',
 UPSTOX_REAUTHENTICATION_REQUIRED:'Upstox login has expired; reconnect before paper research can continue',
 UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED:'Read-only Upstox analytics token is invalid or expired',
 UPSTOX_ANALYTICS_PERMISSION_DENIED:'Upstox has not permitted the required read-only market-data endpoint',
 UPSTOX_RATE_LIMITED:'Upstox rate limit reached; wait before retrying market-data requests',
 UPSTOX_INDEX_SEARCH_UNAVAILABLE:'Upstox could not verify the underlying index instrument',
 EXACT_INDEX_INSTRUMENT_NOT_RETURNED:'Upstox index search did not return the exact index instrument',
 UPSTOX_INSTRUMENT_SEARCH_FAILED:'Upstox could not verify the requested stock instrument',
 UPSTOX_EQUITY_NOT_FOUND:'Exact requested stock instrument was not found at Upstox',
 UPSTOX_INTRADAY_REQUEST_FAILED:'Upstox 5-minute candle request failed',
 UPSTOX_INTRADAY_DATA_EMPTY:'Upstox returned no usable completed five-minute candles',
 UPSTOX_LIVE_QUOTE_FAILED:'Upstox live quote request failed',
 UPSTOX_LIVE_QUOTE_EMPTY:'Upstox returned no verified live quote',
 UPSTOX_OPTION_CONTRACT_LOOKUP_FAILED:'Upstox option-chain request failed',
 UPSTOX_DERIVATIVE_SEARCH_FAILED:'Upstox derivative contract search failed',
 UPSTOX_RESEARCH_DATA_UNAVAILABLE:'Upstox market research request could not be completed',

 UNDERLYING_NOT_VERIFIED:'Exact underlying instrument was not verified by Upstox',
 UNDERLYING_CANDLES_REQUIRED:'Completed underlying 5-minute candles are missing or stale',
 FRESH_UNDERLYING_5M_CANDLES_REQUIRED:'At least 35 completed, fresh underlying 5-minute candles are required',
 FRESH_UNDERLYING_PRICE_REQUIRED:'Current underlying market quote is missing or stale',
 UNDERLYING_LIQUIDITY_OR_VWAP_UNVERIFIED:'Underlying volume or VWAP evidence is not verified',
 TECHNICAL_EVIDENCE_INCOMPLETE:'EMA, RSI, MACD or ATR inputs are incomplete',
 NO_CLEAR_TECHNICAL_DIRECTION:'EMA, RSI, MACD and trend do not agree on a CALL or PUT',
 UNDERLYING_CANDLE_QUOTE_MISMATCH:'Live underlying price differs too far from completed candle close',
 OPENING_RANGE_NOT_CONFIRMED:'09:15–09:30 completed-candle opening range does not confirm a direction',
 OPENING_RANGE_BIAS_ONLY:'Opening-range CALL/PUT bias is provisional; no option trade is qualified',
 NO_VERIFIED_FUTURE_EXPIRY_OPTION_CONTRACT:'No exchange-listed option contract with a future expiry was verified',
 DIRECTION_OR_SPOT_UNVERIFIED:'CALL/PUT direction or underlying price is not verified',
 OPTION_CONTRACT_NOT_VERIFIED:'Exact exchange-listed option contract was not verified',
 EXACT_UNEXPIRED_OPTION_CONTRACT_REQUIRED:'Selected contract metadata or expiry is not verified',
 PROVISIONAL_CALL_OR_PUT_DIRECTION_REQUIRED:'CALL/PUT direction was not qualified',
 CONTRACT_TICK_NOT_VERIFIED:'Option contract tick size is not verified',
 CAPITAL_50000_RISK_500_REQUIRED:'₹50,000 capital and ₹500 per-trade risk controls are not verified',
 FRESH_OPTION_BID_ASK_LAST_TRADE_REQUIRED:'Fresh option bid/ask and last traded price/time are not verified',
 OPTION_SPREAD_TOO_WIDE_OR_UNKNOWN:'Option bid/ask spread is unavailable or exceeds 1.5%',
 OPTION_OPEN_INTEREST_OR_VOLUME_UNVERIFIED:'Option open interest or traded volume is not verified',
 FRESH_LIQUID_OPTION_PREMIUM_CANDLES_REQUIRED:'Option premium 5-minute candles or liquidity are not qualified (35 fresh bars required)',
 OPTION_PREMIUM_LEVELS_INVALID:'Option entry, stop and targets fail price or tick-size checks',
 LOT_EXPOSURE_INVALID:'Option lot exposure or premium cost is not verified',
 ONE_LOT_EXCEEDS_500_RUPEE_RISK_BUDGET:'One option lot exceeds the ₹500 planned loss limit',
 ONE_LOT_PREMIUM_EXCEEDS_50000_CAPITAL:'One option lot exceeds the ₹50,000 premium budget',
 BROKER_MARGIN_QUOTE_REQUIRED:'Upstox option margin estimate is unavailable or unverified',
 BROKER_MARGIN_ESTIMATE_UNAVAILABLE:'Upstox option margin estimate could not be retrieved',
 PAPER_ENVELOPE_NOT_QUALIFIED:'Margin, affordability or risk checks did not permit one theoretical paper lot',
 MCX_FUTURE_AND_OPTION_UNDERLYING_LINK_NOT_VERIFIED:'MCX futures-to-option contract linkage is not verified',
 MCX_FUTURES_PRICE_NOT_VERIFIED:'MCX futures quote or technical direction is not verified',
 EXACT_MCX_OPTION_CONTRACT_NOT_FOUND:'Exact MCX option contract was not verified',
 MCX_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED:'MCX multiplier, delivery and other safety checks are not independently verified',
 FRESH_MCX_OPTION_PREMIUM_AND_VOLUME_REQUIRED:'MCX option premium candles or liquidity are not verified',
 FRESH_MCX_OPTION_BID_ASK_TRADE_REQUIRED:'Fresh MCX option quote and last trade are not verified',
 MCX_OPTION_SPREAD_UNVERIFIED_OR_WIDE:'MCX option spread is unavailable or too wide',
 MCX_OPTION_OPEN_INTEREST_OR_VOLUME_NOT_VERIFIED:'MCX option volume or open interest is unavailable',
 ONE_MCX_OPTION_LOT_EXCEEDS_500_RISK_BUDGET:'One MCX option lot exceeds the ₹500 planned loss limit',
 ONE_MCX_OPTION_LOT_EXCEEDS_50000_PREMIUM_BUDGET:'One MCX option lot exceeds the ₹50,000 premium budget',
 BROKER_MCX_OPTION_MARGIN_QUOTE_UNVERIFIED:'MCX option margin estimate is unavailable',
 MCX_OPTION_CONTRACT_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED:'MCX option contract multiplier needs independent verification',
 MCX_HOLIDAYS_TENDER_DELIVERY_AND_BROKER_SQUAREOFF_UNVERIFIED:'MCX tender, delivery, holiday or broker square-off checks are not verified',
 RECOMMENDATION_BACKEND_UNAVAILABLE:'Broker market-data analysis is currently unavailable',
 RECOMMENDATION_REJECTED:'Option contract, premium and risk qualification is incomplete'
});
const WARN_ONLY=new Set([
 'BROKER_AVAILABLE_FUNDS_AND_FEES_NOT_VERIFIED',
 'STRATEGY_NOT_BACKTESTED_OR_FORWARD_VALIDATED',
 'REAL_ORDER_LOTS_LOCKED_ZERO',
 'ACTUAL_BROKER_AVAILABLE_FUNDS_AND_FEES_UNVERIFIED',
 'APPROVED_REAL_LOTS_LOCKED_ZERO',
 'MCX_OPTION_CONTRACT_MULTIPLIER_NOT_INDEPENDENTLY_VERIFIED'
]);
const unique=arr=>[...new Set(arr)];
export function brokerVerifiedContractSummary(contract,asOf=Date.now()){
 const date=new Date(asOf+330*60000).toISOString().slice(0,10);
 const segment=contract?.segment;
 if(!['NSE_FO','BSE_FO','MCX_FO'].includes(segment)||
    !['CE','PE'].includes(contract?.instrumentType)||
    !/^[A-Z0-9_]+$/.test(String(contract?.instrumentKey??'').split('|')[1]??'')||
    !String(contract?.instrumentKey??'').startsWith(segment+'|')||
    !Number.isFinite(contract?.strike)||contract.strike<=0||
    !Number.isSafeInteger(contract?.lotSize)||contract.lotSize<=0||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(contract?.expiry??''))||
    contract.expiry<=date||
    typeof contract?.tradingSymbol!=='string'||!contract.tradingSymbol.trim())
  return null;
 return Object.freeze({
  tradingSymbol:contract.tradingSymbol,
  optionType:contract.instrumentType,
  strike:contract.strike,expiry:contract.expiry,
  paperOnly:true,orderSubmissionAllowed:false
 });
}
export function describePaperRejection({stage='UNKNOWN',codes=[],
 contract=null,asOf=Date.now(),fallback='RECOMMENDATION_REJECTED'}={}){
 const all=unique((Array.isArray(codes)?codes:[]).filter(x=>typeof x==='string'));
 const blocked=all.filter(x=>!WARN_ONLY.has(x)).map(code=>({
  code:Object.hasOwn(LABELS,code)?code:'RECOMMENDATION_REJECTED',
  message:Object.hasOwn(LABELS,code)?LABELS[code]:LABELS.RECOMMENDATION_REJECTED
 }));
 const uniqueBlocked=unique(blocked.map(x=>x.code))
  .map(code=>({code,message:LABELS[code]}));
 if(!uniqueBlocked.length){
  const code=Object.hasOwn(LABELS,fallback)?fallback:'RECOMMENDATION_REJECTED';
  uniqueBlocked.push({code,message:LABELS[code]});
 }
 return {
  state:'WAIT',stage,
  // Preserve the specific known failing checks for API consumers. Android renders
  // only the first few in a compact panel; counts disclose omitted checks.
  blockers:uniqueBlocked.slice(0,8),
  blockerCount:uniqueBlocked.length,
  message:uniqueBlocked.slice(0,2).map(x=>x.message).join(' · '),
  verifiedContract:brokerVerifiedContractSummary(contract,asOf)
 };
}
