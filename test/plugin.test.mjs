import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolDefinitions,apply} from '../src/index.mjs';
const signal=new AbortController().signal;
test('registers six native tools and forwards state/action to one core seam',async()=>{
  const calls=[];const defs=toolDefinitions(async()=>({state:async o=>{calls.push(['state',o.signal]);return{state_id:'s',missing:undefined};},act:async(...a)=>{calls.push(['act',...a]);return{ok:true};}}));
  assert.equal(defs.length,6);
  assert.deepEqual(await defs.find(d=>d.name==='spire_state').execute({}, {signal}),{state_id:'s'});
  await defs.find(d=>d.name==='spire_act').execute({state_id:'s',option_id:'2'}, {signal});
  assert.equal(calls[0][1],signal);assert.deepEqual(calls[1].slice(0,3),['act','s','2']);
});
test('cancellation blocks controller construction and game dispatch',async()=>{
  let built=false;const a=new AbortController();a.abort(Error('cancelled'));
  const tool=toolDefinitions(async()=>{built=true;return{};})[0];
  await assert.rejects(tool.execute({}, {signal:a.signal}),/cancelled/);assert.equal(built,false);
});
test('plugin load registers tools without connecting to game or resolving secrets',()=>{
  const names=[];apply({tools:{register:d=>names.push(d.name)},get:()=>undefined},{});
  assert.ok(names.includes('spire_plan'));assert.ok(names.includes('spire_battle'));
});
test('missing selected credential cannot fall back to a different default account',async()=>{
  const old=process.env.TYPESAFE_API_KEY,oldFetch=globalThis.fetch;let fetched=false;const tools=[];
  process.env.TYPESAFE_API_KEY='test-default-must-not-be-used';
  globalThis.fetch=async()=>{fetched=true;throw Error('network must not be reached');};
  try{
    apply({tools:{register:t=>tools.push(t)},get:n=>n==='credentials'?{resolve:async()=>undefined}:undefined},{apiKeyEnv:'MISSING_SPIRE_TEST_KEY'});
    await assert.rejects(tools.find(t=>t.name==='spire_battle').execute({max_steps:1},{signal}),/Missing credential reference/);
    assert.equal(fetched,false);
  }finally{globalThis.fetch=oldFetch;if(old===undefined)delete process.env.TYPESAFE_API_KEY;else process.env.TYPESAFE_API_KEY=old;}
});
