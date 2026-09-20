/* AI TRADE PRO — UPSTOX RECONCILIATION
 * Provider-neutral reconciliation rules for sandbox and production.
 * Fail closed on mismatches.
 */
export function reconcileOrder({ localOrder, brokerOrder } = {}) {
  if (!localOrder || !brokerOrder) throw new Error('RECONCILIATION_INPUT_REQUIRED');
  const mismatches = [];
  for (const key of ['orderId','instrumentToken','quantity','transactionType']) {
    if (localOrder[key] != null && brokerOrder[key] != null && String(localOrder[key]) !== String(brokerOrder[key])) {
      mismatches.push(key);
    }
  }
  return Object.freeze({
    reconciled: mismatches.length === 0,
    mismatches,
    action: mismatches.length === 0 ? 'CONTINUE' : 'BLOCK_AND_ALERT'
  });
}

export function reconcilePosition({ localPosition, brokerPosition } = {}) {
  if (!localPosition || !brokerPosition) throw new Error('POSITION_RECONCILIATION_INPUT_REQUIRED');
  const quantityMatch = Number(localPosition.quantity) === Number(brokerPosition.quantity);
  const instrumentMatch = String(localPosition.instrumentToken) === String(brokerPosition.instrumentToken);
  return Object.freeze({
    reconciled: quantityMatch && instrumentMatch,
    mismatches: [
      ...(instrumentMatch ? [] : ['instrumentToken']),
      ...(quantityMatch ? [] : ['quantity'])
    ],
    action: quantityMatch && instrumentMatch ? 'CONTINUE' : 'BLOCK_AND_ALERT'
  });
}
