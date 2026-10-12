import assert from 'node:assert/strict';
import {verifiedIndexQuote} from './indexLiveQuote.js';
const now=Date.parse('2026-10-12T04:00:00Z');
for(const [tab,key] of [['nifty','NSE_INDEX|Nifty 50'],['sensex','BSE_INDEX|SENSEX']]){
 const instrument={instrumentKey:key};
 const quote={instrumentKey:key,mode:'READ_ONLY',lastPrice:tab==='nifty'?25000:82000,timestamp:now-1000};
 const valid=verifiedIndexQuote({tab,instrument,quote,asOf:now});
 assert.equal(valid.state,'LIVE_PRICE');assert.equal(valid.orderSubmissionAllowed,false);
 assert.equal(verifiedIndexQuote({tab,instrument,quote:{...quote,timestamp:now-120000},asOf:now}).state,'WAIT');
 assert.equal(verifiedIndexQuote({tab,instrument,quote:{...quote,lastPrice:NaN},asOf:now}).state,'WAIT');
 assert.equal(verifiedIndexQuote({tab,instrument,quote:{...quote,instrumentKey:'WRONG'},asOf:now}).state,'WAIT');
 assert.equal(verifiedIndexQuote({tab,instrument,quote:{...quote,timestamp:now+20000},asOf:now}).state,'WAIT');
}
console.log('NIFTY/SENSEX INDEX QUOTE QUALIFICATION PASSED');
