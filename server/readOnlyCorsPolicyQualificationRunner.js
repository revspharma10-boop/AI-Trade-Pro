import assert from 'node:assert/strict';
import {READ_ONLY_CLIENT_ORIGINS,allowedReadOnlyClientOrigin,readOnlyCorsHeaders} from './readOnlyCorsPolicy.js';
import {readFileSync} from 'node:fs';
const approved=['https://revspharma10-boop.github.io','https://localhost'];
assert.deepEqual(READ_ONLY_CLIENT_ORIGINS,approved);
for(const origin of approved){
 assert.equal(allowedReadOnlyClientOrigin(origin),origin);
 assert.deepEqual(readOnlyCorsHeaders(origin),{'Access-Control-Allow-Origin':origin,'Vary':'Origin'});
}
for(const origin of [null,undefined,'','null','http://localhost','http://127.0.0.1','https://localhost.evil.example',
 'https://evil.example','https://revspharma10-boop.github.io.evil.example','https://revspharma10-boop.github.io/']){
 assert.equal(allowedReadOnlyClientOrigin(origin),null);
 assert.deepEqual(readOnlyCorsHeaders(origin),{'Vary':'Origin'});
}
assert.ok(!Object.values(readOnlyCorsHeaders('https://localhost')).includes('*'),'No wildcard CORS');
assert.equal('Access-Control-Allow-Credentials' in readOnlyCorsHeaders('https://localhost'),false);
const source=readFileSync(new URL('./upstoxOAuthCallbackServer.js',import.meta.url),'utf8');
assert.match(source,/readOnlyCorsHeaders\(res\.req\?\.headers\?\.origin\)/);
assert.match(source,/orderSubmissionAllowed: false/);
assert.doesNotMatch(source,/\/v2\/order\/place|\/v3\/order\/place/);
console.log('ANDROID READ-ONLY CORS QUALIFICATION PASSED: exact origins only, no wildcard, no cookies, 0 live orders');
