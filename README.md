# Algo Trader Free Paper Demo

This isolated branch contains the free paper-only dashboard archive. It does not alter AI-Trade-Pro's main branch or other Render services.

The Render build command is `python -m zipfile -e algo-trader-dashboard-free.zip . && pip install -r algo-trader-dashboard-free/requirements.txt`. The Render start command is `cd algo-trader-dashboard-free && python -m uvicorn app:app --host 0.0.0.0 --port $PORT --proxy-headers`.

Free hosting uses ephemeral SQLite storage. Paper trades and logins may disappear on restart. Never use real brokerage credentials.
