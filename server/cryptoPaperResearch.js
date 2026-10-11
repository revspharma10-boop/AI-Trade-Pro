// Free 24/7 Kraken BTC/USD spot candle research, always PAPER ONLY.
// No broker account, private endpoints, ticker timestamp fabrication, order APIs,
// predicted accuracy claims, executable crypto positions or synthetic pricing.
export const CRYPTO_SAFETY=Object.freeze({
 paperOnly:true,orderSubmissionAllowed:false,realOrderPlaced:false,
 productionRealTradingEnabled:false,optionPlanQualified:false,approvedLots:0
});
const FIVE=300000,GRACE=12000;
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const iso=ms=>new Date(ms).toISOString();
const clearWait=(asOf,code)=>({
 tab:'crypto',symbol:'BTC/USD',marketName:'Bitcoin / US Dollar',
 state:'WAIT',stage:'CRYPTO_SPOT_RESEARCH',blockers:[{code,message:{
  CRYPTO_FEED_UNAVAILABLE:'Public Kraken market candles unavailable',
  CRYPTO_FEED_INVALID:'Kraken 5-minute candles are invalid or out of sequence',
  CRYPTO_COMPLETED_CANDLES_REQUIRED:'Four consecutive completed five-minute candles required',
  CRYPTO_DECISION_NOT_READY:'Next completed candle is not ready for analysis',
  CRYPTO_NO_CLEAR_BREAKOUT:'No completed bullish or bearish BTC/USD breakout'
 }[code]??'Unverified crypto market data'}],blockerCount:1,
 lastCheckedAt:iso(asOf),provisionalDirection:null,
 last:null,verifiedContract:null,spot:null,
 message:'BTC/USD research: '+code+' • no trade',...CRYPTO_SAFETY
});
const strictNumber=x=>(typeof x==='number'||typeof x==='string'&&x.trim()!=='')&&
 Number.isFinite(Number(x))?Number(x):NaN;
export function interpretKrakenCryptoOhlc(payload,asOf=Date.now()){
 const now=Number(new Date(asOf));
 if(!Number.isFinite(now))throw Error('INVALID_CRYPTO_CLOCK');
 const epoch=Math.floor(now/FIVE)*FIVE;
 if(now-epoch<GRACE)return {status:'WAIT',reason:'CRYPTO_DECISION_NOT_READY'};
 if(!payload||!Array.isArray(payload.error)||payload.error.length>0||
  !payload.result||typeof payload.result!=='object')
  return {status:'WAIT',reason:'CRYPTO_FEED_UNAVAILABLE'};
 // Only the exact requested XBT/USD asset; no accepting another pair's prices.
 const key=Object.keys(payload.result).filter(x=>x!=='last');
 if(key.length!==1||!['XXBTZUSD','XBTUSD'].includes(key[0]))
  return {status:'WAIT',reason:'CRYPTO_FEED_INVALID'};
 const raw=payload.result[key[0]];
 if(!Array.isArray(raw)||raw.length<5||raw.length>800)
  return {status:'WAIT',reason:'CRYPTO_COMPLETED_CANDLES_REQUIRED'};
 const candles=[];
 for(const row of raw){
  if(!Array.isArray(row)||row.length<8||
   !Number.isSafeInteger(row[0])||row[0]<1000000000){
   return {status:'WAIT',reason:'CRYPTO_FEED_INVALID'};
  }
  const time=row[0]*1000;
  const open=strictNumber(row[1]),high=strictNumber(row[2]),
   low=strictNumber(row[3]),close=strictNumber(row[4]),
   volume=strictNumber(row[6]),trades=strictNumber(row[7]);
  if(time%FIVE!==0||![open,high,low,close].every(positive)||
   !Number.isFinite(volume)||volume<0||!Number.isSafeInteger(trades)||trades<0||
   high<low||open<low||open>high||close<low||close>high)
   return {status:'WAIT',reason:'CRYPTO_FEED_INVALID'};
  candles.push({time,open,high,low,close,volume,trades});
 }
 if(candles.some((v,i)=>i>0&&v.time<=candles[i-1].time))
  return {status:'WAIT',reason:'CRYPTO_FEED_INVALID'};
 // Kraken documents that the final frame is uncommitted even when a
 // 'since' cursor is supplied. Never use its price as a completed bar.
 const running=candles.at(-1);
 if(running.time!==epoch)
  return {status:'WAIT',reason:'CRYPTO_COMPLETED_CANDLES_REQUIRED'};
 const bars=candles.slice(-5,-1);
 if(bars.length!==4||bars.some((v,i)=>v.time!==epoch-(4-i)*FIVE))
  return {status:'WAIT',reason:'CRYPTO_COMPLETED_CANDLES_REQUIRED'};
 const rangeBars=bars.slice(0,3),signal=bars[3];
 const top=Math.max(...rangeBars.map(x=>x.high));
 const bottom=Math.min(...rangeBars.map(x=>x.low));
 const width=top-bottom;
 if(!positive(width)||width<rangeBars[0].open*0.00015||
    width>rangeBars[0].open*0.035)
  return {status:'WAIT',reason:'CRYPTO_NO_CLEAR_BREAKOUT'};
 const buffer=Math.max(width*0.05,signal.close*0.0002);
 const baseVolume=rangeBars.map(x=>x.volume).sort((a,b)=>a-b)[1];
 const validActivity=signal.trades>0&&signal.volume>0&&
  baseVolume>0&&signal.volume>=baseVolume*0.35;
 const bullish=validActivity&&signal.close>top+buffer&&
  signal.close>signal.open;
 const bearish=validActivity&&signal.close<bottom-buffer&&
  signal.close<signal.open;
 return {status:bullish||bearish?'PROVISIONAL_DIRECTION':'WAIT',
  reason:bullish?'COMPLETED_BTC_UPSIDE_BREAKOUT':
   bearish?'COMPLETED_BTC_DOWNSIDE_BREAKOUT':'CRYPTO_NO_CLEAR_BREAKOUT',
  direction:bullish?'BULLISH':bearish?'BEARISH':'WAIT',
  completedClose:signal.close,
  signalCloseAt:iso(epoch),signalCandleOpenAt:iso(signal.time),
  rangeHigh:top,rangeLow:bottom,source:'KRAKEN_PUBLIC_SPOT',
  dataQuality:'COMPLETED_5M_OHLCV',quoteCurrency:'USD'};
}
export function createCryptoPaperResearchFeed({fetchOhlc,clock=()=>Date.now()}={}){
 if(typeof fetchOhlc!=='function'||typeof clock!=='function')
  throw Error('CRYPTO_FEED_DEPENDENCIES_REQUIRED');
 let cached=null,pending=null;
 async function getLatest(asOf=clock()){
  const now=Number(new Date(asOf));
  if(!Number.isFinite(now))throw Error('INVALID_CRYPTO_CLOCK');
  const slot=Math.floor(now/FIVE);
  if(cached?.slot===slot&&
    (cached.response.provisionalDirection||now-cached.checkedAt<45000))
   return cached.response;
  if(pending)return pending;
  pending=(async()=>{
   let observation;
   try{observation=interpretKrakenCryptoOhlc(await fetchOhlc(),now);}
   catch(_){observation={status:'WAIT',reason:'CRYPTO_FEED_UNAVAILABLE'};}
   const status=observation.status==='PROVISIONAL_DIRECTION';
   const result=status?{
    tab:'crypto',symbol:'BTC/USD',marketName:'Bitcoin / US Dollar',
    state:'WAIT',stage:'CRYPTO_SPOT_RESEARCH',blockers:[],blockerCount:0,
    lastCheckedAt:iso(now),last:null,verifiedContract:null,
    spot:{market:'BTC/USD',currency:'USD',
     lastCompletedClose:observation.completedClose,
     completedAt:observation.signalCloseAt,source:'KRAKEN_PUBLIC_SPOT'},
    provisionalDirection:{
     kind:'PROVISIONAL_DIRECTION',
     strategy:'CRYPTO_ROLLING_RANGE_15M',
     direction:observation.direction,
     observedAt:iso(now),lastCompletedAt:observation.signalCloseAt,
     source:'KRAKEN_PUBLIC_SPOT',recordedDurably:false,
     optionPlanQualified:false,paperOnly:true,
     orderSubmissionAllowed:false,realOrderPlaced:false
    },
    message:'Provisional completed-candle BTC/USD direction — not a trade',
    ...CRYPTO_SAFETY
   }:clearWait(now,observation.reason);
   cached={slot,checkedAt:now,response:result};
   return result;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return {getLatest,safety:CRYPTO_SAFETY};
}
// Fixed public GET URL only. The caller controls no arbitrary URL or asset.
export async function fetchKrakenBtcUsdOhlc(){
 const response=await fetch('https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=5',{
  method:'GET',headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Error('CRYPTO_FEED_UNAVAILABLE');
 return response.json();
}
