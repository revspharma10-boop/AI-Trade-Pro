-- AI Trade Pro 2.0 phase 1B free-tier D1, RESEARCH ONLY.
-- No account portfolios, authentication secrets, order ids, broker trades,
-- private margin/balance details or order submission columns.
-- Official exchange calendar rows must be inserted only after independent
-- source verification. No default/open weekday values are seeded.

CREATE TABLE IF NOT EXISTS verified_sessions (
 market TEXT NOT NULL CHECK (market IN ('nifty','sensex')),
 exchange TEXT NOT NULL CHECK (exchange IN ('NSE','BSE')),
 session_date TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
 closed INTEGER NOT NULL DEFAULT 1 CHECK (closed IN (0,1)),
 open_minute_ist INTEGER NOT NULL DEFAULT 555 CHECK (open_minute_ist=555),
 close_minute_ist INTEGER NOT NULL DEFAULT 930 CHECK (close_minute_ist BETWEEN 600 AND 930),
 source_id TEXT NOT NULL,
 verified_at_utc TEXT NOT NULL,
 PRIMARY KEY (market,session_date)
);

CREATE TABLE IF NOT EXISTS forecasts (
 id TEXT PRIMARY KEY,
 market TEXT NOT NULL CHECK (market IN ('nifty','sensex')),
 exchange TEXT NOT NULL CHECK (exchange IN ('NSE','BSE')),
 strategy_version TEXT NOT NULL,
 candle_end_utc TEXT NOT NULL,
 captured_at_utc TEXT NOT NULL,
 horizon_end_utc TEXT NOT NULL,
 direction TEXT NOT NULL CHECK (direction IN ('BULLISH','BEARISH','ABSTAIN')),
 underlying_instrument_key TEXT,
 reference_price REAL,
 source_quote_utc TEXT,
 evidence_hash TEXT,
 data_quality TEXT NOT NULL CHECK (data_quality IN ('VERIFIED','MISSING')),
 reason_code TEXT NOT NULL,
 paper_only INTEGER NOT NULL DEFAULT 1 CHECK (paper_only=1),
 order_submission_allowed INTEGER NOT NULL DEFAULT 0 CHECK (order_submission_allowed=0),
 real_order_placed INTEGER NOT NULL DEFAULT 0 CHECK (real_order_placed=0),
 UNIQUE (market,strategy_version,candle_end_utc)
);
CREATE INDEX IF NOT EXISTS idx_forecast_market_candle ON
 forecasts(market,candle_end_utc DESC);

CREATE TABLE IF NOT EXISTS outcomes (
 id TEXT PRIMARY KEY,
 forecast_id TEXT NOT NULL UNIQUE REFERENCES forecasts(id),
 market TEXT NOT NULL CHECK (market IN ('nifty','sensex')),
 exchange TEXT NOT NULL CHECK (exchange IN ('NSE','BSE')),
 evaluated_at_utc TEXT NOT NULL,
 horizon_end_utc TEXT NOT NULL,
 observed_close REAL,
 change_bps REAL,
 outcome TEXT NOT NULL CHECK (outcome IN
  ('CORRECT','INCORRECT','INCONCLUSIVE','UNEVALUABLE')),
 paper_only INTEGER NOT NULL DEFAULT 1 CHECK (paper_only=1),
 order_submission_allowed INTEGER NOT NULL DEFAULT 0 CHECK (order_submission_allowed=0),
 real_order_placed INTEGER NOT NULL DEFAULT 0 CHECK (real_order_placed=0)
);
CREATE INDEX IF NOT EXISTS idx_outcome_forecast ON outcomes(forecast_id);
