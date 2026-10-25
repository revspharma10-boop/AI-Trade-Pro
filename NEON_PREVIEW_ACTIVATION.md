# Algo Trader Neon Free preview — secure activation

This checklist is for the **separate** Render service `algo-trader-neon-preview`; it does not alter `algo-trader-paper-free-demo` or `AI-Trade-Pro/main`.

## Current state

- Neon organization: Free
- Neon project: `algo-trader-paper-storage` (`floral-scene-36874905`)
- Neon default/main branch: nine required tables exist, 0 users, 0 trades, simulated $5,000 cash.
- Neon integration-test branch: `integration-check-20261025`. Its test rows are isolated and **not** in the main database.
- Free Render service: https://dashboard.render.com/web/srv-dbepd52vcj2c73dn98u0
- Preview URL: https://algo-trader-neon-preview.onrender.com
- GitHub source branch: `feature/neon-durable-storage-v1` (dashboard Python app is packaged in `algo-trader-dashboard-free.zip`).
- `ALGO_REQUIRE_DURABLE=1` is set. The preview is intentionally not usable until a valid Neon connection and administrator password are present; it never falls back to SQLite.

## Activation (requires private credentials entered directly by account owner)

1. In the **existing** dashboard at https://algo-trader-paper-free-demo.onrender.com, sign in and export **Backup & restore → Download backup**. Save it privately before any changes.
2. In https://console.neon.tech, open project **algo-trader-paper-storage**, branch **main**, and copy its **pooled** PostgreSQL connection string from Connection Details. **Never put it in GitHub or ChatGPT chat.**
3. In Render, open **algo-trader-neon-preview → Environment** (service link above). Add:
   - `ALGO_DATABASE_URL`: the pooled URL copied directly from Neon (private).
   - `ALGO_BOOTSTRAP_PASSWORD`: a newly generated unique password of at least 12 characters (private).
   - `ALGO_RECOVERY_KEY`: a separate newly generated recovery key of at least 32 characters (private).
   Keep `ALGO_REQUIRE_DURABLE=1`, `ALGO_REQUIRE_ADMIN=1`, `ALGO_SECURE_COOKIES=1`, `ALGO_MARKET_DATA_ENABLED=0`, `ALGO_BOOTSTRAP_USERNAME=admin` and the existing public origin.
4. Choose Render's **Save, deploy** action appropriate to the service; the preview intentionally has auto-deploy disabled. Do not change the original service.
5. Verify `https://algo-trader-neon-preview.onrender.com/health` returns HTTP 200 and `/api/deployment` reports `storage=remote_postgresql`, `durable_storage=true`, `paper_only=true`.
6. Log in using `admin` and the newly set password. If you have paper records, use the signed-in backup restore tool after reviewing the JSON. Confirm cash, open/closed trades and watchlist match, then export a fresh backup.
7. To confirm durability, after saving a harmless paper watchlist entry, redeploy **the preview** and sign in again to verify the entry remains. Keep exported backups and monitor Neon free quotas.

## Security and rollback

- Never copy database connection strings, passwords or recovery keys into source control, web forms other than trusted provider consoles, app logs or this chat.
- Failed database connectivity must leave the preview unavailable, not create a local database.
- If validation fails, leave the original website running unchanged; remove or fix only the new preview settings.
- Both services are paper trading only. No brokerage API keys or real orders.
- The app is a prototype and is not independently security-audited.
