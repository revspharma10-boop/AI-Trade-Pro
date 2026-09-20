export function buildUpstoxAuthorizationUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) throw new Error('clientId, redirectUri and state are required.');
  const url = new URL('https://api.upstox.com/v2/login/authorization/dialog');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeUpstoxAuthorizationCode({ code, clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  if (!code || !clientId || !clientSecret || !redirectUri) throw new Error('OAuth exchange parameters are incomplete.');
  const response = await fetchImpl('https://api.upstox.com/v2/login/authorization/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code'
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.errors?.[0]?.message ?? 'Upstox OAuth token exchange failed.');
  return body;
}