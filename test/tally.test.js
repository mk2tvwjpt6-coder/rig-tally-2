import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,joints,unusual} from '../public/tally.js';
import {recognize,reconcile,validatePass,vision} from '../recognition.js';
import {server} from '../server.js';
const entry=(position,length,confidence=.95)=>({position,length,confidence,bbox:[.1,.1,.3,.2],note:''});
const pass=(entries)=>({quality:{readable:true,warnings:[]},entries});
test('stands preserve measured length and count two actual joints',()=>{
 const t=summarize([{length:62.11,mode:'stands'},{length:31.20,mode:'singles'}],[],10);
 assert.equal(t.feet,93.31);assert.equal(t.joints,3);assert.equal(t.rows[0].last,11);assert.equal(t.rows[1].first,12);
 assert.equal(joints(40.07),2);assert.equal(joints(40),1);assert.equal(joints(71,'singles'),1);
});
test('split tubing changes at actual joint 151 and rejects straddling stand',()=>{
 const sections=[{size:'2-3/8',count:150},{size:'2-7/8',count:100}];
 assert.equal(summarize([{length:62,mode:'stands'},{length:31,mode:'singles'}],sections,149).rows[1].size,'2-7/8');
 assert.throws(()=>summarize([{length:62,mode:'stands'}],sections,150),/crosses/);
});
test('decimal sums are deterministic, unusual values are flags',()=>{
 assert.equal(summarize([{length:31.11},{length:30.09}]).feet,61.2);
 assert.equal(unusual(24.02,'singles'),true);assert.equal(unusual(62,'stands'),false);
 assert.equal(summarize([{length:24.02,mode:'singles'}]).feet,24.02);
});
test('missing, unreadable, disagreement and low confidence remain flagged',()=>{
 const rows=reconcile(pass([entry(1,31.2),entry(2,null),entry(3,30)]),pass([entry(1,31.2),entry(2,31),entry(4,30)]));
 assert.deepEqual(rows.map(e=>e.needsReview),[false,true,true,true]);
 assert.equal(reconcile(pass([entry(1,30,.5)]),pass([entry(1,30)]))[0].needsReview,true);
});
test('third pass never automatically approves disagreement',async()=>{
 let i=0;const result=await recognize('photo',async()=>[pass([entry(1,31.2)]),pass([entry(1,31.7)]),pass([entry(1,31.2)])][i++]);
 assert.equal(i,3);assert.equal(result.entries[0].needsReview,true);assert.deepEqual(result.entries[0].alternatives,[31.2,31.7,31.2]);
});
test('third pass failure permits manual review, poor photo rejects',async()=>{
 let i=0;const result=await recognize('photo',async()=>{if(i++===2)throw Error('timeout');return pass([entry(1,31,i===1?.5:.95)]);});
 assert.equal(result.entries[0].needsReview,true);assert.equal(result.passes,2);
 await assert.rejects(recognize('photo',async()=>({quality:{readable:false,warnings:[]},entries:[]})),/not readable/);
});
test('invalid provider output rejects duplicates, bad bounds and negative lengths',()=>{
 assert.throws(()=>validatePass(pass([entry(1,31),entry(1,30)])));
 assert.throws(()=>validatePass(pass([{...entry(1,31),bbox:[0,0,2,1]}])));
 assert.throws(()=>validatePass(pass([entry(1,-10)])));
});
test('actual provider request includes image and strict schema; refusal is not data',async()=>{
 const result=await vision('data:image/jpeg;base64,AAAA','test',async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.input[0].content[1].image_url,'data:image/jpeg;base64,AAAA');assert.equal(body.text.format.strict,true);assert.equal(body.store,false);
  return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(pass([entry(1,31.2)]))}]}]})};
 });assert.equal(result.entries[0].length,31.2);
 await assert.rejects(vision('photo','test',async()=>({ok:true,json:async()=>({status:'incomplete',output:[]})})),/did not complete/);
});
test('HTTP status, assets and missing-key handling',async()=>{
 const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(base)).status,200);assert.equal((await (await fetch(base+'/api/status')).json()).recognitionConfigured,false);
 assert.equal((await fetch(base+'/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 assert.equal((await fetch(base+'/recognition.js')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));if(old)process.env.OPENAI_API_KEY=old;}
});
