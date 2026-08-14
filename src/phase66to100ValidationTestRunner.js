import { runPhase66to100Validation } from './phase66to100ValidationRunner.js';

export async function runPhase66to100ValidationTest() {
  const result=runPhase66to100Validation();
  console.log('PHASES 66–100 MASTER TEST RESULT:',result);
  return result;
}

console.log('AI TRADE PRO — Phase 66–100 master test runner loaded');
