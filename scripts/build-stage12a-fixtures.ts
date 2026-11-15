import {readFileSync,writeFileSync} from 'node:fs';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
import {validateArtifact} from '../public/avr-contract.mjs';
const project=arduinoExampleProject('dht22',UNO);project.title='DHT cache and forced transaction reference';
project.files['main.ino']=`#include <DHT.h>
DHT s(2,DHT22);
void setup(){
 Serial.begin(9600);s.begin();delay(2100);
 Serial.print(F("FIRST="));Serial.println(s.readTemperature(),1);
 delay(300);Serial.print(F("CACHED="));Serial.println(s.readTemperature(),1);
 delay(300);Serial.print(F("FORCED="));Serial.println(s.read(true));
 delay(2100);Serial.print(F("RECOVER="));Serial.println(s.readTemperature(),1);
}
void loop(){delay(1000);}
`;
let old;try{old=JSON.parse(readFileSync('verification/stage12a-fixtures.json','utf8'));}catch{}
let artifact;try{artifact=await validateArtifact(project,old?.cacheForce.artifact);}catch{artifact=await compileProject(project);}
writeFileSync('verification/stage12a-fixtures.json',JSON.stringify({cacheForce:{project,artifact}})+'\n');console.log('DHT cache/force',artifact.flashBytes,artifact.staticRamBytes);
