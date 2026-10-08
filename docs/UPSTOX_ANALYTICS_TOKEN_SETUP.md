# Upstox read-only Analytics Token — 1-year authentication

## Why the app was prompting for login

The original OAuth token was stored only in Render process memory. It disappears on restart or every deployment, and Upstox expires standard OAuth credentials at 03:30 IST on the next day (not after 20 arbitrary hours). A regular OAuth login remains supported but cannot be kept alive beyond the broker-imposed expiry.

**For market research, prefer the official one-year, read-only Analytics Token.** Upstox documents Analytics Token access to Market Quote, Historical Data, Option Chain, Market Information, Fundamentals, and other GET-only APIs without a static IP. Trading/order submission is not supported with this credential.

Documentation:
- https://upstox.com/developer/api-documentation/analytics-token/
- https://upstox.com/developer/api-documentation/get-token/

## One-time setup on Render

1. Sign in at https://account.upstox.com/developer/apps and open the **Analytics** tab. Generate the **Analytics Token**, noting Upstox's one-year expiration date. Upstox allows one Analytics Token per account at a time; generating another revokes the previous.
2. Open https://dashboard.render.com/web/srv-db1sbtrncjis73c5je0g and select **Environment** for the `ai-trade-pro-oauth` web service.
3. Add a server-side secret named `UPSTOX_ANALYTICS_TOKEN`. Paste the token **only in Render**, never in your browser's JavaScript, GitHub, screenshots, logs, or any chat. Save and deploy the updated environment.
4. Open https://ai-trade-pro-oauth.onrender.com/api/upstox/status. You should see `authMode: "ANALYTICS_TOKEN"`, `authenticated: true`, `credentialStatus: "CONFIGURED_UNVERIFIED"` at first. This means a token is configured, not that Upstox has accepted it.
5. Make a real read-only market-data request with a valid instrument. If Upstox accepts it, status becomes `credentialStatus: "VERIFIED"` and `tokenVerified: true`. No browser response ever contains the token.
6. If Upstox rejects the credential, the app fails closed and returns `UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED`. Rotate/replace the token in Render. A 403 for an unsupported endpoint is returned as `UPSTOX_ANALYTICS_PERMISSION_DENIED` without revoking access to other supported GET endpoints.

## Safety and limitations

- The server keeps the Analytics Token only in a server-side environment variable. Unlike process-memory OAuth, it survives application restarts. Only HTTPS server requests forward it to Upstox.
- The credential is valid for **up to one year as issued by Upstox**, not indefinitely; provider revocation or expiry always takes precedence.
- The app does **not** auto-renew, generate, or retain client credentials to bypass Upstox authentication; the user rotates the token in Upstox and Render at expiry.
- The backend remains `READ_ONLY` and `PAPER_ONLY`; no production real orders or new order routes are enabled.
- The browser-visible `authenticated: true` means a configured usable credential **until Upstox verification**. Use `tokenVerified` and `credentialStatus` to distinguish configuration from provider verification.
- Existing public API routes are reachable from outside the dashboard; consider rate limiting and access control to prevent abuse of the market-data subscription. Never expose token details to clients.
- The MCX contract lookup uses Upstox's official daily instrument master; fetched contracts must still satisfy exact contract, quote freshness, expiry, and risk safety checks.
