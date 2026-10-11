// Runtime network probe: no API keys, orders, account calls or raw payload logs.
// Success proves feed accessibility at ONE observation, not uptime.
import {fetchKrakenBtcUsdOhlc,interpretKrakenCryptoOhlc}
 from './cryptoPaperResearch.js';
const now=Date.now();
try{
 const data=await fetchKrakenBtcUsdOhlc();
 const key=Object.keys(data?.result??{}).filter(k=>k!=='last');
 if(data?.error?.length!==0||key.length!==1||
  !['XXBTZUSD','XBTUSD'].includes(key[0]))
  throw Error('CRYPTO_LIVE_SOURCE_IDENTITY_INVALID');
 const rows=data.result[key[0]];
 const epoch=Math.floor(now/300000)*300000;
 if(!Array.isArray(rows)||rows.length<361||rows.at(-1)?.[0]*1000!==epoch)
  throw Error('CRYPTO_LIVE_HISTORY_NOT_CURRENT');
 const recent=rows.slice(-361,-1);
 if(recent.some((x,i)=>!Array.isArray(x)||x[0]*1000!==
  epoch-(360-i)*300000||!Number.isFinite(Number(x[4]))||Number(x[4])<=0))
  throw Error('CRYPTO_LIVE_COMPLETED_CANDLE_GAP');
 // Last row intentionally excluded, no access to a future close.
 const interpretation=interpretKrakenCryptoOhlc(data,Date.now());
 if(!['WAIT','PROVISIONAL_DIRECTION'].includes(interpretation.status))
  throw Error('CRYPTO_LIVE_INTERPRETER_INVALID');
 console.log(JSON.stringify({status:'LIVE_KRAKEN_BTC_USD_VALID',
  provider:'KRAKEN_PUBLIC_SPOT',pair:'BTC/USD',
  observedAtUtc:new Date().toISOString(),completedContinuousBars:recent.length,
  lastCompletedAtUtc:new Date(epoch-300000).toISOString(),
  uncommittedBarExcluded:true,
  strategyStatus:interpretation.status,reason:interpretation.reason,
  paperOnly:true,orderSubmissionAllowed:false,
  realOrderPlaced:false,productionRealTradingEnabled:false}));
}catch(e){
 console.error('CRYPTO_LIVE_PROBE_FAILED',String(e?.message??'NETWORK_UNAVAILABLE'));
 process.exitCode=1;
}
