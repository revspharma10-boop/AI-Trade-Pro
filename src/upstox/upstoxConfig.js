export const UPSTOX_API_VERSION = 'v3';
export const UPSTOX_ENVIRONMENTS = Object.freeze({
  SANDBOX: 'SANDBOX',
  LIVE: 'LIVE'
});

export function createUpstoxConfig(input = {}) {
  const environment = input.environment ?? 'SANDBOX';
  if (!Object.values(UPSTOX_ENVIRONMENTS).includes(environment)) {
    throw new Error('Unsupported Upstox environment.');
  }
  return Object.freeze({
    environment,
    baseUrl: input.baseUrl ?? 'https://api.upstox.com',
    orderBaseUrl: input.orderBaseUrl ?? 'https://api-hft.upstox.com',
    redirectUri: input.redirectUri ?? '',
    clientId: input.clientId ?? '',
    clientSecretPresent: Boolean(input.clientSecret),
    accessTokenPresent: Boolean(input.accessToken),
    liveExecutionEnabled: input.liveExecutionEnabled === true
  });
}