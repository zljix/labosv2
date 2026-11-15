import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type DHTExample='dht11'|'dht22'|'dhtCompare'|'dhtErrors';
export function dhtCircuit(key:DHTExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=110;
 const boardPin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 for(const [i,kind]of (key==='dhtCompare'?['dht11','dht22']: [key==='dht11'?'dht11':'dht22']).entries()){
  const p=makePart(kind as 'dht11'|'dht22',avr?640+i*350:440+i*350,170,'dht'+(i+1));p.properties.moduleVoltage=avr?5:3.3;c.components.push(p);
  const r=makePart('resistor',p.x-10,70,'pull'+i);r.properties.resistance=4700;c.components.push(r);
  const connect=(a:string,pin:string,to:string,q:string,color:string)=>c.wires.push({id:'dhw'+c.wires.length,from:{component:a,pin},to:{component:to,pin:q},color,points:[]});
  const supply=terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin,ground=terminals(b).find(t=>t.role==='ground')!.pin;
  connect(b.id,supply,p.id,'VCC','#d04b46');connect(b.id,ground,p.id,'GND','#334155');connect(b.id,boardPin(avr?2+i:4+i),p.id,'DATA',i?'#8b52ba':'#087f8c');
  connect(r.id,'1',p.id,'VCC','#d04b46');connect(r.id,'2',p.id,'DATA','#d59218');
 }
 return c;
}
const shared='DHT koristi DATA impulse, ne I2C ni Dallas 1-Wire. VCC/DATA/NC/GND: NC ostaje slobodan; dodaj vanjski 4,7 kΩ DATA–VCC. Prvo čekanje stabilizacije, zatim start i 40 bitova. Driver provjerava kontrolni zbroj. Pogreška ne znači 0 °C.';
const pySingle=(kind:'dht11'|'dht22',errors=false)=>`from machine import Pin
from time import sleep_ms
from dht import ${kind.toUpperCase()}

# ESP32: VCC=3V3, GND, DATA=GPIO4. NC ostaje slobodan.
# Vanjski 4,7 kOhm: DATA na VCC. Ne spajaj pull-up na 5 V.
senzor = ${kind.toUpperCase()}(Pin(4))
sleep_ms(${kind==='dht11'?1100:2100})  # stabilizacija nakon ukljucivanja
while True:
    try:
        senzor.measure()  # prenese bitove pa provjeri peti bajt
        print("${kind.toUpperCase()} T=%.1f C RH=%.1f %%" % (senzor.temperature(), senzor.humidity()))
    except Exception as greska:
        # Ne ispisuj prethodnu temperaturu kao da je novo valjano mjerenje.
        print("DHT: nevaljano ocitanje:", greska)
    sleep_ms(${errors?300:kind==='dht11'?1100:2100})
`;
export const dhtExamples={
 dht11:{title:'DHT11 · start i kontrolni zbroj',hint:shared+' Stariji Aosong profil 0–50 °C / 20–90 %RH, cijeli brojevi, razmak ≥1 s. Druge fizičke izvedbe mogu zahtijevati >2 s i ≥3,5 V. DATA=GPIO4.',code:pySingle('dht11')},
 dht22:{title:'DHT22 · desetinke i negativna temperatura',hint:shared+' Profil −40–80 °C / 0–100 %RH, desetinke, predznak temperature i razmak ≥2 s. DATA=GPIO4. Pokušaj −12,3 °C i 67,8 %RH.',code:pySingle('dht22')},
 dhtErrors:{title:'DHT22 · prečesto očitanje i pogreške',hint:shared+' Program pokušava svakih 300 ms: većina prijenosa nema odgovor. Nakon razmaka ≥2 s senzor ponovno odgovara. U Živim ulazima isprobaj pogrešan zbroj ili timeout, zatim vrati uredan prijenos.',code:pySingle('dht22',true)},
 dhtCompare:{title:'DHT11 i DHT22 · usporedba protokola',hint:shared+' DHT11 DATA=GPIO4, DHT22 DATA=GPIO5; svaki ima svoj pull-up. Isti okoliš 25 °C / 50 % daje različite bajtove. DHT11 zaokružuje na cijele brojeve, DHT22 prenosi desetinke.',code:`from machine import Pin
from time import sleep_ms
from dht import DHT11, DHT22

# Svaki DHT ima svoj GPIO: DHT nema ROM adrese.
senzori = (("DHT11", DHT11(Pin(4))), ("DHT22", DHT22(Pin(5))))
sleep_ms(2100)
while True:
    for naziv, senzor in senzori:
        try:
            senzor.measure()
            print("%s T=%.1f C RH=%.1f %% bajtovi=%s" % (naziv, senzor.temperature(), senzor.humidity(), list(senzor.buf)))
        except Exception as greska:
            print(naziv, "nevaljano:", greska)
    sleep_ms(2100)
`},
};
const cppSingle=(kind:'dht11'|'dht22',errors=false)=>`#include <DHT.h>
// DHT 1.4.6 cita GPIO impulse i provjerava kontrolni zbroj.
// VCC=5 V, GND, DATA=D2; vanjski 4,7 kOhm DATA-5 V. NC slobodan.
DHT senzor(2, ${kind.toUpperCase()});
void setup() {
  Serial.begin(9600); senzor.begin();
  delay(${kind==='dht11'?1100:2100}); // stabilizacija
}
void loop() {
  // force=${errors?'true: fizicki novi pokus svakih 300 ms':'false: biblioteka cuva rezultat unutar 2 s'}
  float vlaga = senzor.readHumidity(${errors?'true':'false'});
  float temperatura = senzor.readTemperature(); // isti provjereni uzorak
  if (isnan(vlaga) || isnan(temperatura)) Serial.println(F("DHT: nevaljano ocitanje"));
  else {
    Serial.print(F("${kind.toUpperCase()} T=")); Serial.print(temperatura, 1);
    Serial.print(F(" C RH=")); Serial.println(vlaga, 1);
  }
  delay(${errors?300:2100});
}
`;
export const arduinoDHTExamples={
 dht11:{title:'Arduino · '+dhtExamples.dht11.title,hint:dhtExamples.dht11.hint.replace('DATA=GPIO4.','')+' Arduino: DATA=D2, VCC/pull-up=5 V. Adafruit DHT 1.4.6 ima 2 s predmemorije i za DHT11; primjer zato čita svakih 2,1 s.',code:cppSingle('dht11')},
 dht22:{title:'Arduino · '+dhtExamples.dht22.title,hint:dhtExamples.dht22.hint.replace('DATA=GPIO4.','')+' Arduino: DATA=D2, VCC/pull-up=5 V. Program se stvarno prevodi i mjeri impulse AVR ciklusima.',code:cppSingle('dht22')},
 dhtErrors:{title:'Arduino · '+dhtExamples.dhtErrors.title,hint:dhtExamples.dhtErrors.hint+' Arduino: DATA=D2 i 5 V. readHumidity(true) namjerno zaobilazi predmemoriju biblioteke; nedopušteno često očitanje daje NaN.',code:cppSingle('dht22',true)},
 dhtCompare:{title:'Arduino · DHT11 i DHT22',hint:shared+' Arduino: DHT11 DATA=D2, DHT22 DATA=D3, oba VCC/pull-up=5 V. Usporedi cijele brojeve s desetinkama. Svaki ima svoj fizički prijenos i driver.',code:`#include <DHT.h>
DHT stariji(2,DHT11), precizniji(3,DHT22);
void setup() { Serial.begin(9600); stariji.begin(); precizniji.begin(); delay(2100); }
void ispisi(const __FlashStringHelper* naziv,DHT& senzor) {
  float h=senzor.readHumidity(),t=senzor.readTemperature();
  Serial.print(naziv);
  if(isnan(h)||isnan(t)) Serial.println(F(" nevaljano"));
  else { Serial.print(F(" T=")); Serial.print(t,1); Serial.print(F(" RH=")); Serial.println(h,1); }
}
void loop() { ispisi(F("DHT11"),stariji); ispisi(F("DHT22"),precizniji); delay(2100); }
`},
} as const;
