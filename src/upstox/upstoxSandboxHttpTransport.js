/* AI TRADE PRO — UPSTOX HTTP TRANSPORT
 * Real HTTP transport is only enabled for SANDBOX in this phase.
 * No LIVE transport is exposed.
 */
export function createUpstoxSandboxHttpTransport({ accessToken, fetchImpl = fetch } = {}) {
  if (!accessToken) throw new Error('UPSTOX_SANDBOX_ACCESS_TOKEN_REQUIRED');

  async function request(path, {method='GET', body} = {}) {
    const response = await fetchImpl('https://api-hft.upstox.com' + path, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        ...(body ? {'Content-Type':'application/json'} : {})
      },
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.errors?.[0]?.message ?? payload?.message ?? ('HTTP_' + response.status);
      throw new Error('UPSTOX_SANDBOX_API_ERROR: ' + message);
    }
    return payload;
  }

  return Object.freeze({request});
}
