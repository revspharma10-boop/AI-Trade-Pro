# Upstox Production Connectivity Verification

## Purpose

Verify the production Upstox credential and production API reachability without submitting an order.

## Hard safety boundary

The validation runner allowlists only:

- GET /v2/user/profile

Any order path is blocked before a network request. The workflow also requires:

- PAPER_ONLY=true
- REAL_ORDER_PLACED=false
- PRODUCTION_REAL_TRADING_ENABLED=false

The production token must be stored as the GitHub Actions secret `UPSTOX_PRODUCTION_ACCESS_TOKEN`. Never commit the token.

## Expected result

```
UPSTOX_PRODUCTION_AUTHENTICATION_PASSED
UPSTOX_PRODUCTION_PROFILE_READ_PASSED
UPSTOX_PRODUCTION_CONNECTIVITY_PASSED
REAL_ORDER_PLACED=false
PRODUCTION_REAL_TRADING_ENABLED=false
```

This gate is evidence of authenticated read-only connectivity only. It is not approval to activate live trading and does not authorize a canary.
