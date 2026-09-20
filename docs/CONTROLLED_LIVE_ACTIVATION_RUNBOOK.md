# AI Trade Pro — Controlled Live Activation Runbook

## Current state

The automated qualification and readiness gates are complete. The application remains paper-only.

- `PAPER_ONLY=true`
- `REAL_ORDER_PLACED=false`
- `PRODUCTION_REAL_TRADING_ENABLED=false`
- Broker adapter in this repository is qualification-only and makes no network calls.

## Manual activation prerequisites

Do not enable live execution until every item below has independent evidence.

1. Production broker account and permissions are verified.
2. A real production broker adapter is implemented and reviewed for the target broker.
3. Production credentials are stored only in the approved server-side secret manager.
4. `BROKER_ENVIRONMENT=LIVE` is supplied only to the production runtime.
5. Risk limits and position/order limits are configured and independently reviewed.
6. Kill switch is tested and confirmed operational.
7. Market-data freshness, duplicate-tick and stale-data protections are enabled.
8. Order rejection, timeout, disconnect and recovery paths are tested against the broker sandbox.
9. Audit logging and operational monitoring are active.
10. Rollback procedure is tested.
11. A controlled canary procedure is approved.
12. Explicit human approval for live activation is recorded.

## Activation sequence

1. Keep the application in paper mode while provisioning and validating the production environment.
2. Deploy the reviewed production broker adapter to the server-side execution service.
3. Inject production secrets through the secret manager; never commit them to Git.
4. Verify broker identity, account permissions, market-data source and risk configuration.
5. Verify the kill switch before enabling execution.
6. Record the explicit manual approval.
7. Enable live execution only through the approved server-side deployment control.
8. Start with the approved controlled canary scope.
9. Monitor orders, fills, P&L, risk events, errors and audit logs continuously.
10. Immediately disable execution and invoke rollback if any safety or operational invariant fails.

## Non-goals

This runbook does not place an order, activate a broker account, or enable live trading automatically. CI qualification must never be treated as authorization to trade.

## Rollback

If any prerequisite becomes invalid, return execution to disabled/paper mode, activate the kill switch, preserve audit evidence, and investigate before reactivation.
