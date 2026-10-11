// All data below are SYNTHETIC. This validates durability and no-lookahead,
// NOT prediction profitability or actual live-market accuracy.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCryptoFileJournal,cryptoShadowCycle,cryptoHistorySummary,
 validateCryptoJournalEvent,CRYPTO_JOURNAL_BRANCH} from './cryptoShadowLedger.js';
import {interpretKrakenCryptoOhlc} from './cryptoPaperResearch.js';

const F=300000,epoch=Date.parse('2026-10-11T09:30:00.000Z'),at=ms=>new Date(ms).toISOString();
function series(target=epoch){
 const rows=Array.from({length:360},(_,i)=>{
  const p=j=>10000+j*0.9+7*Math.sin(j*.4)+3*Math.sin(j*1.3)+(j===359?16:0);
  const close=p(i),open=i===0?close-1:p(i-1);
  const high=Math.max(open,close)+2,low=Math.min(open,close)-2;
  return [Math.floor((target-(360-i)*F)/1000),
   String(open),String(high),String(low),String(close),String(close),
   String(i===359?200:100),120];
 });
 return [...rows,[Math.floor(target/1000),'10500','999999','1',
  '950000','10100','999','999']];
}
const payload=rows=>({error:[],result:{XXBTZUSD:rows,last:0}});
const forecastInput=payload(series());
assert.equal(interpretKrakenCryptoOhlc(forecastInput,epoch+20000).direction,'BULLISH');
const tmp=await mkdtemp(join(tmpdir(),'btc-git-replay-'));
try{
 const ledger=await createCryptoFileJournal(tmp).open();
 let clock=epoch+20000,calls=0;
 const fetchOhlc=async()=>{calls++;return forecastInput;};
 const a=await cryptoShadowCycle({ledger,fetchOhlc,clock:()=>clock});
 assert.equal(a.forecastState,'BULLISH');
 assert.equal(a.outcomesEvaluated,0);
 let rows=ledger.list();
 assert.equal(rows.length,1);
 const forecast=rows[0];
 assert.equal(forecast.kind,'FORECAST');
 assert.equal(forecast.strategyVersion,'btc-mtf-confluence-v1');
 assert.equal(forecast.source,'KRAKEN_PUBLIC_SPOT');
 assert.equal(forecast.paperOnly,true);
 assert.equal(forecast.orderSubmissionAllowed,false);
 assert.equal(forecast.realOrderPlaced,false);
 assert.equal(forecast.productionRealTradingEnabled,false);
 assert.equal(forecast.referenceClose,Number(forecast.referenceClose.toFixed(2)));
 assert.equal(forecast.horizonUtc,at(epoch+F));
 assert.equal(forecast.slotUtc,at(epoch));
 assert.ok(/^[a-f0-9]{64}$/.test(forecast.featureHash));
 assert.equal(validateCryptoJournalEvent(forecast),true);
 assert.equal(CRYPTO_JOURNAL_BRANCH,'crypto-shadow-history');
 const b=await cryptoShadowCycle({ledger,fetchOhlc,clock:()=>clock});
 assert.equal(b.forecastState,'DUPLICATE');
 assert.equal(ledger.list().length,1);
 const restart=await createCryptoFileJournal(tmp).open();
 assert.deepEqual(restart.list(),ledger.list(),'Checksum journal must survive process restart');
 // Evaluate predetermined NEXT candle, not the uncommitted 09:35 candle.
 const later=series(epoch+F);
 const fixed=[Math.floor(epoch/1000),String(forecast.referenceClose),
  String(forecast.referenceClose*1.01),String(forecast.referenceClose*0.999),
  String(forecast.referenceClose*1.005),
  String(forecast.referenceClose*1.005),'150',130];
 later[later.length-2]=fixed; // exact settled 09:30 candle; 09:35 remains uncommitted.
 const qualified=payload(later);
 assert.equal(qualified.result.XXBTZUSD.at(-2)[0]*1000,epoch);
 clock=epoch+F+120000; // Delayed scheduler: outcome scored, new forecast slot skipped.
 const c=await cryptoShadowCycle({ledger:restart,fetchOhlc:async()=>qualified,
  clock:()=>clock});
 assert.equal(c.correct,1);
 assert.equal(c.incorrect,0);
 rows=restart.list();
 const out=rows.find(x=>x.kind==='OUTCOME');
 assert.equal(out.forecastId,forecast.id);
 assert.equal(out.outcome,'CORRECT');
 assert.equal(out.settlementCandleOpenUtc,forecast.slotUtc);
 assert.equal(out.horizonUtc,forecast.horizonUtc);
 assert.equal(out.observedClose,Number(fixed[4]));
 assert.equal(validateCryptoJournalEvent(out),true);
 const after=await createCryptoFileJournal(tmp).open();
 assert.deepEqual(after.list(),restart.list());
 const d=await cryptoShadowCycle({ledger:after,fetchOhlc:async()=>qualified,
  clock:()=>clock});
 assert.equal(d.outcomesEvaluated,0,'Settled outcomes must not duplicate after restart');
 assert.equal(after.list().filter(x=>x.kind==='OUTCOME').length,1);
 const stats=cryptoHistorySummary(after.list());
 assert.equal(stats.counts.correct,1);
 assert.equal(stats.counts.qualified,1);
 assert.equal(stats.evaluatedSampleSize,1);
 assert.equal(stats.evaluatedFiveMinuteDirectionAccuracyPct,100);
 assert.equal(stats.livePerformanceVerified,false,
  'Synthetic fixtures must never become measured live performance');
 assert.equal(stats.netTradingPnLMeasured,false);
 assert.equal(stats.realOrdersAllowed,false);
 assert.throws(()=>validateCryptoJournalEvent({...out,outcome:'INCORRECT'}),
  /CRYPTO_OUTCOME_LABEL_INVALID/);
 assert.throws(()=>validateCryptoJournalEvent({...forecast,
  capturedAtUtc:at(epoch+F+1000)}),/CRYPTO_FORECAST_INVALID/);
 assert.throws(()=>validateCryptoJournalEvent({...out,
  observedClose:999999}),/CRYPTO_OUTCOME_LABEL_INVALID/);
 assert.throws(()=>validateCryptoJournalEvent({...out,
  horizonUtc:at(epoch+2*F)}),/CRYPTO_OUTCOME_INVALID/);

 // Late clock: no after-the-fact forecast. Record explicit SKIP only.
 const late=await createCryptoFileJournal(join(tmp,'late')).open();
 const lateTick=await cryptoShadowCycle({ledger:late,fetchOhlc,clock:()=>epoch+120000});
 assert.equal(lateTick.forecastState,'SKIPPED');
 assert.equal(late.list().length,1);
 assert.equal(late.list()[0].kind,'SKIP');
 assert.equal(late.list()[0].reasonCode,'CRYPTO_DECISION_WINDOW_MISSED');
 // Missing authenticated Kraken feed => SKIP, never fabricate.
 const unavailable=await createCryptoFileJournal(join(tmp,'no-provider')).open();
 const fail=await cryptoShadowCycle({ledger:unavailable,
  fetchOhlc:async()=>{throw Error('SECRET_NEVER_LOG_THIS')},
  clock:()=>epoch+20000});
 assert.equal(fail.forecastState,'SKIPPED');
 assert.equal(fail.outcomesEvaluated,0);
 assert.equal(unavailable.list()[0].reasonCode,'CRYPTO_PROVIDER_DATA_UNAVAILABLE');
 // WAIT from insufficient but syntactically valid provider data => remains
 // unqualified; only an actual eight-gate pass can be directional.
 const noSetup=await createCryptoFileJournal(join(tmp,'abstain')).open();
 const flat=payload(series().map((row,i)=>i===359?
  [row[0],'11000','11001','10999','11000','11000','200',120]:row));
 const flatTick=await cryptoShadowCycle({ledger:noSetup,
  fetchOhlc:async()=>flat,clock:()=>epoch+20000});
 assert.equal(flatTick.forecastState,'ABSTAIN');
 assert.equal(noSetup.list()[0].kind,'FORECAST');
 assert.equal(noSetup.list()[0].direction,'ABSTAIN');

 // No outcome before the predetermined candle closes, regardless of quote.
 const prem=await createCryptoFileJournal(join(tmp,'premature')).open();
 await cryptoShadowCycle({ledger:prem,fetchOhlc,clock:()=>epoch+20000});
 const pending=await cryptoShadowCycle({ledger:prem,
  fetchOhlc:async()=>payload(series(epoch+F)),clock:()=>epoch+F+5000});
 assert.equal(pending.outcomesEvaluated,0);
 assert.equal(prem.list().filter(x=>x.kind==='OUTCOME').length,0);
 // Provider is gone beyond Kraken's 720-bar retention; mark unevaluable,
 // never invent a success or loss, and never retroactively score later.
 const far=epoch+F+61*60*60*1000;
 const unevaluable=await cryptoShadowCycle({ledger:prem,fetchOhlc:async()=>null,
  clock:()=>far});
 assert.equal(unevaluable.unevaluable,1);
 assert.equal(prem.list().find(x=>x.kind==='OUTCOME').outcome,'UNEVALUABLE');
 assert.equal(cryptoHistorySummary(prem.list()).evaluatedSampleSize,0);

 // A damaged checksum must stop the entire journal (not ignore bad records).
 const daily=join(tmp,'data','crypto','btc-usd',at(epoch).slice(0,10)+'.jsonl');
 const raw=await readFile(daily,'utf8');
 await writeFile(daily,raw.replace('"checksum":"','"checksum":"0'),'utf8');
 await assert.rejects(()=>createCryptoFileJournal(tmp).open(),
 /CRYPTO_LEDGER_CHECKSUM_INVALID/);
 console.log('BTC SHADOW DURABILITY QUALIFICATION PASSED: immutable forecast, later fixed 5m outcome, per-slot idempotency, checksums, restart replay, missed scheduler, provider outage and no real orders.');
}finally{await rm(tmp,{recursive:true,force:true});}
