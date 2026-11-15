import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type OneWireExample='ds18b20'|'ds18Multi'|'ds18Resolution'|'ds18Errors';
export const oneWireDriverNames=['_onewire.py','onewire.py','ds18x20.py'] as const;
export function oneWireCircuit(key:OneWireExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=130;
 const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 const supply=terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin,ground=terminals(b).find(t=>t.role==='ground')!.pin;
 const connect=(a:string,pin:string,to:string,q:string,color:string)=>c.wires.push({id:'ow'+c.wires.length,from:{component:a,pin},to:{component:to,pin:q},color,points:[]});
 for(let i=0;i<(key==='ds18Multi'?3:1);i++){
  const p=makePart('ds18b20',(avr?580:410)+i*255,180,'ds'+(i+1));p.label='DS18B20 '+(i+1);p.properties.moduleVoltage=avr?5:3.3;p.properties.temperature=[25,-10.125,60][i];c.components.push(p);
  connect(b.id,supply,p.id,'VDD','#d04b46');connect(b.id,ground,p.id,'GND','#334155');
  if(i)connect('ds1','DQ',p.id,'DQ','#087f8c');else connect(b.id,pin(avr?2:4),p.id,'DQ','#087f8c');
 }
 const r=makePart('resistor',avr?590:420,65,'owPull');r.properties.resistance=4700;c.components.push(r);connect(r.id,'1','ds1','VDD','#d04b46');connect(r.id,'2','ds1','DQ','#d59218');return c;
}
const intro='DS18B20 TO-92: ravna prednja strana, izvodi prema dolje GND–DQ–VDD. ESP32: VDD/pull-up=3,3 V, DQ=GPIO4; Arduino: 5 V, DQ=D2. Jedan vanjski 4,7 kΩ DQ–VDD po sabirnici. ROM je 64-bitni identitet s CRC-8; više senzora smije dijeliti DQ. Vanjsko napajanje; parazitsko nije podržano.';
const prelude=`from machine import Pin
from time import sleep_ms
from onewire import OneWire
from ds18x20 import DS18X20

# VDD=3V3, GND, DQ=GPIO4; vanjski 4,7 kOhm DQ-3V3.
bus = OneWire(Pin(4))
senzor = DS18X20(bus)
def pronadji():
    # ROM takodjer sadrzi CRC, ne samo scratchpad s temperaturom.
    return [r for r in senzor.scan() if bus.crc8(r) == 0]
def identitet(rom):
    return ''.join('%02X' % b for b in rom)
`;
const readLoop=`while True:
    try:
        romovi = pronadji()
        if not romovi:
            print("DS18B20: nema valjanog ROM-a / presence; provjeri spoj")
        else:
            senzor.convert_temp()  # Skip ROM + Convert T za cijelu sabirnicu
            sleep_ms(750)  # do 750 ms pri 12 bita; ranije je stari registar
            for rom in romovi:
                try:
                    t = senzor.read_temp(rom)  # Match ROM, 9 bajtova i CRC
                    print("ROM=%s T=%.4f C" % (identitet(rom), t))
                except Exception as greska:
                    print("ROM=%s nevaljano:" % identitet(rom), greska)
    except Exception as greska:
        print("DS18B20: pogreska sabirnice", greska)
    sleep_ms(1000)
`;
export const oneWireExamples={
 ds18b20:{title:'DS18B20 · ROM, pretvorba i CRC',hint:intro+' Najprije pokreni pretvorbu, pričekaj i pročitaj scratchpad (9 bajtova). Početnih +85 °C nije novo mjerenje. CRC ne potvrđuje svježinu podatka.',code:prelude+readLoop},
 ds18Multi:{title:'DS18B20 · tri senzora na jednom DQ',hint:intro+' Početni okoliši: 25, −10,125 i 60 °C. Search ROM nalazi tri identiteta; Match ROM bira jedan scratchpad. Ne oslanjaj se na redoslijed rezultata pretrage.',code:prelude+readLoop},
 ds18Resolution:{title:'DS18B20 · razlučivost 9–12 bita',hint:intro+' Write Scratchpad postavlja 9/10/11/12 bita: korak 0,5/0,25/0,125/0,0625 °C i najdulje čekanje 93,75/187,5/375/750 ms. Postavka razlučivosti mijenja se programom. Ovo nije točnost senzora.',code:prelude+`while True:
    try:
        romovi = pronadji()
        if not romovi:
            raise Exception("nema senzora")
        rom = romovi[0]
        for bita, cekanje in ((9, 94), (10, 188), (11, 375), (12, 750)):
            prethodno = senzor.read_scratch(rom)
            senzor.write_scratch(rom, bytes((prethodno[2], prethodno[3], ((bita-9)<<5)|0x1F)))
            senzor.convert_temp()
            sleep_ms(cekanje)
            print("BITA=%d T=%.4f C" % (bita, senzor.read_temp(rom)))
    except Exception as greska:
        print("DS18B20: nevaljano", greska)
    sleep_ms(1200)
`},
 ds18Errors:{title:'DS18B20 · 85 °C, prerano čitanje i CRC',hint:intro+' Primjer prvo izričito pokazuje početni registar +85 °C, zatim stari registar tijekom nove pretvorbe i svježi rezultat nakon čekanja. U Živim ulazima uključi pogrešan CRC ili odspojen DQ. Pogreška se ne prikazuje kao 0 °C.',code:prelude+`romovi = pronadji()
if romovi:
    print("POCETNI REGISTAR (nije novo mjerenje):", senzor.read_temp(romovi[0]))
while True:
    try:
        romovi = pronadji()
        if not romovi:
            raise Exception("nema presence / ROM")
        senzor.convert_temp()
        print("PRIJE DOVRSETKA (stari registar):", senzor.read_temp(romovi[0]))
        sleep_ms(750)
        print("NAKON CEKANJA T=%.4f C" % senzor.read_temp(romovi[0]))
    except Exception as greska:
        print("DS18B20: nevaljano", greska)
    sleep_ms(1500)
`},
};
const cppPrelude=`#include <OneWire.h>
#include <DallasTemperature.h>
// VDD=5 V, GND, DQ=D2; jedan vanjski 4,7 kOhm DQ-5 V.
OneWire bus(2);
DallasTemperature senzori(&bus);
DeviceAddress rom;
void setup() { Serial.begin(9600); senzori.begin(); }
void identitet(const uint8_t* r) {
  for(uint8_t i=0;i<8;i++) { if(r[i]<16)Serial.print('0'); Serial.print(r[i],HEX); }
}
void ispisi(const uint8_t* r) {
  float t=senzori.getTempC(r); // driver cita scratchpad i provjerava CRC
  bool sirovi=false;
  // DallasTemperature 4.0.6 odbacuje -55 C i pocetni uzorak +85 C/0C.
  // Za te dvije vrijednosti izricito ponovno procitaj i provjeri bajtove.
  // Valjan CRC ne dokazuje da je pretvorba dovrsena: postuj cekanje u loop().
  if(t==DEVICE_DISCONNECTED_C) {
    uint8_t b[9];
    if(senzori.readScratchPad(r,b) && OneWire::crc8(b,8)==b[8]) {
      int16_t raw=(int16_t)(((uint16_t)b[1]<<8)|b[0]);
      if(raw==-880 || raw==1360) {t=raw/16.0; sirovi=true;}
    }
  }
  Serial.print(F("ROM=")); identitet(r);
  if(t==DEVICE_DISCONNECTED_C)Serial.println(F(" nevaljano / CRC ili odspojen"));
  else {Serial.print(F(" T="));Serial.print(t,4);Serial.println(sirovi?F(" C (sirovi registar; provjeri cekanje)"):F(" C"));}
}
`;
const cppLoop=`void loop() {
  senzori.begin(); // ponovna pretraga omogucuje oporavak nakon odspajanja
  uint8_t broj=senzori.getDeviceCount();
  if(!broj)Serial.println(F("DS18B20: nema valjanog ROM-a / presence"));
  else {
    senzori.setWaitForConversion(true); // biblioteka ceka ili ispituje busy bit
    senzori.requestTemperatures();
    for(uint8_t i=0;i<broj;i++)if(senzori.getAddress(rom,i))ispisi(rom);
  }
  delay(1000);
}
`;
export const arduinoOneWireExamples={
 ds18b20:{title:'Arduino · '+oneWireExamples.ds18b20.title,hint:oneWireExamples.ds18b20.hint,code:cppPrelude+cppLoop},
 ds18Multi:{title:'Arduino · '+oneWireExamples.ds18Multi.title,hint:oneWireExamples.ds18Multi.hint,code:cppPrelude+cppLoop},
 ds18Resolution:{title:'Arduino · '+oneWireExamples.ds18Resolution.title,hint:oneWireExamples.ds18Resolution.hint,code:cppPrelude+`void loop() {
  senzori.begin();
  if(!senzori.getAddress(rom,0))Serial.println(F("DS18B20: nema senzora"));
  else for(uint8_t bita=9;bita<=12;bita++) {
    senzori.setResolution(rom,bita);
    senzori.requestTemperatures();
    Serial.print(F("BITA="));Serial.println(bita);ispisi(rom);
  }
  delay(1200);
}
`},
 ds18Errors:{title:'Arduino · '+oneWireExamples.ds18Errors.title,hint:oneWireExamples.ds18Errors.hint,code:cppPrelude+`void loop() {
  senzori.begin();
  if(!senzori.getAddress(rom,0))Serial.println(F("DS18B20: nema presence / ROM"));
  else {
    Serial.print(F("STARI REGISTAR (na pocetku 85 C): "));ispisi(rom);
    senzori.setWaitForConversion(false);senzori.requestTemperatures();
    Serial.print(F("PRIJE DOVRSETKA: "));ispisi(rom);
    delay(750);
    Serial.print(F("NAKON CEKANJA: "));ispisi(rom);
  }
  delay(1500);
}
`},
} as const;
