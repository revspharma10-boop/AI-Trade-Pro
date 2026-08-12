// AI TRADE PRO — PHASE 19–26 VALIDATION PATCH
// The final assertion must validate the canonical safety invariants, not caller-provided flags.
import { normalizePhase19to26Snapshot, assertPhase19to26FinalSafety } from './phase19to26FinalSnapshotFix.js';

export function validateFinalSnapshot(snapshot) {
  const finalSnapshot = normalizePhase19to26Snapshot(snapshot);
  return {
    finalSnapshot,
    passed: assertPhase19to26FinalSafety(snapshot)
  };
}

if (typeof window !== 'undefined') {
  window.validatePhase19to26FinalSnapshot = validateFinalSnapshot;
  console.log('AI TRADE PRO — Phase 19–26 validation patch loaded');
}
