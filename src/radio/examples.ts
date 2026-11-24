import {newProject,parseProject,type Project} from '../project/model';
import {emptyCircuit,makePart,terminals,type Circuit} from '../circuit/model';
import {S3,UNO,NANO,type BoardId,type Language} from '../boards/profiles';
import {pythonNRF24,cppNRF24} from './drivers';
import {buildFile,validateArtifact} from '../../public/arduino-contract.mjs';
import {runtimeAsset} from '../platform/assets';
export type RadioTarget='micropython'|'s3-cpp'|'uno'|'nano';
export const radioTargets:Record<RadioTarget,{board:BoardId;language:Language;label:string}>={micropython:{board:S3,language:'micropython',label:'S3 · MicroPython'},'s3-cpp':{board:S3,language:'arduino-cpp',label:'S3 · Arduino C++'},uno:{board:UNO,language:'arduino-cpp',label:'Uno R3 · Arduino C++'},nano:{board:NANO,language:'arduino-cpp',label:'Nano classic · Arduino C++'}};
export function radioCircuit(board:BoardId):Circuit{
 const s3=board===S3,c=emptyCircuit(board),b=c.components[0].id;c.components[0].x=50;c.components[0].y=50;
 const r=makePart('nrf24',610,100,'radio');r.properties={moduleVoltage:s3?3.3:5,logicVoltage:s3?3.3:5};c.components.push(r);
 const connect=(a:string,pin:string,d:string,q:string,color='#087f8c')=>c.wires.push({id:'w'+c.wires.length,from:{component:a,pin},to:{component:d,pin:q},color,points:[]});
 for(const [pin,source]of [['VCC',s3?'3V3':'5V'],['GND','GND'],['SCK',s3?'GPIO12':'D13'],['MOSI',s3?'GPIO11':'D11'],['MISO',s3?'GPIO13':'D12'],['CS',s3?'GPIO10':'D10'],['CE',s3?'GPIO4':'D7']])connect(b,terminals(c.components[0]).find(t=>t.label===source)!.pin,'radio',pin,pin==='VCC'?'#d04b46':pin==='GND'?'#334155':'#087f8c');
 return c;
}
const pythonRadioSetup = `from machine import Pin, SPI
from time import sleep_ms
from lab_nrf24 import LabNRF24

# CS odabire SPI uređaj; CE bira prijam/slanje radija.
spi = SPI(
    1,
    baudrate=1000000,
    polarity=0,
    phase=0,
    sck=Pin(12),
    mosi=Pin(11),
    miso=Pin(13),
)
radio = LabNRF24(
    spi,
    Pin(10, Pin.OUT, value=1),
    Pin(4, Pin.OUT, value=0),
    channel=76,
    address=b"URS01",
)
`;

const pythonRadioPrograms = {
  tx: `# Pošalji deset numeriranih radijskih paketa. Usporedi broj svakog paketa s
# ispisom prijamnika.

# Čvor A — odašiljač. Paket ima 8 bajtova.
${pythonRadioSetup}# Pričekaj da se oba radija inicijaliziraju.
sleep_ms(20)
for number in range(1, 11):
    # Prvi bajt nosi redni broj paketa. Oba čvora moraju upotrebljavati isti
    # kanal i adresu.
    packet = bytes([number, 0, 0, 0, 0, 0, 0, 0])

    # ACK znači da je stigla potvrda prijma. MAX_RT označava da potvrda nije
    # stigla ni nakon dopuštenih ponavljanja.
    ok = radio.send(packet)
    print("TX", number, "ACK" if ok else "MAX_RT")
    sleep_ms(100)
print("Slanje dovrseno")
`,
  rx: `# Postavi radijski čvor u prijam i očitaj redni broj svakog primljenog
# paketa.

# Čvor B — prijamnik. Paket ima 8 bajtova.
${pythonRadioSetup}radio.listen()
print("RX spreman")

while True:
    # Provjeri je li stigao paket prije čitanja prvog bajta. Njegov broj
    # usporedi s brojem koji ispisuje odašiljač.
    data = radio.receive()
    if data is not None:
        print("RX", data[0])
    sleep_ms(1)
`,
};

function arduinoRadioProgram(role: 'tx' | 'rx', s3: boolean) {
  const cePin = s3 ? 4 : 7;
  const spi = s3 ? 'SPI.begin(12, 13, 11, 10); // SCK, MISO, MOSI, CS'
                 : 'SPI.begin(); // Uno/Nano: SCK=D13, MISO=D12, MOSI=D11';
  const setup = `  Serial.begin(9600);
  ${spi}
  if (!radio.begin(76, address)) {
    Serial.println("NRF24 SPI pogreska");
    while (true) {
      delay(100);
    }
  }
`;
  if (role === 'tx') return `// Pošalji deset numeriranih radijskih paketa. Usporedi broj svakog paketa s
// ispisom prijamnika.

// Čvor A — odašiljač; vidljivi SPI driver ostaje uz izvor.
#include "lab_nrf24.h"
LabNRF24 radio(10, ${cePin});
const uint8_t address[5] = {'U', 'R', 'S', '0', '1'};
uint8_t number = 1;

void setup() {
${setup}  delay(20); // drugi čvor treba pripremiti prijam
}

void loop() {
  if (number <= 10) {
    // Prvi bajt nosi redni broj paketa. Oba čvora moraju upotrebljavati
    // isti kanal i adresu.
    uint8_t packet[8] = {number, 0, 0, 0, 0, 0, 0, 0};

    // ACK znači da je stigla potvrda prijma. MAX_RT označava da potvrda
    // nije stigla ni nakon dopuštenih ponavljanja.
    bool ok = radio.send(packet);
    Serial.print("TX ");
    Serial.print(number);
    Serial.println(ok ? " ACK" : " MAX_RT");
    ++number;
  }
  delay(100);
}
`;
  return `// Postavi radijski čvor u prijam i očitaj redni broj svakog primljenog
// paketa.

// Čvor B — prijamnik; vidljivi SPI driver ostaje uz izvor.
#include "lab_nrf24.h"
LabNRF24 radio(10, ${cePin});
const uint8_t address[5] = {'U', 'R', 'S', '0', '1'};

void setup() {
${setup}  radio.listen();
  Serial.println("RX spreman");
}

void loop() {
  uint8_t data[8];

  // Provjeri je li stigao paket prije čitanja prvog bajta. Njegov broj
  // usporedi s brojem koji ispisuje odašiljač.
  if (radio.receive(data)) {
    Serial.print("RX ");
    Serial.println(data[0]);
  }
  delay(1);
}
`;
}

export function radioNodeProject(target:RadioTarget,role:'tx'|'rx'):Project{
 const t=radioTargets[target],s3=t.board===S3,py=t.language==='micropython';
 const code = py ? pythonRadioPrograms[role] : arduinoRadioProgram(role, s3);
 const p=newProject(code,'NRF24 · '+(role==='tx'?'odašiljač':'prijamnik'),t.board,t.language);p.circuit=radioCircuit(t.board);p.files[py?'lab_nrf24.py':'lab_nrf24.h']=py?pythonNRF24:cppNRF24;p.settings.example='radio-'+role;return p;
}
export async function loadRadioPair(a:RadioTarget,b:RadioTarget){
 const p=radioNodeProject(a,'tx'),peer=radioNodeProject(b,'rx');
 let artifacts:any;for(const [project,target,role]of [[p,a,'tx'],[peer,b,'rx']]as const)if(project.language==='arduino-cpp'){
  if(!artifacts){const r=await fetch(runtimeAsset('radio-examples.json'));if(!r.ok)throw Error('Ne mogu učitati prevedene radijske primjere.');artifacts=await r.json();}
  project.files[buildFile(project)]=JSON.stringify(await validateArtifact(project,artifacts[target]?.[role]));
 }
 p.title='NRF24 · dva čvora';p.schemaVersion=4;p.radio={version:1,peer};return parseProject(p);
}
