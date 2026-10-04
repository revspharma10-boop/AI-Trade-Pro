/* AI TRADE PRO — UPSTOX SANDBOX LIFECYCLE QUALIFICATION
 * Sandbox only. Exercises place -> modify -> history -> cancel -> history.
 * No live environment and no production activation.
 */

const token=(process.env.UPSTOX_SANDBOX_ACCESS_TOKEN||'').trim();
const baseUrl='https://api-sandbox.upstox.com';
const instrumentToken=process.env.UPSTOX_SANDBOX_TEST_INSTRUMENT||'NSE_EQ|INE669E01016';
const initialPrice=Number(process.env.UPSTOX_SANDBOX_TEST_PRICE||'9.12');
const modifiedPrice=Number(process.env.UPSTOX_SANDBOX_MODIFIED_PRICE||(initialPrice+0.01).toFixed(2));
const tag='AI-TRADE-PRO-LIFECYCLE-'+Date.now();

if(!token){console.error('UPSTOX_SANDBOX_ACCESS_TOKEN_REQUIRED');process.exit(2);}
if(!Number.isFinite(initialPrice)||initialPrice<=0||!Number.isFinite(modifiedPrice)||modifiedPrice<=0){console.error('UPSTOX_SANDBOX_TEST_PRICE_INVALID');process.exit(4);}
if(process.env.UPSTOX_ENVIRONMENT==='LIVE'||process.env.PRODUCTION_REAL_TRADING_ENABLED==='true'){console.error('SAFETY_BLOCK_LIVE_ENVIRONMENT');process.exit(3);}

async function request(path,{method='GET',body}={}){
  const r=await fetch(baseUrl+path,{method,headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await r.json().catch(()=>({}));
  return {status:r.status,ok:r.ok,payload};
}
function message(p){return p?.errors?.[0]?.message??p?.message??'UNKNOWN_API_RESPONSE';}
function requireOk(label,r){
  if(!r.ok){console.error(label+'_FAILED status='+r.status);console.error(label+'_MESSAGE='+message(r.payload));process.exit(1);}
}

console.log('UPSTOX_SANDBOX_LIFECYCLE_QUALIFICATION_START');
console.log('environment=SANDBOX');
console.log('sandbox_token_present=true');
console.log('instrument='+instrumentToken);
console.log('initial_price='+initialPrice);
console.log('modified_price='+modifiedPrice);
console.log('tag='+tag);
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');

const place=await request('/v3/order/place',{method:'POST',body:{
  quantity:1,product:'D',validity:'DAY',price:initialPrice,tag,instrument_token:instrumentToken,
  order_type:'LIMIT',transaction_type:'BUY',disclosed_quantity:0,trigger_price:0,is_amo:true,slice:true
}});
requireOk('SANDBOX_LIFECYCLE_PLACE',place);
const orderId=place.payload?.data?.order_ids?.[0]??place.payload?.data?.order_id??place.payload?.order_id;
if(!orderId){console.error('SANDBOX_LIFECYCLE_NO_ORDER_ID');process.exit(1);}
console.log('PLACE_PASSED=true');

const modify=await request('/v3/order/modify',{method:'PUT',body:{
  quantity:1,validity:'DAY',price:modifiedPrice,order_id:orderId,order_type:'LIMIT',disclosed_quantity:0,trigger_price:0
}});
requireOk('SANDBOX_LIFECYCLE_MODIFY',modify);
console.log('MODIFY_PASSED=true');

const history=await request('/v2/order/history?order_id='+encodeURIComponent(orderId));
requireOk('SANDBOX_LIFECYCLE_HISTORY',history);
const rows=Array.isArray(history.payload?.data)?history.payload.data:[];
if(!rows.some(x=>x.order_id===orderId)){console.error('SANDBOX_LIFECYCLE_HISTORY_ORDER_NOT_FOUND');process.exit(1);}
console.log('HISTORY_PASSED=true');

const cancel=await request('/v3/order/cancel?order_id='+encodeURIComponent(orderId),{method:'DELETE'});
requireOk('SANDBOX_LIFECYCLE_CANCEL',cancel);
console.log('CANCEL_PASSED=true');

const finalHistory=await request('/v2/order/history?order_id='+encodeURIComponent(orderId));
requireOk('SANDBOX_LIFECYCLE_FINAL_HISTORY',finalHistory);
const finalRows=Array.isArray(finalHistory.payload?.data)?finalHistory.payload.data:[];
const latest=finalRows[finalRows.length-1];
if(!finalRows.some(x=>x.order_id===orderId)){console.error('SANDBOX_LIFECYCLE_FINAL_ORDER_NOT_FOUND');process.exit(1);}
console.log('FINAL_HISTORY_PASSED=true');
console.log('final_status='+(latest?.status??'UNKNOWN'));
console.log('UPSTOX_SANDBOX_LIFECYCLE_QUALIFICATION_PASSED');
console.log('PAPER_ONLY=true');
console.log('REAL_ORDER_PLACED=false');
console.log('PRODUCTION_REAL_TRADING_ENABLED=false');
