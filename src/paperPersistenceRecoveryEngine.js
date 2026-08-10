// AI TRADE PRO — PHASE 7: PERSISTENCE & RECOVERY
// Serializes paper state and validates restoration without broker/live side effects.

const VERSION = 1;
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
export function createPaperPersistenceRecovery() {
  let lastCheckpoint = null;
  function checkpoint(state = {}) {
    const payload = { version: VERSION, savedAt: new Date().toISOString(), state: clone(state), paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false };
    lastCheckpoint = payload; return payload;
  }
  function restore(payload) {
    if (!payload || payload.version !== VERSION || payload.paperOnly !== true || payload.realOrderPlaced === true || payload.productionRealTradingEnabled === true) return { restored: false, reason: 'INVALID_OR_UNSAFE_CHECKPOINT' };
    return { restored: true, state: clone(payload.state || {}), paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false, restoredAt: new Date().toISOString() };
  }
  function recover() { return restore(lastCheckpoint); }
  function clear() { lastCheckpoint = null; return { cleared: true, paperOnly: true, realOrderPlaced: false }; }
  function snapshot() { return { hasCheckpoint: Boolean(lastCheckpoint), savedAt: lastCheckpoint?.savedAt || null, version: VERSION, paperOnly: true, realOrderPlaced: false, productionRealTradingEnabled: false }; }
  return Object.freeze({ checkpoint, restore, recover, clear, snapshot });
}
export function assertRecoverySafe(result) { return Boolean(result && result.paperOnly === true && result.realOrderPlaced === false && result.productionRealTradingEnabled !== true); }
console.log('AI TRADE PRO — paper persistence recovery engine loaded');
