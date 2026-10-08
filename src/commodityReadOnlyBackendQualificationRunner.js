// Isolated backend integration test with fake Upstox HTTP responses.
// Never contacts a broker and never uses a real token.
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
const nativeFetch=globalThis.fetch;
const records=[];
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const fakeToken='TEST_ONLY_FAKE_TOKEN';
const future={segment:'MCX_FO',exchange:'MCX',instrument_type:'FUT',underlying_type:'COM',
 instrument_key:'MCX_FO|12345',trading_symbol:'GOLD FUT 05 NOV 26',underlying_symbol:'GOLD',
 expiry:'2026-11-05',lot_size:100,tick_size:1,qty_multiplier:1,strike_price:0};
const call={...future,underlying_key:future.instrument_key,instrument_type:'CE',instrument_key:'MCX_FO|12346',
 trading_symbol:'GOLD 100000 CE 05 NOV 26',strike_price:100000};
globalThis.fetch=async(url,options={})=>{
 const u=new URL(typeof url==='string'?url:url.toString());
 if(u.hostname==='assets.upstox.com'&&u.pathname==='/market-quote/instruments/exchange/MCX.json.gz'){
   // Actual official instrument-master response is gzip-compressed JSON.
   // Include expired and unrelated instruments to assert fail-closed filtering.
   const rows=[future,{...future,instrument_key:'MCX_FO|99991',expiry:'2025-01-01'},
     {...future,instrument_key:'MCX_FO|99992',underlying_symbol:'GOLDM',trading_symbol:'GOLDM FUT 05 NOV 26'},
     {...future,instrument_key:'MCX_FO|99993',exchange:'NSE'},call];
   return new Response(gzipSync(Buffer.from(JSON.stringify(rows))),{
     status:200,headers:{'content-type':'application/gzip'}});
 }
 if(u.hostname!=='api.upstox.com')return nativeFetch(url,options);
 records.push({pathname:u.pathname,params:Object.fromEntries(u.searchParams),method:options.method||'GET'});
 if(u.pathname==='/v2/login/authorization/token')return reply({access_token:fakeToken,token_type:'Bearer'});
 assert.equal(options.headers?.Authorization,'Bearer '+fakeToken,'Backend must authenticate upstream without exposing the token to clients');
 if(u.pathname==='/v2/user/profile')return reply({status:'success',data:{user_id:'mock-user'}});
 if(u.pathname==='/v2/instruments/search'){
   assert.equal(u.searchParams.get('exchanges'),'MCX');
   assert.equal(u.searchParams.get('segments'),'FO');
   assert.equal(u.searchParams.get('records'),'30');
   const kind=u.searchParams.get('instrument_types');
   if(kind==='CE')return reply({status:'success',data:[call],meta_data:{page:{total_pages:1,page_number:1}}});
   if(kind==='PE')return reply({status:'success',data:[{...call,instrument_type:'PE',instrument_key:'MCX_FO|12347'}],meta_data:{page:{total_pages:1,page_number:1}}});
   assert.equal(kind,null,'Futures lookup must not use CE/PE-only filtering');
   const query=u.searchParams.get('query');
   if(query==='GOLD'||query==='NOTLISTED')
     return reply({status:'success',data:[],meta_data:{page:{total_pages:1,page_number:1}}});
   if(query==='GOLDPAGE'){
     const page=Number(u.searchParams.get('page_number'));
     const pageCall={...call,underlying_symbol:'GOLDPAGE'};
     const pageFuture={...future,underlying_symbol:'GOLDPAGE',trading_symbol:'GOLDPAGE FUT 05 NOV 26'};
     if(page===1)return reply({status:'success',data:[pageCall],meta_data:{page:{total_pages:2,page_number:1}}});
     if(page===2)return reply({status:'success',data:[pageFuture],meta_data:{page:{total_pages:2,page_number:2}}});
   }
   throw new Error('Unexpected search query/page');
 }
 if(u.pathname==='/v3/market-quote/quotes'){
   return reply({status:'success',data:{'MCX_FO:GOLD':{
     instrument_token:u.searchParams.get('instrument_key'),last_price:101000,
     timestamp:new Date().toISOString(),last_trade_time:String(Date.now()),oi:1000,volume:20000,
     depth:{buy:[{price:100999}],sell:[{price:101001}]}
   }}});
 }
 if(u.pathname==='/v3/market-quote/option-greek'){
   return reply({status:'success',data:{'MCX_FO:GOLD CE':{
     instrument_token:u.searchParams.get('instrument_key'),iv:0.28,delta:0.4,gamma:0.01,theta:-1.5,vega:2.3
   }}});
 }
 if(u.pathname.startsWith('/v3/historical-candle/intraday/')){
   return reply({status:'success',data:{candles:[[new Date().toISOString(),100,102,99,101,2000,0]]}});
 }
 throw new Error('Unexpected fake broker request: '+u.toString());
};
process.env.PORT=''+(23000+Math.floor(Math.random()*12000));
process.env.UPSTOX_CLIENT_ID='fixture-client';
process.env.UPSTOX_CLIENT_SECRET='fixture-secret';
process.env.UPSTOX_REDIRECT_URI='http://localhost/fixture/callback';
await import('../server/upstoxOAuthCallbackServer.js');
const base='http://127.0.0.1:'+process.env.PORT;
async function get(path,init){
 const response=await nativeFetch(base+path,init);
 const body=await response.text();
 let json=null;try{json=JSON.parse(body);}catch{}
 return {response,body,json};
}
try{
 const initial=await get('/api/upstox/status');
 assert.equal(initial.json.authenticated,false);
 const start=await get('/auth/upstox/start',{redirect:'manual'});
 assert.equal(start.response.status,302);
 const state=new URL(start.response.headers.get('location')).searchParams.get('state');
 const cookie=start.response.headers.get('set-cookie').split(';')[0];
 const callback=await get('/auth/upstox/callback?code=fixture-code&state='+encodeURIComponent(state),
   {headers:{Cookie:cookie}});
 assert.equal(callback.response.status,200,callback.body);
 assert.ok(callback.body.includes('UPSTOX_OAUTH_AUTHENTICATION_PASSED'));
 assert.equal(callback.body.includes(fakeToken),false,'OAuth callback must not leak token');
 const authenticated=await get('/api/upstox/status');
 assert.equal(authenticated.json.authenticated,true);
 assert.equal(authenticated.json.authMode,'OAUTH_DAILY');
 assert.equal(authenticated.json.tokenVerified,true);
 assert.ok(authenticated.json.tokenExpiresAt,'Daily OAuth token must report actual expiry');
 const expires=new Date(authenticated.json.tokenExpiresAt);
 assert.equal(expires.getUTCHours(),22,'03:30 IST corresponds to 22:00 UTC');
 assert.equal(expires.getUTCMinutes(),0);
 assert.ok(expires.getTime()>Date.now()&&expires.getTime()-Date.now()<=86400000);

 const fut=await get('/api/upstox/derivative-search?query=GOLD&type=FUT&exchange=MCX');
 assert.equal(fut.response.status,200,JSON.stringify(fut.json));
 assert.equal(fut.json.contracts.length,1);
 assert.equal(fut.json.contracts[0].segment,'MCX_FO');
 assert.equal(fut.json.contracts[0].underlyingSymbol,'GOLD');
 assert.equal(fut.json.contracts[0].qtyMultiplier,1);
 assert.equal(fut.json.diagnostics.upstreamCount,0);
 assert.equal(fut.json.diagnostics.matchedCount,1);
 assert.equal(fut.json.diagnostics.pagesRead,1);
 assert.equal(fut.json.diagnostics.bodRecordCount,4);
 assert.equal(fut.json.diagnostics.source,'MCX_BOD_JSON');
 assert.equal(fut.json.diagnostics.result,'BOD_FALLBACK_MATCHES');
 const paginated=await get('/api/upstox/derivative-search?query=GOLDPAGE&type=FUT&exchange=MCX');
 assert.equal(paginated.json.contracts.length,1);
 assert.equal(paginated.json.contracts[0].underlyingSymbol,'GOLDPAGE');
 assert.equal(paginated.json.diagnostics.pagesRead,2);
 assert.equal(paginated.json.diagnostics.source,'INSTRUMENT_SEARCH');
 assert.equal(fut.json.orderSubmissionAllowed,false);
 const opt=await get('/api/upstox/derivative-search?query=GOLD&type=CE&exchange=MCX');
 assert.equal(opt.json.contracts.length,1);
 assert.equal(opt.json.contracts[0].strike,100000);
 assert.equal(opt.json.contracts[0].underlyingKey,future.instrument_key);
 const putResult=await get('/api/upstox/derivative-search?query=GOLD&type=PE&exchange=MCX');
 assert.equal(putResult.response.status,200);
 assert.equal(putResult.json.contracts[0].instrumentType,'PE');
 assert.equal(putResult.json.contracts[0].underlyingKey,future.instrument_key);
 const empty=await get('/api/upstox/derivative-search?query=NOTLISTED&type=FUT&exchange=MCX');
 assert.equal(empty.json.contracts.length,0);
 assert.equal(empty.json.diagnostics.result,'BOD_NO_MATCHES');
 assert.equal(empty.json.diagnostics.source,'MCX_BOD_JSON');
 assert.equal(empty.json.orderSubmissionAllowed,false);
 const invalid=await get('/api/upstox/derivative-search?query=GOLD&type=INVALID&exchange=MCX');
 assert.equal(invalid.response.status,400);
 const quote=await get('/api/upstox/live-quote?instrument_key=MCX_FO%7C12345');
 assert.equal(quote.response.status,200,JSON.stringify(quote.json));
 assert.equal(quote.json.quote.lastPrice,101000);
 assert.equal(quote.json.quote.openInterest,1000);
 assert.equal(quote.json.quote.bid,100999);
 assert.equal(quote.json.quote.ask,101001);
 assert.ok(Number.isFinite(quote.json.quote.lastTradeTime));
 assert.equal(quote.json.body?.access_token,undefined);
 assert.equal(quote.response.headers.get('access-control-allow-origin'),'https://revspharma10-boop.github.io');
 const greek=await get('/api/upstox/option-greeks?instrument_key=MCX_FO%7C12346');
 assert.equal(greek.response.status,200,JSON.stringify(greek.json));
 assert.equal(greek.json.greeks.iv,0.28);
 const candles=await get('/api/upstox/intraday?instrument_key=MCX_FO%7C12345&interval=5m');
 assert.equal(candles.response.status,200,JSON.stringify(candles.json));
 assert.equal(candles.json.candles.length,1);
 assert.equal(candles.json.orderSubmissionAllowed,false);
 assert.equal((await get('/api/upstox/live-quote?instrument_key=UNSAFE')).response.status,400);
 assert.equal((await get('/api/upstox/place-order')).response.status,404);
 assert.equal((await get('/api/upstox/order')).response.status,404);
 assert.ok(records.every(x=>!x.pathname.includes('place-order')));
 assert.equal(JSON.stringify({fut:fut.json,opt:opt.json,quote:quote.json,greek:greek.json,candles:candles.json}).includes(fakeToken),false);
 console.log('MCX BACKEND MOCK INTEGRATION PASSED: OAuth, futures/options search, V3 live quote, Greeks, candles, CORS and blocked order paths');
 process.exit(0);
}catch(err){console.error('MCX BACKEND MOCK INTEGRATION FAILED',err);process.exit(1);}
