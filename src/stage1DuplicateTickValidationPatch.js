/* Regression validation helper for Stage 1 duplicate-tick handling. */
export function duplicateTickMustBeRejected(previous, current) {
  return Boolean(previous && current &&
    Number(previous.timestamp) === Number(current.timestamp) &&
    Number(previous.price) === Number(current.price));
}
