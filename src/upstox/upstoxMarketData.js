export function createUpstoxMarketDataProcessor({ clock = () => Date.now(), maxAgeMs = 3000 } = {}) {
  const seen = new Set();
  let lastTimestamp = 0;

  function normalize(tick) {
    const timestamp = Number(tick?.timestamp);
    const instrumentToken = tick?.instrumentToken;
    const price = Number(tick?.price);
    if (!instrumentToken || !Number.isFinite(timestamp) || !Number.isFinite(price)) throw new Error('INVALID_TICK');
    if (timestamp < lastTimestamp) throw new Error('OUT_OF_ORDER_TICK');
    const id = tick.id ?? instrumentToken + ':' + timestamp + ':' + price;
    if (seen.has(id)) throw new Error('DUPLICATE_TICK');
    if (clock() - timestamp > maxAgeMs) throw new Error('STALE_TICK');
    seen.add(id);
    lastTimestamp = timestamp;
    return Object.freeze({id, instrumentToken, timestamp, price});
  }

  return Object.freeze({normalize});
}