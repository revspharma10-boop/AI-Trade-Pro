#!/usr/bin/env python3
"""Phase 1B free D1 schema qualification in a disposable in-memory SQLite DB.
Synthetic input only. No Cloudflare/Upstox access, credentials, or real orders.
"""
from pathlib import Path
import sqlite3

schema = Path(__file__).with_name("schema.sql").read_text()
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(schema)

def rejects(action, name):
    try:
        with db:
            action()
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected database constraint rejection: {name}")

forecast = (
    "a" * 64, "nifty", "NSE", "or15-shadow-v1",
    "2026-10-09T04:00:00.000Z", "2026-10-09T04:01:00.000Z",
    "2026-10-09T04:05:00.000Z", "BULLISH", "NSE_INDEX|TestIndex",
    103.20, "2026-10-09T04:01:00.000Z", "b" * 64,
    "VERIFIED", "OPENING_15M_BULLISH_BODY_AND_CLOSE_SEQUENCE", 1, 0, 0
)
columns = ("id,market,exchange,strategy_version,candle_end_utc,"
           "captured_at_utc,horizon_end_utc,direction,underlying_instrument_key,"
           "reference_price,source_quote_utc,evidence_hash,data_quality,"
           "reason_code,paper_only,order_submission_allowed,real_order_placed")
insert = f"INSERT INTO forecasts ({columns}) VALUES ({','.join(['?'] * 17)})"
with db:
    db.execute(insert, forecast)
assert db.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0] == 1

rejects(lambda: db.execute(insert, ("c" * 64,) + forecast[1:]),
        "same market, strategy and candle may not create a duplicate")
rejects(lambda: db.execute(insert, forecast[:15] + (1, 0)),
        "order submission always disabled")
rejects(lambda: db.execute(insert, forecast[:16] + (1,)),
        "no real order possible")
rejects(lambda: db.execute(insert, forecast[:8] + (None,) + forecast[9:]),
        "verified direction needs exact underlying key")
rejects(lambda: db.execute(insert, forecast[:9] + (None,) + forecast[10:]),
        "directional forecast cannot have missing price")
rejects(lambda: db.execute(insert, forecast[:12] + ("MISSING",) + forecast[13:]),
        "bullish forecast cannot have missing data quality")

abstain = (
    "d" * 64, "sensex", "BSE", "or15-shadow-v1",
    "2026-10-09T04:00:00.000Z", "2026-10-09T04:01:00.000Z",
    "2026-10-09T04:05:00.000Z", "ABSTAIN", None, None, None, None,
    "MISSING", "QUOTE_MISSING_OR_STALE", 1, 0, 0
)
with db:
    db.execute(insert, abstain)
assert db.execute("SELECT direction FROM forecasts WHERE market='sensex'").fetchone()[0] == "ABSTAIN"

outcome = (
    "e" * 64, forecast[0], "nifty", "NSE",
    "2026-10-09T04:06:00.000Z", "2026-10-09T04:05:00.000Z",
    103.7, 48.4496, "CORRECT", 1, 0, 0
)
out_cols = ("id,forecast_id,market,exchange,evaluated_at_utc,horizon_end_utc,"
            "observed_close,change_bps,outcome,paper_only,order_submission_allowed,real_order_placed")
out_insert = f"INSERT INTO outcomes ({out_cols}) VALUES ({','.join(['?'] * 12)})"
with db:
    db.execute(out_insert, outcome)
assert db.execute("SELECT outcome FROM outcomes").fetchone()[0] == "CORRECT"

rejects(lambda: db.execute(out_insert, ("f" * 64,) + outcome[1:]),
        "a forecast can have only one outcome")
rejects(lambda: db.execute(out_insert, outcome[:1] + ("f" * 64,) + outcome[2:]),
        "an outcome cannot refer to a nonexistent forecast")
rejects(lambda: db.execute(out_insert, outcome[:6] + (None,) + outcome[7:]),
        "CORRECT outcome cannot lack an observed close")
rejects(lambda: db.execute(out_insert, outcome[:6] + (103.7, None) + outcome[8:]),
        "CORRECT outcome needs numeric movement")
rejects(lambda: db.execute(out_insert, outcome[:8] + ("UNEVALUABLE",) + outcome[9:]),
        "missing-data outcome cannot contain an invented close")
rejects(lambda: db.execute("UPDATE forecasts SET direction='BEARISH'"),
        "predictions are immutable after insert")
rejects(lambda: db.execute("DELETE FROM forecasts"),
        "predictions cannot be removed by routine service code")
rejects(lambda: db.execute("UPDATE outcomes SET outcome='INCORRECT'"),
        "outcomes are immutable after insert")
rejects(lambda: db.execute("DELETE FROM outcomes"),
        "outcome history cannot be removed by routine service code")

assert db.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0] == 2
assert db.execute("SELECT COUNT(*) FROM outcomes").fetchone()[0] == 1
print("PHASE 1B SQLITE/D1 SCHEMA QUALIFICATION PASSED: uniqueness, verified data, zero orders, immutable forecasts/outcomes, foreign-key integrity")
