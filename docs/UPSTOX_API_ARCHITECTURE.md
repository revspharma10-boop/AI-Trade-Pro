# AI Trade Pro — Upstox API Architecture

## Scope

This architecture defines the Upstox integration boundary for AI Trade Pro. It is designed for sandbox-first development and keeps production execution disabled until the separately approved live activation gate.

## Upstox integration flow

Browser UI
  |
  | HTTPS
  v
AI Trade Pro Server/API
  |
  +--> Authentication Service
  |      |
  |      +--> Upstox OAuth 2.0
  |
  +--> Market Data Service
  |      |
  |      +--> Upstox Market Stream Feed V3 (WebSocket)
  |      +--> Tick validation / freshness / duplicate protection
  |
  +--> Trading/Risk Service
  |      |
  |      +--> Strategy signal
  |      +--> Risk controls
  |      +--> Kill switch
  |      +--> Order validation
  |
  +--> Upstox Broker Adapter
  |      |
  |      +--> Place order
  |      +--> Modify order
  |      +--> Cancel order
  |      +--> Order status/history
  |      +--> Trade/position reconciliation
  |
  +--> Audit / Monitoring
         |
         +--> immutable operational events

## Environment isolation

SANDBOX:
- Upstox sandbox token only.
- Sandbox API base/configuration.
- No production credentials.
- No real order execution.

LIVE:
- Separate production server-side deployment.
- Production credentials only through a secret manager.
- Explicit environment verification.
- Explicit manual activation.
- Controlled canary limits.

The browser must never receive or store the Upstox API secret.

## Authentication

Upstox uses OAuth 2.0 authorization-code authentication. The authorization code is exchanged server-to-server for an access token. The registered redirect URI must exactly match the URI configured for the app.

Implementation boundary:
- Browser: initiate login and receive callback code.
- Server: exchange code for token.
- Secret manager: store client secret and production credentials.
- Broker adapter: consume short-lived/current access token through the server-side credential service.

## Market data

Use Upstox Market Stream Feed V3 for real-time data.

Required processing pipeline:

Upstox WebSocket
  -> decode feed
  -> validate timestamp
  -> reject duplicate/out-of-order ticks
  -> stale-data detector
  -> normalized internal tick
  -> strategy/risk engine

The normalized internal model should not expose Upstox-specific payload structures to strategy code.

## Order lifecycle

Signal
  -> pre-trade risk
  -> order validation
  -> idempotency key/tag
  -> Upstox adapter
  -> order acknowledgement
  -> order-status monitoring
  -> fill/trade reconciliation
  -> position reconciliation
  -> audit event

Every broker response must be mapped to an internal status model.

## Failure handling

The adapter must fail closed for:
- invalid/missing authentication
- stale market data
- duplicate order request
- broker timeout
- broker rejection
- connection loss
- position mismatch
- risk-limit violation
- kill switch activation

A failed safety check must produce NO_ORDER rather than continuing to broker execution.

## Sandbox-first implementation order

1. Create Upstox sandbox app/token.
2. Implement authentication boundary.
3. Implement sandbox market-data/order clients.
4. Implement order lifecycle.
5. Implement reconciliation.
6. Add failure and idempotency tests.
7. Run the existing paper/sandbox qualification gates.
8. Only after sandbox qualification, create production deployment configuration.
9. Verify production environment separately.
10. Require explicit manual activation before any live execution.

## Current safety state

PAPER_ONLY=true
REAL_ORDER_PLACED=false
PRODUCTION_REAL_TRADING_ENABLED=false
