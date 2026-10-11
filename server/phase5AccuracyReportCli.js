// Optional, explicit local-only command. No live endpoint or background worker.
// node server/phase5AccuracyReportCli.js ./path/to/phase1-forecast-events.jsonl
// A passing report is NOT evidence of real money or verified forward performance.
import {Phase1LocalJsonlLedger} from './phase1LocalJsonlLedger.js';
import {evaluateDirectionalHistory,accuracyPromotionReview}
 from './phase5DirectionalAccuracyAudit.js';
const file=process.argv[2];
if(!file||process.argv.length!==3){
 console.error('Usage: node server/phase5AccuracyReportCli.js PATH_TO_LOCAL_JSONL');
 process.exitCode=2;
}else{
 try{
  const ledger=await new Phase1LocalJsonlLedger(file).open();
  const report=evaluateDirectionalHistory({
   forecasts:ledger.list('DIRECTIONAL_FORECAST'),
   outcomes:ledger.list('DIRECTIONAL_OUTCOME'),
   provenance:'USER_SUPPLIED_UNVERIFIED'
  });
  console.log(JSON.stringify({report,review:accuracyPromotionReview(report)},null,2));
 }catch(e){
  // No raw record contents/credentials should appear in public CI logs.
  console.error('Accuracy audit refused:',String(e?.message??'UNKNOWN'));
  process.exitCode=1;
 }
}
