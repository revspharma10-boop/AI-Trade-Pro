// ============================================================
// AI TRADE PRO
// Fundamental Data Service
// ============================================================
//
// Fetches and normalizes Twelve Data financial statements.
//
// Income Statement
// Balance Sheet
// Cash Flow
//
// This service does NOT generate BUY/SELL signals.
// ============================================================

const API_BASE_URL = 'https://api.twelvedata.com';

const API_KEY =
  '6c8c8161f4e446b6a91da9090c6d2da0';


// ============================================================
// VALIDATION
// ============================================================

function validateSymbol(symbol) {
  if (
    typeof symbol !== 'string' ||
    symbol.trim() === ''
  ) {
    throw new Error(
      'A valid market symbol is required.'
    );
  }
}


// ============================================================
// API REQUEST
// ============================================================

async function request(endpoint, symbol) {
  validateSymbol(symbol);

  const url =
    `${API_BASE_URL}/${endpoint}` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(API_KEY)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Fundamental data server returned HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (
    data.status === 'error' ||
    data.code
  ) {
    throw new Error(
      data.message ||
      'Fundamental data request failed.'
    );
  }

  return data;
}


// ============================================================
// RAW FINANCIAL STATEMENTS
// ============================================================

export async function getIncomeStatement(symbol) {
  const data =
    await request(
      'income_statement',
      symbol
    );

  return data.income_statement || [];
}


export async function getBalanceSheet(symbol) {
  const data =
    await request(
      'balance_sheet',
      symbol
    );

  return data.balance_sheet || [];
}


export async function getCashFlow(symbol) {
  const data =
    await request(
      'cash_flow',
      symbol
    );

  return data.cash_flow || [];
}


// ============================================================
// NUMERIC HELPERS
// ============================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function safeDivide(
  numerator,
  denominator
) {
  const a = toNumber(numerator);
  const b = toNumber(denominator);

  if (
    a === null ||
    b === null ||
    b === 0
  ) {
    return null;
  }

  return a / b;
}


function growthRate(
  current,
  previous
) {
  const currentValue =
    toNumber(current);

  const previousValue =
    toNumber(previous);

  if (
    currentValue === null ||
    previousValue === null ||
    previousValue === 0
  ) {
    return null;
  }

  return (
    (
      (currentValue - previousValue) /
      Math.abs(previousValue)
    ) * 100
  );
}


// ============================================================
// FISCAL PERIOD VALIDATION
// ============================================================

function sameFiscalPeriod(
  income,
  balance,
  cashFlow
) {
  if (
    !income ||
    !balance ||
    !cashFlow
  ) {
    return false;
  }

  return (
    income.fiscal_date ===
      balance.fiscal_date &&
    income.fiscal_date ===
      cashFlow.fiscal_date
  );
}


// ============================================================
// NORMALIZE FUNDAMENTAL DATA
// ============================================================

export function normalizeFundamentalData({
  incomeStatements = [],
  balanceSheets = [],
  cashFlows = [],
  currentPrice = null,

  // Market quote is currently INR for INFY:NSE.
  marketCurrency = 'INR',

  // Twelve Data financial statements are currently
  // returned in USD for INFY:NSE.
  fundamentalCurrency = 'USD'

} = {}) {

  const income =
    incomeStatements[0] || null;

  const balance =
    balanceSheets[0] || null;

  const cashFlow =
    cashFlows[0] || null;


  // ----------------------------------------------------------
  // Required statement validation
  // ----------------------------------------------------------

  if (
    !income ||
    !balance ||
    !cashFlow
  ) {
    return {
      valid: false,
      reason:
        'One or more financial statements are unavailable.'
    };
  }


  // ----------------------------------------------------------
  // Fiscal period validation
  // ----------------------------------------------------------

  if (
    !sameFiscalPeriod(
      income,
      balance,
      cashFlow
    )
  ) {
    return {
      valid: false,
      reason:
        'Financial statements do not share the same fiscal period.'
    };
  }


  // ----------------------------------------------------------
  // Income statement
  // ----------------------------------------------------------

  const totalRevenue =
    toNumber(
      income.sales
    );

  const netIncome =
    toNumber(
      income.net_income
    );

  const eps =
    toNumber(
      income.eps_diluted ??
      income.eps_basic
    );


  // ----------------------------------------------------------
  // Balance sheet
  // ----------------------------------------------------------

  const totalAssets =
    toNumber(
      balance
        .assets
        ?.total_assets
    );

  const totalLiabilities =
    toNumber(
      balance
        .liabilities
        ?.total_liabilities
    );

  const shareholdersEquity =
    toNumber(
      balance
        .shareholders_equity
        ?.total_shareholders_equity
    );


  // ----------------------------------------------------------
  // Cash flow
  // ----------------------------------------------------------

  const operatingCashFlow =
    toNumber(
      cashFlow
        .operating_activities
        ?.operating_cash_flow
    );

  const freeCashFlow =
    toNumber(
      cashFlow
        .free_cash_flow
    );


  // ----------------------------------------------------------
  // Current market price
  // ----------------------------------------------------------

  const price =
    toNumber(
      currentPrice
    );


  // ----------------------------------------------------------
  // Profitability metrics
  // ----------------------------------------------------------

  const roeRaw =
    safeDivide(
      netIncome,
      shareholdersEquity
    );

  const roaRaw =
    safeDivide(
      netIncome,
      totalAssets
    );


  const roe =
    roeRaw !== null
      ? roeRaw * 100
      : null;

  const roa =
    roaRaw !== null
      ? roaRaw * 100
      : null;


  // ----------------------------------------------------------
  // Leverage
  // ----------------------------------------------------------

  const debtToEquity =
    safeDivide(
      totalLiabilities,
      shareholdersEquity
    );


  // ----------------------------------------------------------
  // Growth
  // ----------------------------------------------------------

  const previousIncome =
    incomeStatements[1] || null;

  const revenueGrowth =
    growthRate(
      totalRevenue,
      previousIncome?.sales
    );

  const earningsGrowth =
    growthRate(
      netIncome,
      previousIncome?.net_income
    );

  const previousEPS =
    previousIncome?.eps_diluted ??
    previousIncome?.eps_basic;

  const epsGrowth =
    growthRate(
      eps,
      previousEPS
    );


  // ----------------------------------------------------------
  // Currency safety
  // ----------------------------------------------------------
  //
  // IMPORTANT:
  //
  // Market price:
  //     INR
  //
  // Fundamental statements:
  //     USD
  //
  // Therefore we MUST NOT calculate:
  //
  //     INR price / USD EPS
  //
  // because that creates a meaningless P/E.
  //
  // Same protection applies to P/B.
  // ----------------------------------------------------------

  const currenciesMatch =
    Boolean(
      marketCurrency &&
      fundamentalCurrency &&
      marketCurrency ===
        fundamentalCurrency
    );


  // ----------------------------------------------------------
  // P/E
  // ----------------------------------------------------------

  const pe =
    currenciesMatch &&
    price !== null &&
    eps !== null &&
    eps > 0
      ? price / eps
      : null;


  // ----------------------------------------------------------
  // Book value per share
  // ----------------------------------------------------------

  const dilutedShares =
    toNumber(
      income.diluted_shares_outstanding
    );

  const bookValuePerShare =
    shareholdersEquity !== null &&
    dilutedShares !== null &&
    dilutedShares > 0
      ? shareholdersEquity /
        dilutedShares
      : null;


  // ----------------------------------------------------------
  // P/B
  // ----------------------------------------------------------

  const pb =
    currenciesMatch &&
    price !== null &&
    bookValuePerShare !== null &&
    bookValuePerShare > 0
      ? price /
        bookValuePerShare
      : null;


  // ----------------------------------------------------------
  // Final normalized object
  // ----------------------------------------------------------

  return {

    valid: true,

    fiscalDate:
      income.fiscal_date,

    year:
      income.year,


    // Currency information
    marketCurrency,

    fundamentalCurrency,

    currenciesMatch,


    // Core financial metrics
    revenue:
      totalRevenue,

    netIncome,

    eps,


    // Growth
    revenueGrowth,

    earningsGrowth,

    epsGrowth,


    // Profitability
    roe,

    roa,


    // Leverage
    debtToEquity,


    // Valuation
    pe,

    pb,

    bookValuePerShare,


    // Balance sheet
    totalAssets,

    totalLiabilities,

    shareholdersEquity,


    // Cash flow
    operatingCashFlow,

    freeCashFlow,


    // Market
    currentPrice:
      price

  };
}


// ============================================================
// COMPLETE FUNDAMENTAL DATA
// ============================================================

export async function getFundamentalData(
  symbol,
  currentPrice = null,
  options = {}
) {

  validateSymbol(symbol);


  const [
    incomeStatements,
    balanceSheets,
    cashFlows
  ] = await Promise.all([

    getIncomeStatement(symbol),

    getBalanceSheet(symbol),

    getCashFlow(symbol)

  ]);


  return normalizeFundamentalData({

    incomeStatements,

    balanceSheets,

    cashFlows,

    currentPrice,

    marketCurrency:
      options.marketCurrency ??
      'INR',

    fundamentalCurrency:
      options.fundamentalCurrency ??
      'USD'

  });
}


// ============================================================
// SERVICE STATUS
// ============================================================

console.log(
  'AI TRADE PRO — fundamental data service loaded'
);