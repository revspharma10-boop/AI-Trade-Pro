// Isolated read-only option-contract and NSE index API mock qualification.
import assert from 'node:assert/strict';
const nativeFetch=globalThis.fetch;
const requests=[];
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const key='NSE_INDEX|Nifty 50';
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(String(url));
 if(u.hostname!=='api.upstox.com')return nativeFetch(url,opts);
 requests.push({url:u,method:opts.method||'GET'});
 assert.equal(opts.headers?.Authorization,'Bearer TEST_FAKE_READONLY_TOKEN');
 if(u.pathname==='/v2/instruments/search'){
   assert.equal(u.searchParams.get('segments'),'INDEX');
   assert.equal(u.searchParams.get('exchanges'),'NSE');
   return reply({status:'success',data:[
     {segment:'NSE_INDEX',instrument_key:key,name:'Nifty 50',trading_symbol:'NIFTY 50'},
     {segment:'BSE_INDEX',instrument_key:'BSE_INDEX|SENSEX',name:'SENSEX',trading_symbol:'SENSEX'}]});
 }
 if(u.pathname==='/v2/option/contract'){
   assert.equal(u.searchParams.get('instrument_key'),key);
   const candidate={segment:'NSE_FO',underlying_key:key,underlying_symbol:'NIFTY',
      instrument_key:'NSE_FO|123',trading_symbol:'NIFTY 25000 CE 15 NOV 26',
      expiry:'2026-11-15',instrument_type:'CE',strike_price:25000,lot_size:65,tick_size:5};
   return reply({status:'success',data:[candidate,
     {...candidate,underlying_key:'NSE_INDEX|OTHER',instrument_key:'NSE_FO|999'},
     {...candidate,segment:'MCX_FO',instrument_key:'MCX_FO|123'},
     {...candidate,instrument_key:'NSE_FO|321',instrument_type:'PE',trading_symbol:'NIFTY 25000 PE 15 NOV 26'}]});
 }
 throw Error('Unexpected API '+u.toString());
};
process.env.PORT=String(30000+Math.floor(Math.random()*10000));
process.env.UPSTOX_ANALYTICS_TOKEN='TEST_FAKE_READONLY_TOKEN';
await import('../server/upstoxOAuthCallbackServer.js');
const base='http://127.0.0.1:'+process.env.PORT;
const get=async path=>{const response=await nativeFetch(base+path);const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{body=raw;}return {status:response.status,body};};
try{
 const index=await get('/api/upstox/index-search?query=NIFTY');
 assert.equal(index.status,200);
 assert.equal(index.body.instrument.instrumentKey,key);
 assert.equal(index.body.orderSubmissionAllowed,false);
 const data=await get('/api/upstox/option-contracts?underlying_key='+encodeURIComponent(key));
 assert.equal(data.status,200);
 assert.equal(data.body.contracts.length,2);
 assert.deepEqual(data.body.contracts.map(x=>x.instrumentType).sort(),['CE','PE']);
 assert.equal(data.body.contracts[0].lotSize,65);
 assert.equal(data.body.contracts[0].tickSize,5);
 assert.equal(data.body.contracts[0].strike,25000);
 assert.equal(data.body.orderSubmissionAllowed,false);
 assert.equal((await get('/api/upstox/option-contracts?underlying_key=MCX_FO%7C42')).status,400);
 assert.equal((await get('/api/upstox/index-search?query=FAKEINDEX')).status,400);
 assert.equal((await get('/api/upstox/place-order')).status,404);
 assert.ok(requests.every(r=>r.method==='GET'&&!r.url.pathname.includes('order')));
 assert.equal(JSON.stringify({index,data}).includes('TEST_FAKE_READONLY_TOKEN'),false);
 console.log('AUTO OPTION BACKEND MOCK QUALIFICATION PASSED: index resolution, exact contracts, 0 order routes');
 process.exit(0);
}catch(e){console.error('AUTO OPTION BACKEND MOCK QUALIFICATION FAILED',e);process.exit(1);}
