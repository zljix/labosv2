import {readFileSync,writeFileSync} from 'node:fs';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
import {validateArtifact} from '../public/avr-contract.mjs';
const project=arduinoExampleProject('ds18Multi',UNO);project.title='DS18B20 raw GPIO protocol reference';
project.files['main.ino']=`#include <OneWire.h>
#include <DallasTemperature.h>
OneWire ow(2);DallasTemperature ds(&ow);uint8_t rom[8];
void setup(){Serial.begin(9600);Serial.println(F("START"));
 Serial.print(F("RESET="));Serial.println(ow.reset());
 ow.write(0x33);Serial.print(F("READROM="));for(uint8_t i=0;i<8;i++){Serial.print(ow.read(),HEX);Serial.print(' ');}Serial.println();
 ow.reset_search();uint8_t n=0;while(ow.search(rom)){n++;Serial.print(F("ROM="));for(uint8_t i=0;i<8;i++){Serial.print(rom[i],HEX);Serial.print(' ');}Serial.print(F(" CRC="));Serial.println(ow.crc8(rom,8));}Serial.print(F("COUNT="));Serial.println(n);
 ds.begin();Serial.print(F("DALLAS="));Serial.println(ds.getDeviceCount());
 ds.requestTemperatures();Serial.println(F("CONVERTED"));
 for(uint8_t i=0;i<ds.getDeviceCount();i++){Serial.print(F("T="));Serial.println(ds.getTempCByIndex(i),4);}
 Serial.println(F("DONE"));}
void loop(){delay(1000);}
`;
let old;try{old=JSON.parse(readFileSync('verification/stage12b-fixtures.json','utf8'));}catch{}
let artifact;try{artifact=await validateArtifact(project,old?.protocol.artifact);}catch{artifact=await compileProject(project);}
writeFileSync('verification/stage12b-fixtures.json',JSON.stringify({protocol:{project,artifact}})+'\n');console.log('DS18B20 protocol',artifact.flashBytes,artifact.staticRamBytes);
