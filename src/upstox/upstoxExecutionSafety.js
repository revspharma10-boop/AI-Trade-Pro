/* AI TRADE PRO — UPSTOX EXECUTION SAFETY
 * All failures fail closed. This module never places orders.
 */
export function evaluateExecutionSafety({
  marketDataFresh = false,
  riskApproved = false,
  killSwitchActive = true,
  authenticated = false,
  reconciled = false,
  duplicateOrder = false
} = {}) {
  const reasons = [];
  if (!marketDataFresh) reasons.push('STALE_OR_MISSING_MARKET_DATA');
  if (!riskApproved) reasons.push('RISK_NOT_APPROVED');
  if (killSwitchActive) reasons.push('KILL_SWITCH_ACTIVE');
  if (!authenticated) reasons.push('BROKER_NOT_AUTHENTICATED');
  if (!reconciled) reasons.push('STATE_NOT_RECONCILED');
  if (duplicateOrder) reasons.push('DUPLICATE_ORDER');
  return Object.freeze({
    allowed: reasons.length === 0,
    reasons,
    action: reasons.length === 0 ? 'ALLOW_TO_ADAPTER' : 'NO_ORDER'
  });
}
