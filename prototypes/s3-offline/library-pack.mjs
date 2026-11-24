import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runLLVM} from './node_modules/@yowasp/clang/gen/bundle.js';
import {S3_LIBRARY_NAMES} from '../../public/s3-contract.mjs';
import {AVR_LIBRARIES} from '../../public/avr-contract.mjs';
import {fileTree,compileUnit} from './clang.mjs';

const hash = input => createHash('sha256').update(input).digest('hex');
export async function packLibraries(out, coreHeaders) {
  const root = '../../vendor/arduino/';
  const lock = JSON.parse(await readFile(root+'lock.json'));
  const libs = {};
  for (const name of S3_LIBRARY_NAMES) {
    const {files,version,digest} = lock[name];
    const contract = AVR_LIBRARIES.find(lib=>lib.name===name);
    if (contract.version!==version || contract.digest!==digest || hash(JSON.stringify(files))!==digest)
      throw Error('Neispravan manifest biblioteke ' + name);
    const modern = Object.keys(files).some(path=>path.startsWith('src/'));
    const flat = {};
    for (const [path,expected] of Object.entries(files)) {
      const bytes = await readFile(root + name + '/' + path);
      if (hash(bytes)!==expected) throw Error('Neispravan sadržaj: '+name+'/'+path);
      if (modern && !path.startsWith('src/')) continue;
      if (/\.(c|cpp|h|hpp|inc|inl|tpp)$/.test(path)) flat[modern?path.slice(4):path]=bytes.toString('utf8');
    }
    libs[name]={flat,digest};
  }
  const assets=[];
  for (const [name,{flat,digest}] of Object.entries(libs)) {
    const files={include:coreHeaders,lib:fileTree(flat)};
    const includes=['-Iinclude','-Ilib'];
    if (name==='DallasTemperature') {
      files.dependency=fileTree(libs.OneWire.flat);
      includes.push('-Idependency');
    }
    const objects={};
    for (const path of Object.keys(flat).filter(p=>/\.(cpp|c)$/.test(p))) {
      objects['unit'+Object.keys(objects).length+'.o']=await compileUnit('lib/'+path,files,includes);
    }
    const archive='library.a';
    const result=await runLLVM(['ar','rcsD',archive,...Object.keys(objects)],objects);
    const headers=Object.fromEntries(Object.entries(flat).filter(([p])=>! /\.(c|cpp)$/.test(p)));
    const path='lib-'+name+'.json';
    await writeFile(out+'/'+path, JSON.stringify({digest,headers,archive:Buffer.from(result[archive]).toString('base64')}));
    assets.push(path);
    console.log('Pripremljena biblioteka',name);
  }
  return assets;
}
