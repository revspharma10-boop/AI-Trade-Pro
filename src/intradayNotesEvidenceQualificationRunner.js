import assert from 'node:assert/strict';
import {intradayNotesEvidence} from './services/intradayNotesEvidence.js';
const bars=Array.from({length:210},(_,i)=>({open:100+i,high:102+i,low:99+i,close:101+i,volume:100+i}));
const result=intradayNotesEvidence(bars);
assert.equal(result.status,'EVIDENCE_ONLY');assert.equal(result.ema.stack,'BULLISH');
assert.equal(result.orderSubmissionAllowed,false);assert.equal(result.volume.strongBreakoutVolume,false);
assert.equal(intradayNotesEvidence([{open:1,high:0,low:1,close:1,volume:1}]).status,'WAIT');
console.log('Intraday notes evidence qualification PASS');
