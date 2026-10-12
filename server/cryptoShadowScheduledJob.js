// GitHub-hosted *scheduled* runner. Must only execute with checkout of
// default branch and a separate git worktree for crypto-shadow-history.
// This command stages JSONL only. GitHub workflow must COMMIT+PUSH before
// anything is considered remotely durable.
import {createCryptoFileJournal,cryptoShadowCycle,cryptoHistorySummary}
 from './cryptoShadowLedger.js';
import {fetchKrakenBtcUsdOhlc} from './cryptoPaperResearch.js';
const root=process.argv[2];
if(!root||process.argv.length!==3){
 console.error('CRYPTO_JOURNAL_WORKTREE_REQUIRED');process.exitCode=2;
}else{
 try{
  const ledger=await createCryptoFileJournal(root).open();
  const result=await cryptoShadowCycle({ledger,fetchOhlc:fetchKrakenBtcUsdOhlc});
  const events=ledger.list();
  const audit=cryptoHistorySummary(events);
  const decision=events.find(e=>e.slotUtc===result.slotUtc&&
   (e.kind==='FORECAST'||e.kind==='SKIP'));
  // Controlled reason code only: never print raw provider payloads/errors.
  console.log(JSON.stringify({result:{...result,
   decisionReasonCode:decision?.reasonCode??null},audit}));
  // Does NOT claim live data validation or prediction accuracy if provider
  // missing: rejected feed produces SKIP, never forged completed candles.
 }catch(e){
  console.error('CRYPTO_SHADOW_JOB_FAILED',String(e?.message??'UNKNOWN'));
  process.exitCode=1;
 }
}
