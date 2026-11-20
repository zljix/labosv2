import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIsolation} from './network-proof.mjs';
const proof={namespace:'net:[2]',onlineNamespace:'net:[1]',links:[{ifname:'lo',flags:['LOOPBACK']}]};
test('isolated namespace with loopback down is accepted',()=>assert.equal(validateIsolation(proof),true));
test('same namespace, active loopback, or external interfaces cannot pass as isolated',()=>{
  for(const override of [{namespace:'net:[1]'},{links:[{ifname:'lo',flags:['UP','LOOPBACK']}]},{links:[...proof.links,{ifname:'eth0',flags:['UP']}]},{links:[]},{namespace:'unverified'}])assert.throws(()=>validateIsolation({...proof,...override}));
});
