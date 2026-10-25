# Neon persistent storage — deployment staging
This isolated feature branch contains a revised `algo-trader-dashboard-free.zip` with optional PostgreSQL storage. It does **not** modify `main` or the active Render deployment branch.

## Safety first
- **Do not deploy this branch or modify Render's database settings until you have downloaded a JSON backup of any data you want to keep** from the current dashboard.
- There is no included database password or `ALGO_DATABASE_URL` in GitHub.
- The live Render service still uses an ephemeral SQLite database until a Neon database is explicitly configured and tested.
- If `ALGO_REQUIRE_DURABLE=1` and `ALGO_DATABASE_URL` is missing, the app will fail at startup instead of silently reverting to temporary SQLite.
- The app must be tested against a real Neon database before claiming persistence works.
- This application can create *paper trades only*, no broker orders.

## Activation
1. Create/verify a free Neon PostgreSQL database, obtain its connection string securely, and configure `ALGO_DATABASE_URL` as a **secret** directly in your existing Render web service.
2. Set `ALGO_REQUIRE_DURABLE=1` after verifying the secret.
3. Deploy the revised ZIP using the existing Render extraction/build commands (the ZIP's app directory remains `algo-trader-dashboard-free/`).
4. Verify `/health`, `/api/deployment` (expect `remote_postgresql` and `durable_storage: true`), new sign-in, paper transaction, and persistence across redeployment.
5. Restore the prior JSON backup if needed. Keep additional backups.

Local unit suite: `python -m unittest discover -s tests -q` reported 37 tests passing on 2026-10-25. A live Neon integration test has **not** been completed.

Source and expanded notes are inside the archive under `DURABLE_STORAGE.md`.
