/* AI TRADE PRO — FINAL FUNCTIONAL VALIDATION TEST RUNNER */
import { runFinalFunctionalValidation, assertFinalFunctionalValidationSafety } from './finalFunctionalValidationRunner.js';

export function runFinalFunctionalValidationTests() {
  console.log('============================================================');
  console.log('AI TRADE PRO — FINAL FUNCTIONAL VALIDATION');
  console.log('============================================================');

  const results = [];
  const check = (name, fn) => {
    try {
      fn();
      results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({ name, passed: false, details: error?.message || String(error) });
      console.error(`❌ ${name}`, error);
    }
  };

  check('Final functional safety gate passes', assertFinalFunctionalValidationSafety);
  check('21-domain functional campaign passes', () => {
    const report = runFinalFunctionalValidation();
    if (!report.allAssertionsPassed) throw new Error('Functional campaign reported failed assertions.');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const summary = {
    Passed: passed,
    Failed: failed,
    AllAssertionsPassed: failed === 0,
    SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED'
  };

  console.table(summary);
  console.log(`FINAL FUNCTIONAL VALIDATION: ${summary.SuiteStatus}`);
  return Object.freeze({ summary, results });
}

if (typeof window !== 'undefined') {
  window.AITradeProFinalFunctionalValidationTests = Object.freeze({ runFinalFunctionalValidationTests });
}

console.log('AI TRADE PRO — final functional validation test runner loaded');
