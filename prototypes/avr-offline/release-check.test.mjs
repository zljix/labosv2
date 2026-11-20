import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkedPath,digest,verifyBytes,verifySources} from './release-check.mjs';

test('release inventory rejects traversal and absolute paths',()=>{
  for(const name of ['../secret','/etc/passwd','a/../../secret','a\\b','a//b','./file','']) assert.throws(()=>checkedPath('/tmp/release',name));
  assert.equal(checkedPath('/tmp/release','toolchain/cc1.js'),'/tmp/release/toolchain/cc1.js');
});
test('release verification rejects truncation and equal-length corruption',()=>{
  const bytes=Buffer.from('compiler'),record={bytes:bytes.length,sha256:digest(bytes)};
  verifyBytes(bytes,record,'compiler');
  assert.throws(()=>verifyBytes(bytes.subarray(1),record,'compiler'));
  assert.throws(()=>verifyBytes(Buffer.from('compileR'),record,'compiler'));
});
test('source mirror must match pinned inventory rather than its own manifest',()=>{
  const dir=mkdtempSync(join(tmpdir(),'labos-release-'));
  try {
    const data=Buffer.from('source');writeFileSync(join(dir,'gcc.tar.xz'),data);
    const inventory=`gcc.tar.xz https://example.org/gcc.tar.xz ${digest(data)}\n`;
    assert.equal(verifySources(dir,inventory)[0].bytes,6);
    writeFileSync(join(dir,'gcc.tar.xz'),'broken');assert.throws(()=>verifySources(dir,inventory));
    assert.throws(()=>verifySources(dir,''));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
