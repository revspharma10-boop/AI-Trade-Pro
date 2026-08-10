// Development smoke runner for extended paper observation.
import { createExtendedPaperObservation, assertExtendedPaperSafety } from './extendedPaperObservationEngine.js';

export function runExtendedPaperObservationSmoke() {
  const o = createExtendedPaperObservation({ initialCapital: 100000 });
  o.start();
  o.recordMarketTick({ symbol: 'RELIANCE', price: 2500 });
  o.recordSignal({ symbol: 'RELIANCE', action: 'BUY', score: 91, accepted: true, riskPassed: true });
  o.recordPaperExecution({ symbol: 'RELIANCE', action: 'BUY', quantity: 1, price: 2500 });
  o.recordExit({ symbol: 'RELIANCE', pnl: 100 });
  o.updateEquity(100100);
  const snapshot = o.snapshot();
  const result = { safe: assertExtendedPaperSafety(snapshot), snapshot };
  console.log('EXTENDED PAPER OBSERVATION DEVELOPMENT SMOKE:', result.safe ? 'SAFE' : 'FAILED');
  return result;
}

if (typeof window !== 'undefined') window.runExtendedPaperObservationSmoke = runExtendedPaperObservationSmoke;
