/* AI TRADE PRO — FINAL COMPONENT VALIDATION TEST RUNNER */
import { runFinalComponentValidation } from './finalComponentValidationRunner.js';

export async function runFinalComponentValidationTests() {
  console.log('============================================================');
  console.log('AI TRADE PRO — FINAL 21-COMPONENT VALIDATION');
  console.log('============================================================');
  const report = await runFinalComponentValidation();
  console.log(`FINAL 21-COMPONENT VALIDATION: ${report.SuiteStatus}`);
  if (!report.AllAssertionsPassed) {
    console.error('Failed components:', report.Results.filter(r => !r.passed));
  }
  return report;
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalComponentValidationTests = Object.freeze({ runFinalComponentValidationTests });
}
