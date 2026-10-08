// Mock-only Analytics Token qualification: never contacts a real broker and
// never uses a real Upstox credential.
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
const nativeFetch=globalThis.fetch;
const token='TEST_ONLY_FAKE_ANALYTICS_TOKEN';
const upstream=[];
process.env.UPSTOX_ANALYTICS_TOKEN=token;
process.env.PORT=String(24000+Math.floor(Math.random()*9000));
delete process.env.UPSTOX_CLIENT_ID;
delete process.env.UPSTOX_CLIENT_SECRET;
const instrument={segment:'MCX_FO',exchange:'MCX',instrument_type:'FUT',underlying_type:'COM',
  instrument_key:'MCX_FO|12345',trading_symbol:'GOLD FUT 30 DEC 99',underlying_symbol:'GOLD',
  expiry:'2099-12-30',lot_size:100,tick_size:1,qty_multiplier:1,strike_price:0};
globalThis.fetch=async(url,options={})=>{
  const u=new URL(String(url));
  if(u.hostname==='assets.upstox.com'&&u.pathname==='/market-quote/instruments/exchange/MCX.json.gz'){
    const rows=[instrument,{...instrument,underlying_symbol:'GOLDM',instrument_key:'MCX_FO|9999'},
      {...instrument,expiry:'2020-01-01',instrument_key:'MCX_FO|9998'}];
    return new Response(gzipSync(Buffer.from(JSON.stringify(rows))),{
      status:200,headers:{'content-type':'application/gzip'}});
  }
  if(u.hostname!=='api.upstox.com')return nativeFetch(url,options);
  upstream.push({path:u.pathname,method:options.method||'GET',auth:options.headers?.Authorization});
  assert.equal(options.headers?.Authorization,'Bearer '+token,'All provider requests must use the env-backed token');
  const method=options.method||'GET';
  assert.ok(method==='GET'||(method==='POST'&&u.pathname==='/v2/charges/margin'),
    'Upstream non-GET must be the broker margin calculator, never an order API');
  if(u.pathname==='/v2/charges/margin'){
    assert.equal(method,'POST');
    const params=JSON.parse(options.body);
    assert.equal(params.instruments.length,1);
    assert.deepEqual(params.instruments[0],{
      instrument_key:'MCX_FO|12345',quantity:1,transaction_type:'BUY',
      product:'I',price:149601
    });
    return new Response(JSON.stringify({status:'success',data:{required_margin:76500,
      final_margin:76500,margins:[{span_margin:65000,exposure_margin:11500}]}}),{status:200});
  }
  if(u.pathname==='/v3/market-quote/quotes'){
    const key=u.searchParams.get('instrument_key');
    if(key==='MCX_FO|99999')return new Response(JSON.stringify({status:'error'}),{status:401});
    return new Response(JSON.stringify({status:'success',data:{GOLD:{
      instrument_token:key,last_price:100000,
      timestamp:new Date().toISOString(),last_trade_time:Date.now(),oi:1000,volume:20000,
      depth:{buy:[{price:99999}],sell:[{price:100001}]}
    }}}),{status:200});
  }
  throw Error('Unexpected analytics mock request: '+u.pathname);
};
await import('../server/upstoxOAuthCallbackServer.js');
const base='http://127.0.0.1:'+process.env.PORT;
async function get(path){
  const response=await nativeFetch(base+path);
  const body=await response.text();
  let json;try{json=JSON.parse(body);}catch{json=null;}
  assert.ok(!body.includes(token),'No API response may disclose the Analytics Token');
  return {response,json,body};
}
try{
  const status=await get('/api/upstox/status');
  assert.equal(status.json.authenticated,true,'Configured Analytics Token permits read-only market data');
  assert.equal(status.json.authMode,'ANALYTICS_TOKEN');
  assert.equal(status.json.credentialStatus,'CONFIGURED_UNVERIFIED');
  assert.equal(status.json.tokenVerified,false);
  assert.equal(status.json.tokenExpiresAt,null,'Broker owns one-year expiry');
  assert.equal(status.json.orderSubmissionAllowed,false);
  assert.equal(status.json.productionRealTradingEnabled,false);
  const gold=await get('/api/upstox/derivative-search?query=GOLD&type=FUT&exchange=MCX');
  assert.equal(gold.response.status,200,gold.body);
  assert.equal(gold.json.contracts.length,1);
  assert.equal(gold.json.contracts[0].instrumentKey,'MCX_FO|12345');
  assert.equal(gold.json.diagnostics.source,'MCX_BOD_JSON');
  assert.equal(upstream.length,0,'MCX BOD discovery should not invoke OAuth-only instrument search');
  const quote=await get('/api/upstox/live-quote?instrument_key=MCX_FO%7C12345');
  assert.equal(quote.response.status,200,quote.body);
  assert.equal(quote.json.quote.instrumentKey,'MCX_FO|12345');
  assert.equal(quote.json.orderSubmissionAllowed,false);
  const margin=await get('/api/upstox/paper-margin?instrument_key=MCX_FO%7C12345&side=BUY&quantity=1&price=149601');
  assert.equal(margin.response.status,200,margin.body);
  assert.equal(margin.json.requiredMargin,76500);
  assert.equal(margin.json.verified,true);
  assert.equal(margin.json.instrumentKey,'MCX_FO|12345');
  assert.equal(margin.json.userAvailableFundsVerified,false);
  assert.equal(margin.json.orderSubmissionAllowed,false);
  const cached=await get('/api/upstox/paper-margin?instrument_key=MCX_FO%7C12345&side=BUY&quantity=1&price=149601');
  assert.equal(cached.json.requiredMargin,76500);
  assert.equal(upstream.filter(x=>x.path==='/v2/charges/margin').length,1,'Repeated paper margin queries must use cache');
  const invalidMargin=await get('/api/upstox/paper-margin?instrument_key=BAD&side=SELL&quantity=0&price=0');
  assert.equal(invalidMargin.response.status,400);
  assert.equal(invalidMargin.json.error,'INVALID_PAPER_MARGIN_REQUEST');
  const marginPost=await nativeFetch(base+'/api/upstox/paper-margin',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:'BUY'})});
  assert.equal(marginPost.status,404,'No client POST route allowed');
  assert.equal((await get('/api/upstox/place-order')).response.status,404);
  const verified=await get('/api/upstox/status');
  assert.equal(verified.json.tokenVerified,true,'Successful provider GET validates Analytics Token');
  assert.equal(verified.json.credentialStatus,'VERIFIED');
  assert.equal((await get('/api/upstox/order')).response.status,404);
  assert.equal((await get('/api/upstox/place-order')).response.status,404);
  const failed=await get('/api/upstox/live-quote?instrument_key=MCX_FO%7C99999');
  assert.equal(failed.response.status,401,failed.body);
  assert.equal(failed.json.error,'UPSTOX_ANALYTICS_TOKEN_INVALID_OR_EXPIRED');
  assert.equal(failed.json.orderSubmissionAllowed,false);
  const rejected=await get('/api/upstox/status');
  assert.equal(rejected.json.authenticated,false);
  assert.equal(rejected.json.credentialStatus,'INVALID_OR_EXPIRED');
  const subsequent=await get('/api/upstox/live-quote?instrument_key=MCX_FO%7C12345');
  assert.equal(subsequent.response.status,401,'Rejected token must fail closed without another API request');
  assert.equal(upstream.length,3,'Only read-only quotes and broker margin calculation may reach Upstox');
  assert.ok(upstream.every(x=>x.path==='/v2/charges/margin'||x.method==='GET'));
  assert.ok(upstream.every(x=>!x.path.includes('order')),'No upstream order routes');
  console.log('UPSTOX ANALYTICS TOKEN QUALIFICATION PASSED: env-backed login, BOD, quote verification, 401 fail-closed, no credential leakage, no orders');
  process.exit(0);
}catch(error){console.error('UPSTOX ANALYTICS TOKEN QUALIFICATION FAILED',error);process.exit(1);}
