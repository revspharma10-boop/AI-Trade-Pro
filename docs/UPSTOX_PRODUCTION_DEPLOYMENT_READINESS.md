# Upstox Production Deployment Readiness

## Scope

This gate creates and validates production deployment **configuration only** after sandbox qualification.

It does not authenticate to the production broker, perform a production network call, submit an order, or enable live trading.

## Required safety state

- PAPER_ONLY=true
- REAL_ORDER_PLACED=false
- PRODUCTION_REAL_TRADING_ENABLED=false
- liveExecutionEnabled=false
- canaryEnabled=false
- browser credentials forbidden
- browser live orders forbidden
- production credentials must come only from a server-side secret manager

## Qualification sequence

1. Upstox Sandbox Connectivity Validation
2. Upstox Sandbox Lifecycle Qualification
3. Upstox Broker Qualification Gate
4. Upstox Production Deployment Readiness
5. Separate production environment verification — connectivity only, no order submission
6. Explicit manual approval before any live activation

The next stage must not infer approval from this gate. Production connectivity and manual live approval remain false until separately verified and approved.
