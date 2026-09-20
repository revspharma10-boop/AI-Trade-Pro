# Upstox Sandbox Connectivity Runbook

1. Create exactly one Upstox Sandbox App in the Upstox Developer Apps portal.
2. Generate the Sandbox Access Token.
3. Store it locally/server-side as `UPSTOX_SANDBOX_ACCESS_TOKEN`; never commit it.
4. Use the sandbox transport in `src/upstox/upstoxSandboxHttpTransport.js`.
5. Run the sandbox order lifecycle against the documented sandbox-enabled V3 endpoints:
   - Place Order V3
   - Modify Order V3
   - Cancel Order V3
6. Capture request/response status, order ID and reconciliation result.
7. Run the GitHub validation workflow.
8. Do not substitute a live token for the sandbox token.

Upstox documents that sandbox tokens are exclusively for sandbox orders and that the sandbox supports Place, Modify and Cancel Order V3 APIs. Sandbox testing is intended to run without real funds. 
