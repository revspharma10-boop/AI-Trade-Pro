import { createWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistSignal, getWatchlistSnapshot } from './watchlistEngine.js';

const results = [];
function assert(name, condition) { const passed = Boolean(condition); results.push({ name, passed }); console[passed ? 'log' : 'error'](`${passed ? '✅' : '❌'} ${name}`); }

console.log('='.repeat(60)); console.log('AI TRADE PRO — STEP 2U TEST RUNNER'); console.log('WATCHLIST ENGINE'); console.log('='.repeat(60));
const wl = createWatchlist({ name: 'NSE Core' });
assert('Watchlist is valid', wl.valid === true); assert('Watchlist is paper-only', wl.paperOnly === true);
const add = addToWatchlist(wl, 'infy:nse', { priority: 'HIGH' });
assert('Symbol is added', add.added === true); assert('Symbol is normalized', add.item.symbol === 'INFY:NSE');
assert('Duplicate does not increase count', addToWatchlist(wl, 'INFY:NSE').added === false && wl.symbols.length === 1);
assert('Signal update works', updateWatchlistSignal(wl, 'INFY:NSE', { opportunityScore: 72 }).item.opportunityScore === 72);
assert('Snapshot remains paper-only', getWatchlistSnapshot(wl).paperOnly === true);
assert('Remove works', removeFromWatchlist(wl, 'INFY:NSE').removed === true && wl.symbols.length === 0);
assert('Invalid symbol rejected', addToWatchlist(wl, '').valid === false);
const passed = results.filter(r => r.passed).length; const failed = results.length - passed;
console.table({ Passed: passed, Failed: failed, AllAssertionsPassed: failed === 0, SuiteStatus: failed === 0 ? 'PASSED' : 'FAILED' });
export const allAssertionsPassed = failed === 0;
