// Predeclared opening-range (OR) 09:15–09:30 IST research only.
// Uses exactly the three completed 5-minute opening candles. NEVER opens orders.
// Produces directional *bias* only: no strike, option premium, SL or executable lots.
export const OPENING_RANGE_SAFETY=Object.freeze({paperOnly:true,orderSubmissionAllowed:false,
 realOrderPlaced:false,productionRealTradingEnabled:false,optionPlanQualified:false,modelBacktested:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const positive=x=>finite(x)&&x>0;
const round=x=>Number(x.toFixed(3));
const dateIST=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const minIST=ms=>{const d=new Date(ms+330*60000);return d.getUTCHours()*60+d.getUTCMinutes();};
export function deriveOpeningRangeBias({candles=[],quote=null,session=null,asOf=Date.now()}={}){
 const now=Number(new Date(asOf)),base={valid:false,direction:'WAIT',status:'OPENING_RANGE_WAIT',
 strategy:'OPENING_RANGE_15M',range:null,openingOHLC:null,lastCompletedAt:null,
 evidence:[],reasons:[],...OPENING_RANGE_SAFETY};
 const issues=[];
 if(!finite(now))issues.push('INVALID_CLOCK');
 if(!session?.open||!['NSE','BSE'].includes(session.exchange))issues.push('INDEX_SESSION_NOT_OPEN');
 if(finite(now)&&minIST(now)<570)issues.push('OPENING_RANGE_NOT_FINISHED'); // 09:30 IST
 if(!Array.isArray(candles))issues.push('OPENING_CANDLES_NOT_AVAILABLE');
 if(issues.length)return {...base,reasons:issues};
 const today=dateIST(now);
 const relevant=(Array.isArray(candles)?candles:[]).map(x=>({...x,timestamp:Date.parse(x?.datetime)}))
  .filter(c=>finite(c.timestamp)&&dateIST(c.timestamp)===today&&
    [555,560,565].includes(minIST(c.timestamp))&&
    c.timestamp+5*60000+12000<=now);
 const indexed=new Map(relevant.map(c=>[minIST(c.timestamp),c]));
 if(indexed.size!==3||relevant.length!==3)
  return {...base,reasons:['THREE_COMPLETED_0915_0920_0925_CANDLES_REQUIRED']};
 const bars=[555,560,565].map(min=>indexed.get(min));
 if(!bars.every(c=>[c.open,c.high,c.low,c.close].every(positive)&&
   c.high>=c.low&&c.open>=c.low&&c.open<=c.high&&c.close>=c.low&&c.close<=c.high))
  return {...base,reasons:['OPENING_RANGE_OHLC_UNVERIFIED']};
 const open=bars[0].open,high=Math.max(...bars.map(b=>b.high)),
  low=Math.min(...bars.map(b=>b.low)),close=bars[2].close,range=high-low;
 if(!positive(range)||range<open*0.0003||range>open*0.03)
  return {...base,reasons:['OPENING_RANGE_TOO_NARROW_OR_EXTREME']};
 const openingOHLC={open:round(open),high:round(high),low:round(low),close:round(close)};
 const snapshot={...base,valid:true,range:round(range),openingOHLC,lastCompletedAt:bars[2].datetime,
  evidence:['Opening 09:15–09:30 OHLC frozen from exactly three 5-minute candles']};
 if(!positive(quote?.lastPrice)||!finite(quote?.timestamp)||quote.timestamp>now+10000||now-quote.timestamp>120000)
  return {...snapshot,valid:false,reasons:['FRESH_INDEX_QUOTE_REQUIRED_FOR_OPENING_BIAS']};
 const position=(close-low)/range,body=(close-open)/range,mid=(high+low)/2;
 const upCloses=bars[0].close<=bars[1].close&&bars[1].close<=bars[2].close;
 const downCloses=bars[0].close>=bars[1].close&&bars[1].close>=bars[2].close;
 const bullish=body>=0.20&&position>=0.72&&upCloses&&quote.lastPrice>=mid;
 const bearish=body<=-0.20&&position<=0.28&&downCloses&&quote.lastPrice<=mid;
 const direction=bullish?'CE':bearish?'PE':'WAIT';
 const confirmedBreak=direction==='CE'?quote.lastPrice>high:
   direction==='PE'?quote.lastPrice<low:false;
 return {...snapshot,direction,status:direction==='WAIT'?'OPENING_RANGE_WAIT':'PROVISIONAL_OPENING_BIAS',
  openingRangeHigh:round(high),openingRangeLow:round(low),indexPriceAtCapture:quote.lastPrice,
  breakoutConfirmedByQuote:confirmedBreak,
  evidence:[...snapshot.evidence,
   'Opening close position '+round(position*100)+'% of range',
   'Opening candle net body '+round(body*100)+'% of range',
   'Monotonic 5m closes '+(upCloses?'UP':downCloses?'DOWN':'MIXED'),
   'Latest fresh broker index quote '+quote.lastPrice+' • quote-only breakout '+(confirmedBreak?'YES':'NO')],
  reasons:direction==='WAIT'?['OPENING_RANGE_HAS_NO_CLEAR_DIRECTION']:[
   'EARLY_UNVALIDATED_15M_BIAS_NO_OPTION_TRADE','FULL_35_CANDLE_STRATEGY_NOT_QUALIFIED']
 };
}
