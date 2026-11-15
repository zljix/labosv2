import {readFileSync,writeFileSync} from 'node:fs';
import {environmentCircuit} from '../src/circuit/environmentExamples';
import {newProject} from '../src/project/model';
import {UNO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
import {validateArtifact} from '../public/avr-contract.mjs';
const p=newProject('', 'BMP280 software I2C reference',UNO);
p.circuit=environmentCircuit('bmp280',UNO);
for(const w of p.circuit.wires){if(w.from.pin==='A4')w.from.pin='D6';if(w.from.pin==='A5')w.from.pin='D7';}
const old=JSON.parse(readFileSync('verification/stage10a-fixtures.json','utf8'));
const master=old.softwareAht.project.files['main.ino'].split('void setup()')[0];
p.files['main.ino']=master+`void setup(){
 Serial.begin(9600);delay(20);bool ack=true;
 startBus();ack &= writeByte(0xec);ack &= writeByte(0xd0);
 startBus();ack &= writeByte(0xed);byte chip=readByte(false);stopBus();
 startBus();ack &= writeByte(0xec);ack &= writeByte(0x88);
 startBus();ack &= writeByte(0xed);byte b[6];for(byte i=0;i<6;i++)b[i]=readByte(i<5);stopBus();
 Serial.print(F("SOFT ACK="));Serial.println(ack);Serial.print(F("CHIP="));Serial.println(chip);
 Serial.print(F("CAL="));for(byte i=0;i<6;i++){Serial.print(b[i]);Serial.print(',');}Serial.println();
}
void loop(){delay(1000);}
`;
let previous;try{previous=JSON.parse(readFileSync('verification/stage10b-fixtures.json','utf8'));}catch{}
let artifact;try{artifact=await validateArtifact(p,previous?.softwareBmp280.artifact);}catch{artifact=await compileProject(p);}
writeFileSync('verification/stage10b-fixtures.json',JSON.stringify({softwareBmp280:{project:p,artifact}})+'\n');
console.log('Software BMP280',artifact.flashBytes,artifact.staticRamBytes);
