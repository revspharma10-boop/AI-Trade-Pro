# Upstox OAuth Callback Deployment

AI Trade Pro currently has no public server. The production Upstox app therefore must not use the GitHub repository URL as its Redirect URL.

## Server callback

Deploy `server/upstoxOAuthCallbackServer.js` to an HTTPS-capable Node.js hosting service.

Configure these values only in the host's server-side secret/environment settings:

- `UPSTOX_CLIENT_ID` — production Upstox app API key/client ID
- `UPSTOX_CLIENT_SECRET` — production Upstox app secret
- `UPSTOX_REDIRECT_URI` — exact public callback URL
- `PORT` — normally supplied by the hosting platform

If the deployed service is available at:

`https://YOUR-OAUTH-HOST.example`

then configure the Upstox application Redirect URL as:

`https://YOUR-OAUTH-HOST.example/auth/upstox/callback`

The same exact value must be stored in `UPSTOX_REDIRECT_URI`.

Start authentication by visiting:

`https://YOUR-OAUTH-HOST.example/auth/upstox/start`

## Security properties

- OAuth state is cryptographically random and validated through an HttpOnly/Secure/SameSite cookie.
- Client secret stays server-side.
- Access token is never returned to the browser or printed in logs.
- This callback contains no broker order endpoint or execution method.
- Token persistence is intentionally not implemented until a server-side secret manager is selected.

## Safety state

- PAPER_ONLY=true
- REAL_ORDER_PLACED=false
- PRODUCTION_REAL_TRADING_ENABLED=false

OAuth authentication does not authorize live trading.
