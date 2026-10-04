import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('hosted handler reports configuration without leaking the key',async()=>{
 const response=await worker.fetch(new Request('https://test.invalid/api/status'),{OPENAI_API_KEY:'test-secret'});
 assert.deepEqual(await response.json(),{recognitionConfigured:true});
});
test('hosted scanner denies foreign origins and clearly reports missing key',async()=>{
 assert.equal((await worker.fetch(new Request('https://test.invalid/api/recognize',{method:'POST',headers:{Origin:'https://other.invalid'},body:'{}'}),{})).status,403);
 assert.equal((await worker.fetch(new Request('https://test.invalid/api/recognize',{method:'POST',headers:{Origin:'https://test.invalid'},body:'{}'}),{})).status,503);
});
