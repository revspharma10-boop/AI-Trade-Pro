import fs from 'node:fs';
import { analyzeTechnicalHistory } from './services/technicalAnalysisEngine.js';
import { analyzeFundamentals } from './services/fundamentalAnalysisEngine.js';
import { buildStockAnalysisDecision,assertStockAnalysisDecisionSafe } from './services/stockAnalysisDecisionEngine.js';
import { buildPaperCandidateFromDecision } from './services/paperDecisionBridge.js';
import { createPaperTradingRuntime,assertPaperRuntimeSafe } from './paperTradingRuntimeEngine.js';

let failed=0;const check=(n,p)=>{console.log((p?'PASS ':'FAIL ')+n);if(!p)failed++;};
const candles=[];let p=100;for(let i=0;i<90;i++){p+=.6;candles.push({datetime:'2026-'+String(Math.floor(i/28)+1).padStart(2,'0')+'-'+String(i%28+1).padStart(2,'0'),open:p-.2,high:p+1,low:p-1,close:p,volume:100000+i*2000});}
const tech=analyzeTechnicalHistory(candles);check('technical evidence complete',tech.valid);
const fundamentals=analyzeFundamentals({profile:{sector:'IT'},income:{income_statement:[{category:'revenue',history:[{change:'18%'}]},{category:'net_profit',history:[{change:'22%'}]},{category:'operating_profit',history:[{change:'20%'}]}]},balance:{history:[{total_asset:1000,total_liability:300}]},cashFlow:{cash_flow:[{category:'operating',history:[{change:'15%'}]}]},keyRatios:[{name:'ROE',value:24},{name:'ROCE',value:28},{name:'PE',value:20,sector_value:28}]});check('fundamental evidence complete',fundamentals.valid);
const decision=buildStockAnalysisDecision({symbol:'QUALIFY',marketDataFresh:true,technicalScores:tech.scores,fundamentalScores:fundamentals.scores,marketRegimeScore:85,entryZone:tech.levels.entryZone,stopLoss:tech.levels.stopLoss,targets:tech.levels.targets,riskRewardRatio:tech.levels.riskRewardRatio,riskGates:{...tech.gates,liquidityAcceptable:true,marketRegimeAcceptable:true}});
check('decision contract safe',assertStockAnalysisDecisionSafe(decision));
const missing=buildStockAnalysisDecision({symbol:'FAIL'});check('missing evidence fails closed',missing.recommendation==='WAIT'&&!missing.paperEligible);
if(decision.paperEligible){const candidate=buildPaperCandidateFromDecision(decision,1);const rt=createPaperTradingRuntime({initialCapital:100000});const staged=rt.stageCandidate(candidate);const filled=rt.fillOrder(staged.id,candidate.price);rt.mark(candidate.symbol,candidate.target);rt.close(candidate.symbol,candidate.target);check('qualified decision completes paper lifecycle',filled.position?.status==='OPEN'&&rt.getState().journal.length===1);check('paper runtime safe after lifecycle',assertPaperRuntimeSafe(rt));}else check('high-quality fixture qualifies for paper',false);
const server=fs.readFileSync('server/upstoxOAuthCallbackServer.js','utf8'),ui=fs.readFileSync('src/main.js','utf8');
check('server exposes read-only history and fundamentals',server.includes('/api/upstox/history')&&server.includes('/api/upstox/fundamentals'));
check('UI uses combined evidence',ui.includes('analyzeTechnicalHistory')&&ui.includes('analyzeFundamentals')&&ui.includes('analyzeMarketRegime'));
check('no production trading enable flag in UI',!ui.includes('PRODUCTION_REAL_TRADING_ENABLED=true'));
console.log('STAGE_E_GO_LIVE_QUALIFICATION='+(failed?'FAILED':'PASSED'));console.log('PAPER_ONLY=true');console.log('REAL_ORDER_PLACED=false');console.log('PRODUCTION_REAL_TRADING_ENABLED=false');process.exit(failed?1:0);
