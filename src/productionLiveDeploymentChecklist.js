/* AI TRADE PRO — PRODUCTION LIVE DEPLOYMENT CHECKLIST
 * Human/operator checklist. The application cannot self-authorize live trading.
 */

export const PRODUCTION_LIVE_DEPLOYMENT_CHECKLIST = Object.freeze([
  'Run full component/integration validation with zero failures.',
  'Complete extended live-market observation in paper mode.',
  'Qualify strategy performance using recorded paper results and out-of-sample evidence.',
  'Verify market-data freshness, ordering, duplicate detection, interruption and recovery.',
  'Verify portfolio exposure, concentration, drawdown, daily-loss and kill-switch controls.',
  'Verify paper execution slippage, spread, latency, rejection and partial-fill simulation.',
  'Verify persistence, restart, reconciliation, checkpoint, recovery and rollback.',
  'Verify audit trail, operational alerts and incident evidence.',
  'Rotate any credential that has ever been committed to source control.',
  'Store broker credentials only in a server-side secret manager.',
  'Run broker sandbox certification using the broker-specific adapter.',
  'Verify production broker account, permissions, symbols, product types and order constraints.',
  'Run a controlled production connectivity test that does not submit an order.',
  'Obtain explicit manual approval for live activation.',
  'Enable live execution only through the server-side deployment control plane.',
  'Start with a separately approved minimal-risk rollout and monitor continuously.',
  'Verify kill switch and rollback immediately after activation.'
]);

export function getProductionLiveDeploymentChecklist() {
  return Object.freeze([...PRODUCTION_LIVE_DEPLOYMENT_CHECKLIST]);
}
