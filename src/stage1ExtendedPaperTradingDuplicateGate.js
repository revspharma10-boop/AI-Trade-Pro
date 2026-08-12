/* AI TRADE PRO — Stage 1 duplicate gate
 * Paper-only. Used by Stage 1 market observation adapters to reject
 * repeated timestamp/price observations before signal/execution processing.
 */
export function createDuplicateTickGate() {
  let last = null;
  return Object.freeze({
    check(tick) {
      const current = { timestamp: Number(tick?.timestamp), price: Number(tick?.price) };
      const duplicate = !!last && last.timestamp === current.timestamp && last.price === current.price;
      if (!duplicate) last = current;
      return { accepted: !duplicate, duplicate, reason: duplicate ? 'DUPLICATE_TICK' : null };
    },
    reset() { last = null; }
  });
}
