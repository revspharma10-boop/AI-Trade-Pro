// AI TRADE PRO — STEP 2U
// Watchlist Engine
// Paper-only state management for symbols and scan metadata.

const MAX_WATCHLIST_SIZE = 250;

function normalizeSymbol(symbol) {
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
}

function nowIso() { return new Date().toISOString(); }

export function createWatchlist(options = {}) {
  const name = typeof options.name === 'string' && options.name.trim() ? options.name.trim() : 'Default Watchlist';
  return { valid: true, id: options.id || `WL-${Date.now()}`, name, paperOnly: true, createdAt: nowIso(), symbols: [] };
}

export function addToWatchlist(watchlist, symbol, metadata = {}) {
  if (!watchlist || watchlist.paperOnly !== true) return { valid: false, reason: 'WATCHLIST_MUST_BE_PAPER_ONLY' };
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return { valid: false, reason: 'INVALID_SYMBOL' };
  if (!Array.isArray(watchlist.symbols)) watchlist.symbols = [];
  if (watchlist.symbols.length >= MAX_WATCHLIST_SIZE && !watchlist.symbols.includes(normalized)) return { valid: false, reason: 'WATCHLIST_LIMIT_REACHED' };
  const existing = watchlist.symbols.find(item => item.symbol === normalized);
  if (existing) { Object.assign(existing, metadata, { updatedAt: nowIso() }); return { valid: true, added: false, item: existing }; }
  const item = { symbol: normalized, status: 'ACTIVE', addedAt: nowIso(), updatedAt: nowIso(), ...metadata };
  watchlist.symbols.push(item);
  return { valid: true, added: true, item };
}

export function removeFromWatchlist(watchlist, symbol) {
  if (!watchlist || !Array.isArray(watchlist.symbols)) return { valid: false, reason: 'INVALID_WATCHLIST' };
  const normalized = normalizeSymbol(symbol);
  const before = watchlist.symbols.length;
  watchlist.symbols = watchlist.symbols.filter(item => item.symbol !== normalized);
  return { valid: true, removed: before !== watchlist.symbols.length };
}

export function updateWatchlistSignal(watchlist, symbol, signal = {}) {
  if (!watchlist || watchlist.paperOnly !== true) return { valid: false, reason: 'WATCHLIST_MUST_BE_PAPER_ONLY' };
  const normalized = normalizeSymbol(symbol);
  const item = watchlist.symbols?.find(entry => entry.symbol === normalized);
  if (!item) return { valid: false, reason: 'SYMBOL_NOT_FOUND' };
  Object.assign(item, { ...signal, updatedAt: nowIso() });
  return { valid: true, item };
}

export function getWatchlistSnapshot(watchlist) {
  if (!watchlist || !Array.isArray(watchlist.symbols)) return { valid: false, reason: 'INVALID_WATCHLIST' };
  return { valid: true, id: watchlist.id, name: watchlist.name, paperOnly: true, count: watchlist.symbols.length, symbols: watchlist.symbols.map(item => ({ ...item })) };
}

console.log('AI TRADE PRO — watchlist engine loaded');
