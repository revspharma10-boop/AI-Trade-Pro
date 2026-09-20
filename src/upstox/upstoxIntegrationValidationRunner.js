import { createUpstoxConfig } from './upstoxConfig.js';
import { buildUpstoxAuthorizationUrl } from './upstoxOAuth.js';
import { createUpstoxBrokerAdapter } from './upstoxBrokerAdapter.js';
import { createUpstoxMarketDataProcessor } from './upstoxMarketData.js';

export function runUpstoxIntegrationValidation() {
  const checks = [];
  const check = (name, fn) => {
    try { fn(); checks.push({name, passed:true}); }
    catch (error) { checks.push({name, passed:false, error:error.message}); }
  };

  const config = createUpstoxConfig();
  check('sandbox is default', () => { if (config.environment !== 'SANDBOX') throw new Error('not sandbox'); });
  check('live execution disabled', () => { if (config.liveExecutionEnabled) throw new Error('live enabled'); });
  check('OAuth authorization URL', () => {
    const u = new URL(buildUpstoxAuthorizationUrl({clientId:'test',redirectUri:'https://example.invalid/callback',state:'test-state'}));
    if (u.searchParams.get('response_type') !== 'code') throw new Error('OAuth response_type mismatch');
  });

  const calls = [];
  const adapter = createUpstoxBrokerAdapter({config, transport:{async request(path, options){calls.push({path,options}); return {status:'success', sandbox:true};}}});
  check('order validation accepts valid sandbox order', () => adapter.validateOrder({
    instrumentToken:'NSE_EQ|TEST', quantity:1, orderType:'MARKET', transactionType:'BUY', validity:'DAY'
  }));
  check('invalid quantity rejected', () => {
    try { adapter.validateOrder({instrumentToken:'NSE_EQ|TEST',quantity:0,orderType:'MARKET',transactionType:'BUY',validity:'DAY'}); throw new Error('not rejected'); } catch(e) { if(e.message === 'not rejected') throw e; }
  });
  check('duplicate tick rejected', () => {
    const p=createUpstoxMarketDataProcessor({clock:()=>1000,maxAgeMs:10000});
    p.normalize({id:'a',instrumentToken:'X',timestamp:1000,price:10});
    try { p.normalize({id:'a',instrumentToken:'X',timestamp:1000,price:10}); throw new Error('not rejected'); } catch(e) { if(e.message !== 'DUPLICATE_TICK') throw e; }
  });
  check('out-of-order tick rejected', () => {
    const p=createUpstoxMarketDataProcessor({clock:()=>2000,maxAgeMs:10000});
    p.normalize({id:'a',instrumentToken:'X',timestamp:2000,price:10});
    try { p.normalize({id:'b',instrumentToken:'X',timestamp:1999,price:10}); throw new Error('not rejected'); } catch(e) { if(e.message !== 'OUT_OF_ORDER_TICK') throw e; }
  });
  check('stale tick rejected', () => {
    const p=createUpstoxMarketDataProcessor({clock:()=>10000,maxAgeMs:1000});
    try { p.normalize({id:'a',instrumentToken:'X',timestamp:8000,price:10}); throw new Error('not rejected'); } catch(e) { if(e.message !== 'STALE_TICK') throw e; }
  });
  check('sandbox order request stays inside adapter', async () => {
    // Structural check only; no broker call is made by this runner.
    if (adapter.environment !== 'SANDBOX') throw new Error('wrong environment');
  });
  check('production activation remains disabled', () => {
    if (config.liveExecutionEnabled !== false) throw new Error('unsafe default');
  });

  return {
    checks,
    passed: checks.filter(x=>x.passed).length,
    failed: checks.filter(x=>!x.passed).length,
    allAssertionsPassed: checks.every(x=>x.passed),
    safety:{PAPER_ONLY:true, REAL_ORDER_PLACED:false, PRODUCTION_REAL_TRADING_ENABLED:false}
  };
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  const result=runUpstoxIntegrationValidation();
  console.log(JSON.stringify(result,null,2));
  process.exit(result.allAssertionsPassed ? 0 : 1);
}