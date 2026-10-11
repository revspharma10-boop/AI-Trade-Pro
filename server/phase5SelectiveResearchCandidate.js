// Higher selectivity research CANDIDATE for OFFLINE comparisons only.
// Hypothesis: require a real completed post-opening 5-minute range breakout,
// not just a strong 09:15–09:30 opening body or a quote-only excursion.
// This may reduce signal frequency. It has no established accuracy benefit.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positive=n=>finite(n)&&n>0;
export const SELECTIVE_CANDIDATE_VERSION='or15-selective-candidate-v1';
export function selectiveOpeningRangeCandidate({early,asOf=Date.now()}={}){
 const now=Number(new Date(asOf));
 const base={strategyVersion:SELECTIVE_CANDIDATE_VERSION,
  status:'ABSTAIN',direction:'ABSTAIN',confidenceProbability:null,
  sourceEvidence:'OFFLINE_ONLY',accuracyValidated:false,
  paperOnly:true,optionPlanQualified:false,orderSubmissionAllowed:false,
  realOrderPlaced:false,productionRealTradingEnabled:false,
  reason:'DIRECTION_OR_COMPLETED_BREAKOUT_UNVERIFIED'};
 const closeAt=Date.parse(early?.lastCompletedAt??'');
 const expectedBasis=early?.direction==='CE'?'COMPLETED_5M_UPSIDE_RANGE_BREAKOUT':
   early?.direction==='PE'?'COMPLETED_5M_DOWNSIDE_RANGE_BREAKOUT':null;
 if(!finite(now)||!early?.valid||early.strategy!=='OPENING_RANGE_15M'||
    early.status!=='PROVISIONAL_OPENING_BIAS'||
    !['CE','PE'].includes(early.direction)||!expectedBasis||
    early.signalBasis!==expectedBasis||
    early.breakoutConfirmedByCompletedCandle!==true||
    early.breakoutConfirmedByQuote!==true||
    early.paperOnly!==true||early.optionPlanQualified!==false||
    early.realOrderPlaced!==false||early.orderSubmissionAllowed!==false||
    !positive(early.openingRangeHigh)||!positive(early.openingRangeLow)||
    !positive(early.indexPriceAtCapture)||!finite(closeAt)||
    closeAt+312000>now||now-(closeAt+300000)>90000)
   return base;
 if((early.direction==='CE'&&early.indexPriceAtCapture<=early.openingRangeHigh)||
    (early.direction==='PE'&&early.indexPriceAtCapture>=early.openingRangeLow))
  return base;
 return {...base,status:'SELECTIVE_HYPOTHESIS',
  direction:early.direction==='CE'?'BULLISH':'BEARISH',
  reason:'COMPLETED_CANDLE_AND_QUOTE_BREAKOUT_CONFIRMED'};
}
