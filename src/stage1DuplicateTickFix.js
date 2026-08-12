/* AI TRADE PRO — Stage 1 duplicate-tick regression fix
 * Paper-only utility. Rejects identical timestamp/price observations.
 */
export function isDuplicateTick(previous, current) {
  if (!previous || !current) return false;
  return Number(previous.timestamp) === Number(current.timestamp) &&
    Number(previous.price) === Number(current.price);
}

export function validateStage1DuplicateTick(previous, current) {
  return { accepted: !isDuplicateTick(previous, current), reason: isDuplicateTick(previous, current) ? 'DUPLICATE_TICK' : null };
}
