# AI Trade Pro — Broker Selection Gate

## Decision required

Select the production broker before implementing a broker-specific execution adapter.

### Current candidates reviewed

| Broker | API capability | Sandbox | Important current constraint |
|---|---|---|---|
| Upstox | Trading, order lifecycle and market APIs | Yes | Sandbox availability varies by API; use sandbox before live |
| Zerodha Kite Connect | Trading, portfolio and WebSocket APIs | No | No official API sandbox |
| Angel One SmartAPI | Trading, portfolio, market-data APIs | Not treated as an equivalent sandbox in this gate | API order execution requires registered static IP from 01-Apr-2026 |

### Integration decision criteria

The selected broker must be evaluated for:

1. Required exchange/segment support.
2. Authentication and token lifecycle.
3. Market-data API/WebSocket capability.
4. Order placement, modification and cancellation.
5. Order-status and trade reconciliation.
6. Position and funds APIs.
7. Rate limits.
8. Production network/static-IP requirements.
9. API reliability and operational requirements.
10. Regulatory/exchange requirements applicable to the intended use.
11. Availability of a safe sandbox or paper-testing mechanism.
12. Cost and account/API prerequisites.

## Gate rule

No broker-specific production execution code will be enabled until the broker is explicitly selected and its current API requirements are verified.

## Next implementation sequence after selection

1. Create broker-specific adapter interface.
2. Implement sandbox adapter.
3. Add contract tests.
4. Integrate authentication.
5. Integrate market data.
6. Integrate order lifecycle.
7. Add reconciliation and failure handling.
8. Run sandbox qualification.
9. Build production deployment configuration.
10. Perform separate live-environment verification.
11. Conduct controlled canary only after explicit manual approval.

## Safety state during this gate

- PAPER_ONLY=true
- REAL_ORDER_PLACED=false
- PRODUCTION_REAL_TRADING_ENABLED=false
