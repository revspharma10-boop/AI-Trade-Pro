// ============================================================
// AI TRADE PRO
// Market Data Service
// Twelve Data API Integration
// ============================================================

const API_BASE_URL = 'https://api.twelvedata.com';


// ============================================================
// API KEY
// ============================================================

const API_KEY =
  import.meta.env.VITE_TWELVE_DATA_API_KEY ||
  import.meta.env.VITE_TWELVEDATA_API_KEY ||
  import.meta.env.VITE_TWELVE_API_KEY ||
  '';


// ============================================================
// CHECK API CONFIGURATION
// ============================================================

export function isMarketDataConfigured() {
  return (
    typeof API_KEY === 'string' &&
    API_KEY.trim().length > 0
  );
}


// ============================================================
// INTERNAL API REQUEST
// ============================================================

async function request(endpoint, params = {}) {

  if (!isMarketDataConfigured()) {

    throw new Error(
      'Twelve Data API key was not detected. Please check the .env file.'
    );

  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {

      searchParams.set(
        key,
        String(value)
      );

    }

  });

  searchParams.set(
    'apikey',
    API_KEY
  );

  const url =
    `${API_BASE_URL}${endpoint}?${searchParams.toString()}`;

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `Market data server returned HTTP ${response.status}.`
    );

  }

  const data =
    await response.json();

  if (
    data &&
    (
      data.status === 'error' ||
      data.code
    )
  ) {

    throw new Error(
      data.message ||
      'Twelve Data returned an API error.'
    );

  }

  return data;
}


// ============================================================
// GET QUOTE
// ============================================================

export async function getQuote(symbol) {

  if (!symbol) {

    throw new Error(
      'A valid market symbol is required.'
    );

  }

  const data =
    await request(
      '/quote',
      {
        symbol
      }
    );

  if (
    !data ||
    !data.symbol
  ) {

    throw new Error(
      'The market data provider returned an invalid quote response.'
    );

  }

  return {

    symbol:
      data.symbol ?? symbol,

    name:
      data.name ?? '',

    exchange:
      data.exchange ?? '',

    currency:
      data.currency ?? '',

    datetime:
      data.datetime ?? '',

    open:
      data.open !== undefined
        ? Number(data.open)
        : null,

    high:
      data.high !== undefined
        ? Number(data.high)
        : null,

    low:
      data.low !== undefined
        ? Number(data.low)
        : null,

    close:
      data.close !== undefined
        ? Number(data.close)
        : null,

    previousClose:
      data.previous_close !== undefined
        ? Number(data.previous_close)
        : null,

    change:
      data.change !== undefined
        ? Number(data.change)
        : null,

    percentChange:
      data.percent_change !== undefined
        ? Number(data.percent_change)
        : null,

    volume:
      data.volume !== undefined
        ? Number(data.volume)
        : null

  };

}


// ============================================================
// GET TIME SERIES
// ============================================================

export async function getTimeSeries(
  symbol,
  interval = '1day',
  outputsize = 100
) {

  if (!symbol) {

    throw new Error(
      'A valid market symbol is required.'
    );

  }

  const data =
    await request(
      '/time_series',
      {
        symbol,
        interval,
        outputsize
      }
    );

  if (
    !data ||
    !Array.isArray(data.values)
  ) {

    throw new Error(
      'The market data provider returned no time-series data.'
    );

  }

  return {

    symbol:
      data.meta?.symbol ?? symbol,

    interval:
      data.meta?.interval ?? interval,

    currency:
      data.meta?.currency ?? '',

    exchange:
      data.meta?.exchange ?? '',

    values:
      data.values.map((item) => ({

        datetime:
          item.datetime,

        open:
          Number(item.open),

        high:
          Number(item.high),

        low:
          Number(item.low),

        close:
          Number(item.close),

        volume:
          item.volume !== undefined
            ? Number(item.volume)
            : null

      }))

  };

}


// ============================================================
// CONNECTION TEST
// ============================================================

export async function testMarketDataConnection() {

  const quote =
    await getQuote('AAPL');

  return {

    connected:
      Boolean(
        quote &&
        quote.symbol &&
        quote.close !== null
      ),

    provider:
      'Twelve Data',

    testSymbol:
      quote.symbol,

    price:
      quote.close

  };

}


// ============================================================
// SERVICE LOADED MESSAGE
// ============================================================

console.log(
  'AI TRADE PRO — market data service loaded'
);