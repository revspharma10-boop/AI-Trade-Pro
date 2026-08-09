import { validatePaperOrder, createPaperOrder, transitionPaperOrder, cancelPaperOrder, fillPaperOrder, buildPaperQueue, summarizePaperQueue, assertPaperQueueSafe } from './paperOrderQueueEngine.js';

const results = [];
function test(name, fn) { try { const ok = Boolean(fn()); results.push({ name, passed: ok }); console[ok ? 'log' : 'error'](`${ok ? '✅' : '❌'} ${name}`); } catch (e) { results.push({ name, passed: false, error: String(e) }); console.error(`❌ ${name}`, e); } }
const base = { symbol: 'INFY:NSE', recommendation: 'BUY', quantity: 10, price: 1500 };

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2CO–2CX TEST RUNNER');
console.log('PAPER ORDER QUEUE / PAPER SAFETY');
console.log('============================================================');

test('Valid paper order passes validation', () => validatePaperOrder(base).valid === true);
test('Invalid symbol is rejected', () => validatePaperOrder({ ...base, symbol: '' }).valid === false);
test('Invalid side is rejected', () => validatePaperOrder({ ...base, recommendation: 'HOLD' }).valid === false);
test('Invalid quantity is rejected', () => validatePaperOrder({ ...base, quantity: 0 }).valid === false);
test('Invalid price is rejected', () => validatePaperOrder({ ...base, price: -1 }).valid === false);
test('Valid order is paper-only', () => createPaperOrder(base).paperOnly === true);
test('Valid order reports no real order', () => createPaperOrder(base).realOrderPlaced === false);
test('Valid order is queued', () => createPaperOrder(base).status === 'PAPER_QUEUED');
test('Valid order is executable-ready', () => createPaperOrder(base).executable === true);
test('Invalid order cannot be executable', () => createPaperOrder({ ...base, quantity: 0 }).executable === false);
test('Invalid order is paper-rejected', () => createPaperOrder({ ...base, quantity: 0 }).status === 'PAPER_REJECTED');
const created = createPaperOrder(base);
test('Queued order can be filled', () => fillPaperOrder(created, 1520).status === 'PAPER_FILLED');
test('Filled order remains paper-only', () => fillPaperOrder(created, 1520).realOrderPlaced === false);
test('Filled value is calculated', () => fillPaperOrder(created, 1520).filledValue === 15200);
test('Queued order can be cancelled', () => cancelPaperOrder(created).status === 'PAPER_CANCELLED');
test('Cancelled order remains non-real', () => cancelPaperOrder(created).realOrderPlaced === false);
test('Invalid state transition is blocked', () => transitionPaperOrder(fillPaperOrder(created, 1520), 'PAPER_FILLED').transitionValid === false);
const queue = buildPaperQueue([base, { ...base, symbol: 'TCS:NSE', recommendation: 'SELL', quantity: 5, price: 3500 }, { ...base, quantity: 0 }]);
const summary = summarizePaperQueue(queue);
test('Queue contains two valid paper orders', () => queue.queued.length === 2);
test('Queue contains one rejected order', () => queue.rejected.length === 1);
test('Queue summary counts all orders', () => summary.total === 3);
test('Queue summary reports two queued', () => summary.queued === 2);
test('Queue summary reports one rejected', () => summary.rejected === 1);
test('Queue remains paper-only', () => queue.paperOnly === true);
test('Queue reports no real order', () => queue.realOrderPlaced === false);
test('Queue passes paper safety assertion', () => assertPaperQueueSafe(queue) === true);

console.log('============================================================');
console.log('STEP 2CO–2CX TEST RESULT');
console.log('============================================================');
console.table({ Passed: results.filter(x => x.passed).length, Failed: results.filter(x => !x.passed).length, AllAssertionsPassed: results.every(x => x.passed), SuiteStatus: results.every(x => x.passed) ? 'PASSED' : 'FAILED' });
console.log(results.every(x => x.passed) ? '✅ STEP 2CO–2CX BULK TEST SUITE PASSED' : '❌ STEP 2CO–2CX BULK TEST SUITE FAILED');
console.log('============================================================');
export const allAssertionsPassed = results.every(x => x.passed);
export { results };
