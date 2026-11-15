import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type OpticalExample='opticalRegisters'|'opticalRaw'|'opticalFrequency'|'opticalOverflow';
export function opticalCircuit(_key:OpticalExample='opticalRaw',board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;
 b.x=40;b.y=70;const d=makePart('max30102',avr?650:410,160,'optical1');d.properties.moduleVoltage=avr?5:3.3;c.components.push(d);
 const pin=(n:number)=>terminals(b).find(t=>t.gpio===n)!.pin,rail=(r:string)=>terminals(b).find(t=>t.role===r)!.pin;
 for(const [from,to,color]of [[rail(avr?'5v':'3v3'),'VCC','#d04b46'],[rail('ground'),'GND','#334155'],[pin(avr?18:8),'SDA','#087f8c'],[pin(avr?19:9),'SCL','#3867d6']])c.wires.push({id:'optw'+c.wires.length,from:{component:b.id,pin:from},to:{component:d.id,pin:to},color,points:[]});
 return c;
}
const intro='MAX30102 čita crveni (RED) i infracrveni (IR) optički kanal preko I2C adrese 0x57. S3: SDA8/SCL9, VCC=3V3. Uno/Nano: SDA=A4/SCL=A5, VCC=5V uz izričiti carrier s regulatorom i obostranom prilagodbom. Svi trebaju GND i pull-up. Profil ima četiri izvoda i koristi polling (program provjerava status); fizički INT nije uključen. FIFO je red od 32 uzorka: najstariji izlazi prvi. Jedan kanal zauzima tri bajta, RED+IR šest. To su ADC brojevi, bez fizičke jedinice. ';
const policy=' Signal je sintetski: zadana frekvencija nije zdravstveno mjerenje. Nema izračuna SpO2. Živi ulazi mijenjaju sljedeće uzorke; već zapisani FIFO ostaje nepromijenjen. Mjerenja prikazuju samo uzorke koje je program dovršeno pročitao. Stop zadržava do 128 očitanja za CSV; Run/Reset počinju novi FIFO i zapis. Spremljeni projekt čuva početne parametre i program, a ne FIFO. ';
const pyStart=`from machine import Pin, I2C
from time import sleep_ms
from lab_max30102 import MAX30102
bus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
senzor = MAX30102(bus)
`;
export const opticalExamples={
 opticalRegisters:{title:'MAX30102 · 1. registri i identitet',hint:intro+'Registar je bajt postavki ili stanja na određenoj adresi. Program čita PART_ID=0x15, resetira senzor i postavlja RED+IR, 100 sirovih uzoraka/s i 18 bita. Naziv moda SpO2 u datasheetu uključuje dva kanala; sam mod ne računa zasićenost kisikom. Zatim uključuje shutdown i provjerava da nema novih uzoraka.'+policy,code:pyStart+`print("MAX ID=0x%02X" % senzor.reg(0xff))
senzor.configure()
print("MAX MODE=%d CONFIG=0x%02X" % (senzor.reg(9), senzor.reg(10)))
senzor.shutdown(True)
senzor.clear_fifo()
sleep_ms(500)
print("MAX SHUTDOWN FIFO=%d" % senzor.available())
`},
 opticalRaw:{title:'MAX30102 · 2. sirovi RED/IR uzorci',hint:intro+'Pokazivači WR i RD kruže od 0 do 31. FIFO_DATA 0x07 ne povećava I2C adresu tijekom čitanja. Driver čita svih šest bajtova jednog uzorka u jednom prijenosu i sastavlja 18-bitne brojeve. Program ispisuje svaki deseti uzorak. Promijeni amplitudu ili isključi optički kontakt pa usporedi RED/IR. Uzorkovanje je 100 Hz, a ispis oko 10 Hz.'+policy,code:pyStart+`senzor.configure()
n = 0
while True:
    if senzor.overflow():
        print("MAX GAP: izgubljeni uzorci")
        senzor.clear_fifo()
    uzorak = senzor.read_sample()
    if uzorak is not None:
        n += 1
        if n % 10 == 0:
            print("RAW N=%d RED=%d IR=%d" % (n, uzorak[0], uzorak[1]))
    sleep_ms(2)
`},
 opticalFrequency:{title:'MAX30102 · 3. frekvencija iz uzoraka',hint:intro+'Program uklanja sporu srednju vrijednost IR signala, prati amplitudu i traži rastući prijelaz s histerezom. Razmak prijelaza u broju uzoraka dijeli sa 100 uzoraka/s, zatim računa 60/period. Nakon oko dvije sekunde zagrijavanja i dvaju prijelaza ispisuje procjenu. Prag, šum, kontakt i gubitak uzoraka utječu na rezultat. Ovo je nastavni detektor periodičkog signala, nije medicinski algoritam. Mijenjaj zadanu frekvenciju 40–180/min i pričekaj nekoliko ciklusa.'+policy,code:pyStart+`senzor.configure()
n = 0
zadnji = 0
baza = 0.0
omotnica = 0.0
spreman = False
while True:
    if senzor.overflow():
        print("MAX GAP: procjena se resetira")
        senzor.clear_fifo()
        n, zadnji, baza, omotnica, spreman = 0, 0, 0.0, 0.0, False
    uzorak = senzor.read_sample()
    if uzorak is not None:
        ir = uzorak[1]
        n += 1
        if n == 1:
            baza = ir
        baza += 0.02 * (ir - baza)
        ac = ir - baza
        omotnica += 0.02 * (abs(ac) - omotnica)
        if n < 200 or ir < 5000 or omotnica < 200:
            zadnji, spreman = 0, False
        else:
            if ac < -0.5 * omotnica:
                spreman = True
            if spreman and ac > 0.5 * omotnica:
                if zadnji and 30 <= n - zadnji <= 200:
                    print("FREQ=%.2f bpm (sintetski)" % (6000.0 / (n - zadnji)))
                zadnji, spreman = n, False
    sleep_ms(2)
`},
 opticalOverflow:{title:'MAX30102 · 4. pun FIFO i gubitak uzoraka',hint:intro+'Pri 100 uzoraka/s FIFO se napuni za približno 0,32 s. Program namjerno čeka 700 ms bez čitanja: novih 32 uzorka ne može primiti, a overflow broji odbačene do 31. Jednaki WR/RD mogu značiti prazan ili pun FIFO, pa driver čita i A_FULL/overflow. Čitanje prvog bajta uzorka pomiče RD i briše overflow. Potom FIFO prazni i nastavlja. Povećaj usrednjavanje s 1 na 4: izlazna brzina pada na 25 uzoraka/s i treba 1,28 s da se FIFO napuni.'+policy,code:pyStart+`senzor.configure(average=1)
while True:
    sleep_ms(700)  # namjerno presporo citanje
    izgubljeno = senzor.overflow()
    broj = senzor.available()
    print("FIFO COUNT=%d OVF=%d" % (broj, izgubljeno))
    for _ in range(broj):
        uzorak = senzor.read_sample()
    senzor.clear_fifo()
    print("FIFO RECOVERED")
`},
} as const;
const cppStart=`#include "lab_max30102.h"

LabMAX30102 senzor;

void fatal() {
  Serial.println(F("MAX ERROR: provjeri spoj, profil i adresu"));
  while (true) delay(100);
}

void setup() {
  Serial.begin(9600);
  // Uno/Nano: SDA=A4, SCL=A5. S3 primjer navodi GPIO8/9.
  Wire.begin();
  Wire.setClock(100000);
  if (!senzor.begin() || !senzor.configure()) fatal();
}
`;
export const arduinoOpticalExamples={
 opticalRegisters:{title:'Arduino · '+opticalExamples.opticalRegisters.title,hint:opticalExamples.opticalRegisters.hint,code:cppStart+`
bool done = false;
void loop() {
  if (done) { delay(100); return; }
  done = true;
  uint8_t id, mode, config;
  if (!senzor.get(0xff, &id) || !senzor.get(9, &mode) || !senzor.get(10, &config)) fatal();
  Serial.print(F("MAX ID=0x")); Serial.println(id, HEX);
  Serial.print(F("MAX MODE=")); Serial.print(mode);
  Serial.print(F(" CONFIG=0x")); Serial.println(config, HEX);
  // Shutdown zaustavlja nove uzorke; postojeci FIFO praznimo zasebno.
  if (!senzor.shutdown(true) || !senzor.clearFIFO()) fatal();
  delay(500);
  Serial.print(F("MAX SHUTDOWN FIFO=")); Serial.println(senzor.available());
}
`},
 opticalRaw:{title:'Arduino · '+opticalExamples.opticalRaw.title,hint:opticalExamples.opticalRaw.hint,code:cppStart+`
uint32_t n = 0;
void loop() {
  int lost = senzor.overflow();
  if (lost < 0) fatal();
  if (lost) {
    Serial.println(F("MAX GAP: izgubljeni uzorci"));
    if (!senzor.clearFIFO()) fatal();
  }
  uint32_t red, ir;
  int result = senzor.read(red, ir);  // 1=uzorak, 0=prazno, -1=pogreska
  if (result < 0) fatal();
  // Ispisujemo svaki deseti uzorak kako ispis ne bi usporio citanje.
  if (result && ++n % 10 == 0) {
    Serial.print(F("RAW N=")); Serial.print(n);
    Serial.print(F(" RED=")); Serial.print(red);
    Serial.print(F(" IR=")); Serial.println(ir);
  }
  delay(2);
}
`},
 opticalFrequency:{title:'Arduino · '+opticalExamples.opticalFrequency.title,hint:opticalExamples.opticalFrequency.hint,code:cppStart+`
uint32_t n = 0, zadnji = 0;
float baza = 0, omotnica = 0;
bool spreman = false;

void loop() {
  int lost = senzor.overflow();
  if (lost < 0) fatal();
  if (lost) {
    Serial.println(F("MAX GAP: procjena se resetira"));
    if (!senzor.clearFIFO()) fatal();
    n = zadnji = 0;
    baza = omotnica = 0;
    spreman = false;
  }
  uint32_t red, ir;
  int result = senzor.read(red, ir);
  if (result < 0) fatal();
  if (result) {
    ++n;
    if (n == 1) baza = ir;
    // Spora srednja vrijednost odvaja DC razinu od promjenjivog dijela.
    baza += .02f * (ir - baza);
    float ac = ir - baza;
    omotnica += .02f * (abs(ac) - omotnica);
    if (n < 200 || ir < 5000 || omotnica < 200) {
      zadnji = 0;
      spreman = false;
    } else {
      // Dva odvojena praga stvaraju histerezu i oznacavaju rastuci prijelaz.
      if (ac < -.5f * omotnica) spreman = true;
      if (spreman && ac > .5f * omotnica) {
        if (zadnji && n - zadnji >= 30 && n - zadnji <= 200) {
          // 100 uzoraka/s: frekvencija/min = 60 * 100 / razmak uzoraka.
          Serial.print(F("FREQ=")); Serial.print(6000.f / (n - zadnji), 2);
          Serial.println(F(" bpm (sintetski)"));
        }
        zadnji = n;
        spreman = false;
      }
    }
  }
  delay(2);
}
`},
 opticalOverflow:{title:'Arduino · '+opticalExamples.opticalOverflow.title,hint:opticalExamples.opticalOverflow.hint,code:cppStart+`
void loop() {
  delay(700);  // Namjerno presporo: FIFO od 32 mjesta staje pri 100 uzoraka/s.
  int lost = senzor.overflow(), n = senzor.available();
  if (lost < 0 || n < 0) fatal();
  Serial.print(F("FIFO COUNT=")); Serial.print(n);
  Serial.print(F(" OVF=")); Serial.println(lost);
  for (int i = 0; i < n; i++) {
    uint32_t red, ir;
    if (senzor.read(red, ir) < 0) fatal();
  }
  if (!senzor.clearFIFO()) fatal();
  Serial.println(F("FIFO RECOVERED"));
}
`},
} as const;
export const s3OpticalExamples=Object.fromEntries(Object.entries(arduinoOpticalExamples).map(([key,e])=>[key,{...e,title:e.title.replace('Arduino ·','S3 C++ ·'),code:e.code.replace('Wire.begin();','Wire.begin(8,9,100000);')}])) as Record<OpticalExample,{title:string;hint:string;code:string}>;
