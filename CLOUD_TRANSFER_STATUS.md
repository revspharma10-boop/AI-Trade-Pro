# Cloud-only transfer — staged, not yet active on existing site

Status on 2026-10-25:
- Release: `algo-trader-dashboard-free.zip`, SHA-256 `8988e6566c9f095f826d7e46d6d8f822b151594ef5acb0d2a950ef241858ee05`.
- Local validation: 46 Python tests pass and browser JavaScript syntax passes.
- This release adds `Backup & restore → Copy paper records / Paste and restore records / Clear transfer text`, transferring account data using the clipboard and existing authenticated endpoints, **without a file download**.
- It preserves destination login/PIN and recovery credentials and validates the trade ledger before import.
- On browsers where clipboard write permission is unavailable, the text can be selected and copied manually; on import, paste into the temporary text box.
- Browser clipboard is not a secure vault and some systems keep clipboard history. It is cleared only on the supported browser clipboard; users should clear system history too. Do not transfer passwords, recovery keys, or database credentials.

## Important boundaries
- The version on the **existing public dashboard** `https://algo-trader-paper-free-demo.onrender.com` is still PIN release `6ff329d`, **without** these cloud-transfer buttons.
- The version on the `feature/neon-durable-storage-v1` branch is the candidate for the locked `algo-trader-neon-preview` Render Free service, which currently has no `ALGO_DATABASE_URL` secret and therefore intentionally will not start.
- This package has **not been deployed** to the source dashboard, because changing the Render Free service can erase temporary SQLite and PIN records. Cloud-to-cloud migration of existing records cannot be called complete.
- The database in Neon `algo-trader-paper-storage` exists and has schema; the actual application-to-Neon login and redeploy persistence tests are still outstanding.
- One-time user action remains: enter the private pooled Neon connection string and new admin/recovery keys in **Render → algo-trader-neon-preview → Environment**. No database passwords should be put in GitHub or chat.
- After Neon preview is online and verified, determine whether source data exists before updating the original site. The old site does not currently offer browser-copy; an upgrade would require its ephemeral data to survive a restart, which cannot be guaranteed.
- Both versions remain paper-only, with no live brokerage orders.
