export function createSandboxTransport({ requestHandler } = {}) {
  if (typeof requestHandler !== 'function') {
    return Object.freeze({
      async request() {
        throw new Error('SANDBOX_TRANSPORT_NOT_CONFIGURED');
      }
    });
  }
  return Object.freeze({request: requestHandler});
}