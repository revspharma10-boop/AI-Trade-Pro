import assert from 'node:assert/strict';
import {describeIndexOptionGates,GATE_SAFETY} from './services/optionResearchGates.js';
const ist=s=>Date.parse('2026-10-09T'+s+'+05:30');
const after={asOf:ist('09:44:00'),underlyingResearch:{valid:false,completedBars:5}};
const missing=describeIndexOptionGates({...after,underlyingResearch:{valid:false,completedBars:0},
 dataErrors:['UPSTOX_INTRADAY_DATA_EMPTY']});
assert.equal(missing.mainBlocker,'UPSTOX_INTRADAY_DATA_EMPTY');
assert.equal(missing.gates[0].status,'MISSING');
assert.equal(missing.gates[1].status,'BLOCKED');
assert.equal(missing.gates[2].status,'NOT_READY');
assert.equal(missing.gates[3].status,'NOT_CHECKED');
assert.equal(missing.gates[4].status,'NOT_VERIFIED');
assert.equal(describeIndexOptionGates({asOf:ist('09:15:38'),underlyingResearch:{valid:false,completedBars:0}}).gates[1].status,'COLLECTING');
const early={valid:true,openingOHLC:{open:25000,high:25100,low:24900,close:25080},direction:'CE'};
const open=describeIndexOptionGates({...after,openingRange:early});
assert.equal(open.earlyDirection,'CE');
assert.equal(open.selectedDirection,'CE');
assert.equal(open.gates[1].status,'EARLY_BIAS');
assert.equal(open.gates[2].status,'NOT_READY');
assert.equal(open.gates[3].status,'NOT_CHECKED');
assert.equal(open.gates[4].status,'NOT_VERIFIED');
const flat=describeIndexOptionGates({...after,openingRange:{...early,direction:'WAIT'}});
assert.equal(flat.mainBlocker,'NO_CLEAR_OPENING_DIRECTION');
const qualified=describeIndexOptionGates({asOf:ist('12:15:00'),
 underlyingResearch:{valid:true,completedBars:36},openingRange:early,
 signal:{direction:'CE'},contract:{tradingSymbol:'NIFTY26XXXX22500CE',instrumentType:'CE',
 strike:22500,expiry:'2026-10-15'},plan:{status:'UNVALIDATED_PAPER_LEVELS',
 entry:100,stopLoss:90,target1:115,target2:120,target3:130}});
assert.equal(qualified.gates[2].status,'PASS');
assert.equal(qualified.gates[3].status,'VERIFIED');
assert.equal(qualified.gates[4].status,'PAPER_LEVELS');
assert.equal(qualified.orderSubmissionAllowed,false);
assert.equal(GATE_SAFETY.realOrderPlaced,false);
console.log('OPTION SIGNAL GATE DIAGNOSTICS PASSED: missing candles, early WAIT/CE, full bars, contracts, premium, zero orders');
