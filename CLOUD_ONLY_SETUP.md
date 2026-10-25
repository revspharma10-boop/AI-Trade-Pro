# Algo Trader — cloud-only operation (no laptop files)

**User requirement:** the browser is the only user interface. Paper trades, watchlists, administrator PIN/password hashes, sessions and recovery metadata must reside on the cloud database. No required downloads, local installations, or manual laptop backups.

## Verified cloud services (25 October 2026)
- Existing URL: https://algo-trader-paper-free-demo.onrender.com
  - Render Free web service `srv-dbeo8p7avr4c73bilong` — currently uses ephemeral SQLite. Restarts and idle spin-down can erase server-side files and PIN state.
  - The 4-digit PIN release is live on branch `deploy/algo-trader-paper-free-v1`.
- Neon Free project `algo-trader-paper-storage` (`floral-scene-36874905`), main branch, region Singapore; 9 application tables created and checked. Main database had no users or trades when inspected.
- Locked Render Free preview URL: https://algo-trader-neon-preview.onrender.com
  - Service `srv-dbepd52vcj2c73dn98u0`, source branch `feature/neon-durable-storage-v1`.
  - The preview is correctly **fail-closed** while `ALGO_DATABASE_URL` is absent.
  - The PIN-enabled release ZIP in this feature branch is tested (42 unit tests), but not yet verified end-to-end against a live Neon-backed deployment.

## Activation through cloud consoles only (mobile/browser compatible)
1. Neon console https://console.neon.tech → project `algo-trader-paper-storage` → **main** → Connect → copy the **pooled** PostgreSQL URL.
2. Render https://dashboard.render.com/web/srv-dbepd52vcj2c73dn98u0 → Environment → add `ALGO_DATABASE_URL` with the Neon URL; set unique values for `ALGO_BOOTSTRAP_PASSWORD` (12+ chars) and `ALGO_RECOVERY_KEY` (32+ chars). Enter the secret values only in Render's private environment-variable editor. Do **not** paste secrets in GitHub or chat.
3. Preserve existing `ALGO_REQUIRE_DURABLE=1`, `ALGO_REQUIRE_ADMIN=1`, `ALGO_SECURE_COOKIES=1`; keep `ALGO_MARKET_DATA_ENABLED=0` and all broker execution disabled.
4. Deploy the **preview** (not the current website). Confirm the preview returns HTTP 200 at `/health` and `/api/deployment` returns `storage=remote_postgresql` and `durable_storage=true`. Log in and set your four-digit PIN in Account & PIN. Test a harmless watchlist change, redeploy preview, and verify it persists.
5. Existing ephemeral account data **will not migrate by itself**. Do not switch the main site's DATABASE_URL until an authenticated, browser-only transfer is designed and verified. Existing paper records may already be lost on Render Free spin-down. Never claim preservation without verifying before and after counts.
6. Promote the tested service only after verifying cloud persistence, login reset/recovery, paper trade validations, and an online-only migration for any remaining temporary data.

## Cloud recovery reality
- Render Free local SQLite data is ephemeral (on restart, redeploy, or idle spin-down).
- Neon Free retains database data independently of the Render process while within account plan quotas. This is storage persistence, **not a guaranteed backup**.
- Neon Free currently provides a 6-hour instant-restore history and at most one manual snapshot; **automated scheduled snapshots are not included on Free**.
- A separately stored **automatic** online backup with recovery testing is a distinct task; do not call it completed. Never put raw database exports or password hashes in a public GitHub repository.
- Cloud-only operation does not mean zero risk of data loss; monitor free usage limits and configure stronger redundancy if necessary. No real-money trading.
