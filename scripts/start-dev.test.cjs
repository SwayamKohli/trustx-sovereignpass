const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {decision,occupied}=require('./start-dev.cjs');
test('startup reuses only a complete healthy stack and never kills conflicting ports',()=>{
  assert.equal(decision([{busy:false},{busy:false},{busy:false}],false,false),'start');
  assert.equal(decision([{busy:true},{busy:true},{busy:true}],true,true),'reuse');
  assert.equal(decision([{busy:true},{busy:true},{busy:true}],false,true),'conflict');
  assert.equal(decision([{busy:true},{busy:false},{busy:false}],true,true),'conflict');
});
test('port detection observes an actual local listener',async()=>{
  const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try{assert.equal(await occupied(port),true);}finally{await new Promise(resolve=>server.close(resolve));}
  assert.equal(await occupied(port),false);
});
