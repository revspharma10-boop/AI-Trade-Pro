// AI TRADE PRO — PHASE 5 BULK DEVELOPMENT SUPPORT
import { createPaperTradingControlCenter, assertControlCenterPaperSafe } from './paperTradingControlCenterEngine.js';

export function createPaperControlCenter(deps = {}) {
  return createPaperTradingControlCenter(deps);
}

export function runPhase5DevelopmentSmoke() {
  const center = createPaperTradingControlCenter();
  const started = center.start({ initialCapital: 100000 });
  const staged = center.stageCandidate({ strategyId: 'AI_PRIMARY', symbol: 'RELIANCE', action: 'BUY', score: 90 }, {});
  const executed = center.paperExecute({ symbol: 'RELIANCE', action: 'BUY', quantity: 1 });
  const paused = center.pause();
  const resumed = center.resume();
  const stopped = center.stop();
  return { safe: assertControlCenterPaperSafe(center.snapshot()), started, staged, executed, paused, resumed, stopped, snapshot: center.snapshot() };
}

if (typeof window !== 'undefined') window.runPhase5DevelopmentSmoke = runPhase5DevelopmentSmoke;
