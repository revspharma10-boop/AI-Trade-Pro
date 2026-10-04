# Upstox Sandbox Token Rotation

## Purpose

Recover the Upstox Sandbox connectivity gate without exposing the access token in source control, logs, or chat.

## Current validation contract

- Environment: SANDBOX only
- Base URL: `https://api-sandbox.upstox.com/v3`
- Authentication: `Authorization: Bearer <sandbox token>`
- Preflight: sends an intentionally invalid empty order body to verify authentication without creating an order
- Execution test: one tiny sandbox LIMIT order, followed immediately by cancellation
- Live execution: permanently blocked by the validation workflow

## Token rotation

1. Open the Upstox Developer Apps dashboard.
2. Open the existing Sandbox app.
3. Generate a fresh Sandbox access token.
4. In GitHub repository Settings -> Secrets and variables -> Actions, update `UPSTOX_SANDBOX_ACCESS_TOKEN`.
5. Never commit or paste the token into source, issues, pull requests, logs, or chat.
6. Run the `Upstox Sandbox Connectivity Validation` workflow from `main`.

## Expected authentication preflight

A valid token should produce a non-401 validation response because the preflight intentionally sends an empty order body. The runner reports:

`UPSTOX_SANDBOX_AUTH_PREFLIGHT_PASSED status=<4xx>`

A 401 / `UDAPI100050` means the secret contains an invalid, expired, or otherwise unusable token.

## Expected final result

```
UPSTOX_SANDBOX_AUTH_PREFLIGHT_PASSED
SANDBOX_PLACE_PASSED order_id_received=true
SANDBOX_CANCEL_PASSED
UPSTOX_SANDBOX_CONNECTIVITY_PASSED
PAPER_ONLY=true
REAL_ORDER_PLACED=false
PRODUCTION_REAL_TRADING_ENABLED=false
```
