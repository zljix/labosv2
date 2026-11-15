import {readFileSync,writeFileSync} from 'node:fs';
import {newProject} from '../src/project/model';
import {displayCircuit} from '../src/circuit/displayExamples';
import {UNO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
import {validateArtifact} from '../public/avr-contract.mjs';
const p=newProject('','LCD software I2C reference',UNO);p.circuit=displayCircuit('lcd1602',UNO);
for(const w of p.circuit.wires){if(w.from.pin==='A4')w.from.pin='D6';if(w.from.pin==='A5')w.from.pin='D7';}
const old=JSON.parse(readFileSync('verification/stage10a-fixtures.json','utf8'));
p.files['main.ino']=old.softwareAht.project.files['main.ino'].split('void setup()')[0]+`
bool ack=true;
void port(byte v){startBus();ack &= writeByte(0x4e);ack &= writeByte(v);stopBus();}
void nibble(byte n,byte rs=0){byte v=(n<<4)|8|rs;port(v);port(v|4);port(v);}
void lcdByte(byte v,byte rs=0){nibble(v>>4,rs);nibble(v&15,rs);delayMicroseconds(50);if(!rs&&v<4)delay(2);}
byte readNibble(){port(0xfb);port(0xff);startBus();ack &= writeByte(0x4f);byte v=readByte(false);stopBus();port(0xfb);return v>>4;}
void setup(){
 Serial.begin(9600);delay(50);port(8);delay(1);
 nibble(3);delay(5);nibble(3);delay(1);nibble(3);delay(1);nibble(2);delay(1);
 lcdByte(0x28);lcdByte(0x0c);lcdByte(6);lcdByte(1);
 const char* s="SW LCD";while(*s)lcdByte(*s++,1);
 lcdByte(0x80);byte high=readNibble(),low=readNibble();
 Serial.print(F("SOFT_LCD ACK="));Serial.print(ack);Serial.print(F(" READ="));Serial.println((high<<4)|low);
}
void loop(){delay(1000);}
`;
let previous;try{previous=JSON.parse(readFileSync('verification/stage10c-fixtures.json','utf8'));}catch{}
let artifact;try{artifact=await validateArtifact(p,previous?.softwareLcd.artifact);}catch{artifact=await compileProject(p);}
writeFileSync('verification/stage10c-fixtures.json',JSON.stringify({softwareLcd:{project:p,artifact}})+'\n');
console.log('Software LCD',artifact.flashBytes,artifact.staticRamBytes);
