import {
  createPaperPosition,
  calculatePaperPnL,
  closePaperPosition,
  markPaperPosition,
  buildPaperLifecycleSnapshot,
  assertPaperLifecycleSafe
} from './paperPositionLifecycleEngine.js';

const results = [];
function test(name, condition) {
  const passed = Boolean(condition);
  results.push({ name, passed });
  console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}`);
}

console.log('============================================================');
console.log('AI TRADE PRO — STEP 2CY–2DH TEST RUNNER');
console.log('PAPER POSITION LIFECYCLE / P&L / PAPER SAFETY');
console.log('============================================================');

const long = createPaperPosition({ symbol: 'INFY:NSE', side: 'LONG', quantity: 10, fillPrice: 100 });
const short = createPaperPosition({ symbol: 'TCS:NSE', side: 'SHORT', quantity: 5, fillPrice: 200 });
const invalid = createPaperPosition({ symbol: '', side: 'LONG', quantity: 0, fillPrice: -1 });
const longMarked = markPaperPosition(long, 112);
const longClosed = closePaperPosition(long, 112);
const shortClosed = closePaperPosition(short, 180);
const snapshot = buildPaperLifecycleSnapshot([longMarked, longClosed, shortClosed], 100000);

// 1–24 lifecycle and safety contract

test('Valid LONG position is created', long.valid && long.status === 'OPEN');
test('Valid SHORT position is created', short.valid && short.status === 'OPEN');
test('Position symbol is normalized', long.symbol === 'INFY:NSE');
test('Position quantity is preserved', long.quantity === 10);
test('Entry price is preserved', long.entryPrice === 100);
test('LONG position is paper-only', long.paperOnly === true);
test('LONG position reports no real order', long.realOrderPlaced === false);
test('Invalid position is rejected', invalid.valid === false && invalid.status === 'REJECTED');
test('Invalid position remains paper-only', invalid.paperOnly === true);
test('LONG P&L calculation is correct', calculatePaperPnL(long, 112) === 120);
test('SHORT P&L calculation is correct', calculatePaperPnL(short, 180) === 100);
test('Mark-to-market calculates unrealized P&L', longMarked.unrealizedPnL === 120);
test('Marked position remains open', longMarked.status === 'OPEN');
test('Marked position remains paper-only', longMarked.paperOnly === true);
test('LONG position closes successfully', longClosed.status === 'CLOSED' && longClosed.valid === true);
test('Closed LONG records positive P&L', longClosed.realizedPnL === 120);
test('SHORT position closes successfully', shortClosed.status === 'CLOSED');
test('Closed SHORT records positive P&L', shortClosed.realizedPnL === 100);
test('Closed position remains paper-only', longClosed.realOrderPlaced === false && longClosed.paperOnly === true);
test('Lifecycle snapshot is valid', snapshot.valid === true);
test('Snapshot reports realized P&L', snapshot.realizedPnL === 220);
test('Snapshot reports open and closed positions', snapshot.openPositions === 1 && snapshot.closedPositions === 2);
test('Snapshot remains paper-only', snapshot.paperOnly === true && snapshot.realOrderPlaced === false);
test('Paper lifecycle safety assertion passes', assertPaperLifecycleSafe(snapshot) === true);

console.log('============================================================');
console.log('STEP 2CY–2DH PAPER LIFECYCLE SUMMARY');
console.table({
  Cash: snapshot.cash,
  OpenPositions: snapshot.openPositions,
  ClosedPositions: snapshot.closedPositions,
  RealizedPnL: snapshot.realizedPnL,
  UnrealizedPnL: snapshot.unrealizedPnL,
  Equity: snapshot.equity,
  PaperOnly: snapshot.paperOnly,
  RealOrderPlaced: snapshot.realOrderPlaced
});

const passed = results.filter(x => x.passed).length;
const failed = results.length - passed;
const summary = { Passed: passed, Failed: failed, AllAssertionsPassed: failed === 0, SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED' };
console.log('============================================================');
console.log('STEP 2CY–2DH TEST RESULT');
console.table(summary);
console.log(failed === 0 ? '✅ STEP 2CY–2DH BULK TEST SUITE PASSED' : '❌ STEP 2CY–2DH BULK TEST SUITE FAILED');
console.log('============================================================');
export { results, summary };
