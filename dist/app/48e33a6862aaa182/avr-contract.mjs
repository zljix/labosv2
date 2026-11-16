// MIT. Shared by the browser and the local Arduino CLI development bridge.
export const AVR_BUILD_FILE = 'avr-build.json';
export const AVR_LIBRARY_FILE = 'arduino-libraries.json';
export const AVR_LIBRARIES = Object.freeze([{"name":"Bounce2","version":"2.72","digest":"0b087545118fe6e07d2abd26071ecfb0e2a91edb6064ac659cf8d3ce7d4c8f01","header":"Bounce2.h","description":"Filtriranje promjena tipkala; GPIO i millis()."},{"name":"LabAHT10","version":"1.0.0","digest":"5e70d85bd5f32a4b5f6bdc05e5062b7d9a4f5b74bf8ca9d6dc943db634627d6d","header":"LabAHT10.h","description":"AHT10 preko stvarnog Wire protokola; zasebna sabirnica."},{"name":"U8g2","version":"2.37.1","digest":"5f8b4535f5c7837f82569ede8d7381b614ba80455982c59e4ca4e7fc17d43e0b","header":"U8g2lib.h","description":"SSD1306 128×64, HW/SW I2C, stranice; priložen font 6×10."},{"name":"Servo","version":"1.2.2","digest":"6e5e44591f1790f0d1196f83d4a2537fbbe8b782bba249a55b6d2db251c43aa4","header":"Servo.h","description":"AVR Timer1 impulsi; zauzima PWM D9/D10."},{"name":"LabI2CSensors","version":"1.0.0","digest":"2e40e9a6f13867627ca9e451460107fd6cec8fbe533c447fe850b83f853af266","header":"LabI2CSensors.h","description":"BMP180/BMP280 registri i kalibracija; AM2320 buđenje i CRC16."},{"name":"U8g2_12832","version":"2.37.1","digest":"4ab66ed86f578895534ddb16bccd02fb848dc56c2a1a338422d9b14ec5db3e2c","header":"U8g2lib.h","description":"U8g2 2.37.1: zaseban paket s OLED 128×32 UNIVISION; odaberi umjesto U8g2. Font 6×10, stranice 128 B."},{"name":"LabLCD1602","version":"1.0.0","digest":"8f751ab9da944db90f2ac6b3690ee3d304128cf6e922e6d2e0510d0c04b90195","header":"LabLCD1602.h","description":"HD44780 16×2 / PCF8574, potvrđeno P0–P7 mapiranje, 100 kHz; ASCII i CGRAM."},{"name":"DHT","version":"1.4.6","digest":"f61633314452c3e38de431b91a15c26bf7d9051a1cf9bcd0593ee410081f3d36","header":"DHT.h","description":"Adafruit DHT 1.4.6, DHT11/DHT22; GPIO impulsi i kontrolni zbroj. Bez Unified Sensor API-ja."},{"name":"OneWire","version":"2.3.8","digest":"d53be1dcf8b7e07f5b0d3120509ee5808d241bfd8cd2edcb4d22c70fa61611d0","header":"OneWire.h","description":"Standardni 1-Wire GPIO slotovi, ROM pretraga i CRC-8. DS18B20 na D2."},{"name":"DallasTemperature","version":"4.0.6","digest":"bcdf73e9dbd7dda3ad3e91c2340b335cbf6ccea6c1cab53f10c7fea675d75323","header":"DallasTemperature.h","description":"DS18B20: temperatura, 9–12 bita, čekanje i CRC. Odaberi i OneWire 2.3.8."}]);
export function selectedLibraries(p) {
  const raw=p?.files?.[AVR_LIBRARY_FILE];
  if(raw===undefined)return [];
  let value;try{value=JSON.parse(raw);}catch{throw Error('Neispravan arduino-libraries.json. Odaberi biblioteke kroz Prevedi.');}
  if(value?.format!=='esp32-lab-arduino-libraries'||value.version!==1||!Array.isArray(value.libraries)||value.libraries.length>AVR_LIBRARIES.length)throw Error('Nepodržan popis Arduino biblioteka.');
  if(value.libraries.some(x=>x.name==='U8g2')&&value.libraries.some(x=>x.name==='U8g2_12832'))throw Error('Odaberi U8g2 ili U8g2_12832, jedan paket grafičke biblioteke.');
  if(value.libraries.some(x=>x.name==='DallasTemperature')&&!value.libraries.some(x=>x.name==='OneWire'))throw Error('DallasTemperature zahtijeva odabranu biblioteku OneWire 2.3.8.');
  const names=new Set();
  return value.libraries.map(item=>{
    const known=AVR_LIBRARIES.find(x=>x.name===item?.name&&x.version===item.version);
    if(!known||names.has(known.name))throw Error('Nepodržana inačica ili ponovljena Arduino biblioteka.');
    names.add(known.name);return {name:known.name,version:known.version,digest:known.digest};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
export function libraryManifest(libraries) {
  const raw=JSON.stringify({format:'esp32-lab-arduino-libraries',version:1,libraries});
  selectedLibraries({files:{[AVR_LIBRARY_FILE]:raw}});return raw;
}
export function validArduinoPath(path) {
  return (/^[A-Za-z_][A-Za-z0-9_-]*\.(ino|c|cpp|h|hpp)$/.test(path)||/^src\/(?:[A-Za-z_][A-Za-z0-9_-]*\/)*[A-Za-z_][A-Za-z0-9_-]*\.(c|cpp|h|hpp)$/.test(path))&&path.toLowerCase()!=='labsketch.ino';
}
export const AVR_TOOLCHAIN = Object.freeze({cli:'1.3.1',core:'arduino:avr@1.8.6',gcc:'7.3.0-atmel3.6.1-arduino7',libraries:[]});
export const AVR_TARGETS = Object.freeze({
  'arduino.uno-r3.atmega328p':{fqbn:'arduino:avr:uno',profile:'0.1.0',flash:32256,adc:6},
  'arduino.nano-classic.atmega328p':{fqbn:'arduino:avr:nano:cpu=atmega328',profile:'0.1.0',flash:30720,adc:8},
});
export async function sha256(text) {
  const bytes=typeof text==='string'?new TextEncoder().encode(text):text;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function buildInput(p) {
  const target=AVR_TARGETS[p?.board?.id];
  if(!target||p.language!=='arduino-cpp'||p.entryFile!=='main.ino'||p.board.profileVersion!==target.profile||p.target?.fqbn!==target.fqbn)throw Error('Nepodržan Arduino cilj ili profil projekta.');
  const files={};let size=0;
  for(const path of Object.keys(p.files??{}).sort()) {
    if(!/\.(ino|c|cpp|h|hpp)$/.test(path))continue;
    if(!validArduinoPath(path))throw Error('Arduino izvor mora biti u korijenu ili src/: '+path);
    if(path.includes('/')&&path.endsWith('.ino'))throw Error('.ino datoteke trebaju biti u korijenu projekta.');
    if(path.toLowerCase()==='labsketch.ino')throw Error('LabSketch.ino je rezervirano ime izvoza; koristi main.ino.');
    if(typeof p.files[path]!=='string')throw Error('Izvorna datoteka mora biti tekst.');
    size+=new TextEncoder().encode(p.files[path]).length;
    if(size>1048576||Object.keys(files).length>=64)throw Error('Arduino izvor prelazi dopuštenu veličinu.');
    files[path]=p.files[path];
  }
  if(typeof files['main.ino']!=='string')throw Error('Nedostaje main.ino.');
  if(new Set(Object.keys(files).map(p=>p.toLowerCase())).size!==Object.keys(files).length)throw Error('Dvostruka Arduino putanja.');
  const libraries=selectedLibraries(p),toolchain=libraries.length?{...AVR_TOOLCHAIN,libraries}:AVR_TOOLCHAIN;
  return {format:'esp32-lab-avr-input',version:1,boardId:p.board.id,boardProfile:p.board.profileVersion,fqbn:target.fqbn,entryFile:p.entryFile,toolchain,files};
}
export const inputHash=p=>sha256(JSON.stringify(buildInput(p)));

/** Strict Intel HEX, checksums, ranges, overlap and mandatory EOF. No bootloader. */
export function parseHex(hex,limit=32768) {
  if(typeof hex!=='string'||hex.length>100000)throw Error('HEX je prevelik ili neispravan.');
  const bytes=new Uint8Array(32768),used=new Set();let base=0,eof=false,extent=0;
  for(const raw of hex.trim().split(/\r?\n/)) {
    if(eof)throw Error('Podaci nakon kraja HEX datoteke.');
    if(!/^:(?:[0-9a-fA-F]{2})+$/.test(raw))throw Error('Neispravan HEX zapis.');
    const row=Uint8Array.from(raw.slice(1).match(/../g).map(n=>parseInt(n,16))),len=row[0],address=(row[1]<<8)|row[2],type=row[3];
    if(row.length!==len+5||row.reduce((s,n)=>s+n,0)%256)throw Error('Neispravan kontrolni zbroj HEX zapisa.');
    if(type===0){for(let i=0;i<len;i++){const at=base+address+i;if(at>=limit||used.has(at))throw Error('HEX prelazi Flash cilja ili preklapa zapise.');bytes[at]=row[i+4];used.add(at);extent=Math.max(extent,at+1);}}
    else if(type===1&&len===0&&address===0)eof=true;
    else if((type===2||type===4)&&len===2&&address===0)base=((row[4]<<8)|row[5])*(type===2?16:65536);
    else throw Error('Nepodržan HEX zapis.');
  }
  if(!eof||!extent||!used.has(0)||extent%2)throw Error('HEX nema valjan početak, kraj ili parni AVR program.');
  return {bytes,extent,count:used.size};
}
export async function validateArtifact(project,value) {
  if(!value||value.format!=='esp32-lab-avr-build'||value.version!==1)throw Error('Odaberi AVR .json rezultat razvojnog mosta.');
  const input=buildInput(project),target=AVR_TARGETS[input.boardId];
  if(value.boardId!==input.boardId||value.fqbn!==input.fqbn||value.boardProfile!==input.boardProfile||JSON.stringify(value.toolchain)!==JSON.stringify(input.toolchain))throw Error('Prevedeni program pripada drugoj pločici, bibliotekama ili alatnom lancu.');
  if(value.inputHash!==await inputHash(project))throw Error('Izvor je promijenjen. Ponovno prevedi ovaj projekt; stari program nije pokrenut.');
  if(value.hexHash!==await sha256(value.hex))throw Error('Prevedeni HEX je izmijenjen ili oštećen.');
  const loaded=parseHex(value.hex,target.flash);
  if(value.flashBytes!==loaded.extent||!Number.isSafeInteger(value.staticRamBytes)||value.staticRamBytes<0||value.staticRamBytes>2048)throw Error('Neispravni podaci o Flash/SRAM memoriji.');
  return value;
}
