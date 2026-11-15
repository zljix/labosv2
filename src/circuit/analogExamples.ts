import {emptyCircuit,makePart,terminals,type Circuit,type Kind} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type AnalogExample='lm35'|'temt6000'|'ntc'|'ky023'|'flame'|'sound'|'analogCompare'|'dualInputs';
export function analogCircuit(key:AnalogExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=110;
 const pin=(n:number)=>avr?'A'+(n-1):terminals(b).find(t=>t.gpio===n)!.pin;
 const connect=(id:string,signal:string,to:string)=>c.wires.push({id:'ai'+c.wires.length,from:{component:b.id,pin:to},to:{component:id,pin:signal},color:signal==='GND'?'#334155':signal==='VCC'?'#d04b46':'#087f8c',points:[]});
 const supply=(kind:Kind)=>kind==='lm35'?avr?'5V':'J1.21':avr?'5V':'J1.1';
 const gnd=avr?'GND':'J1.22',digital=avr?'D2':terminals(b).find(t=>t.gpio===5)!.pin;
 if(key==='dualInputs'){
  for(let i=0;i<2;i++){
   const p=makePart('potentiometer',650+i*240,80,'pot'+(i+1)),sw=makePart('button',650+i*240,380,'sw'+(i+1));p.properties.resistance=1000;p.properties.position=i?75:25;c.components.push(p,sw);
   connect(p.id,'1',supply('potentiometer'));connect(p.id,'3',gnd);connect(p.id,'2',pin(i+1));connect(sw.id,'A1',avr?'D'+(i+2):terminals(b).find(t=>t.gpio===i+5)!.pin);connect(sw.id,'B1',gnd);
  }return c;
 }
 const kinds:Kind[]=key==='analogCompare'?['lm35','ntc']:[key];
 for(const [i,kind]of kinds.entries()){
  const p=makePart(kind,avr?650+i*290:420+i*290,100,kind+'1');if(avr&&kind!=='lm35')p.properties.moduleVoltage=5;c.components.push(p);connect(p.id,'VCC',supply(kind));connect(p.id,'GND',gnd);
  if(kind==='ky023'){connect(p.id,'VRX',pin(1));connect(p.id,'VRY',pin(2));connect(p.id,'SW',digital);}
  else {if(kind!=='sound')connect(p.id,kind==='lm35'?'OUT':'AO',pin(i+1));if(kind==='flame'||kind==='sound')connect(p.id,'DO',digital);}
 }return c;
}
const pyHead=`from machine import Pin, ADC
from time import sleep_ms
# Funkcionalni S3 profil: 12 bita, ATTN_11DB zasicuje na 3,1 V.
# read_uv() je idealizirana pretvorba modela; fizicki ESP32 zahtijeva kalibraciju.
a = ADC(Pin(1), atten=ADC.ATTN_11DB)
`;
const cppHead=`// Uno/Nano: AVCC=5,0 V, DEFAULT referenca, 10-bitni ADC.
// Stvarni napon reference na fizickoj plocici treba izmjeriti.
void setup() { Serial.begin(9600); }
`;
const hints={
 lm35:'LM35: VCC=5 V na svim pločicama, GND, OUT=GPIO1 / A0. 10 mV/°C: T = U / 0,010. Osnovni spoj 2–150 °C; za 25 °C izlaz je 0,25 V. Promijeni temperaturu i usporedi sirovi ADC i izračun.',
 temt6000:'TEMT6000: nominalni profil 0,5 µA/lx i 10 kΩ. VCC=3V3 na S3 ili 5 V na Uno/Nano; AO=GPIO1/A0. Primjer ispisuje sirovi ADC i napon, bez pretvaranja u lukse. Velika pobuda može zasititi senzor ili ADC. Fizički modul traži kalibraciju.',
 ntc:'NTC djelilo: VCC → 10 kΩ → AO → NTC → GND. R25=10 kΩ, Beta=3950 K; formule i parametri moraju odgovarati svojstvima. AO=GPIO1/A0. Porast temperature smanjuje otpor i napon. Ako promijeniš svojstva, promijeni i programske konstante.',
 ky023:'KY-023: VRX=GPIO1/A0, VRY=GPIO2/A1, SW=GPIO5/D2 uz pull-up. VCC=3,3 V na S3 ili 5 V na Arduinu, zajednička masa. X i Y su neovisni, središte je 50 %, mrtva zona ±10 % određena je u programu. S3 zasićuje gornji dio hoda iznad 3,1 V.',
 flame:'Lab profil plamena: VCC=3,3 V / 5 V, AO=GPIO1/A0, DO=GPIO5/D2. Relativna IR pobuda (nije udaljenost ili temperatura). AO pada s pobudom; DO aktivan LOW uz prag 50 % i histerezu ±2 %. Nije identifikacija svake fizičke izvedbe modula.',
 sound:'Lab senzor zvuka s tri izvoda: VCC=3,3 V / 5 V, GND i DO=GPIO5/D2. Nema analognog priključka. Relativna sintetska pobuda iznad praga+2 % daje LOW; ispod praga−2 % HIGH. Nema dB ni pristupa mikrofonu. Fizički modul zahtijeva potvrdu izvedbe.',
 analogCompare:'Dva različita principa: LM35 daje 10 mV/°C, NTC mijenja otpor djelila. LM35 OUT=GPIO1/A0, NTC AO=GPIO2/A1. LM35 uvijek napajaj s 5 V, NTC s 3,3 V na S3 ili 5 V na Arduinu. Oba okoliša postavi na 25, zatim 50 °C; program ne čita klizač izravno.',
 dualInputs:'Dva neovisna potenciometra 1 kΩ: klizači na GPIO1/2 ili A0/A1, krajevi na odgovarajuće napajanje i GND. Dva tipkala na GPIO5/6 ili D2/D3 koriste pull-up; pritisak daje LOW. Sva četiri ulaza mogu se mijenjati tijekom rada.',
};
const pyNtc=`def ntc(uv, supply=3300000):
    if uv <= 0 or uv >= supply:
        raise ValueError("NTC: naponska granica; provjeri spoj")
    r = 10000 * uv / (supply - uv)
    return 1 / (1 / 298.15 + log(r / 10000) / 3950) - 273.15
`;
const cppNtc=`float ntc(int n) {
  if (n <= 0 || n >= 1023) return NAN;
  float r = 10000.0f * n / (1023 - n);
  return 1.0f / (1.0f/298.15f + log(r/10000.0f)/3950.0f) - 273.15f;
}
`;
const specs={
 lm35:{title:'LM35 · napon u temperaturu',py:pyHead+`while True:
    raw = a.read()
    t = a.read_uv() / 10000
    print("LM35 ADC=%d T=%.2f" % (raw, t))
    sleep_ms(300)
`,cpp:cppHead+`void loop() {
  int n = analogRead(A0);
  float t = n * 5.0f / 1023 / 0.010f;
  Serial.print(F("LM35 ADC=")); Serial.print(n); Serial.print(F(" T=")); Serial.println(t,2);
  delay(300);
}
`},
 temt6000:{title:'TEMT6000 · sirovi ADC i napon',py:pyHead+`while True:
    print("TEMT6000 ADC=%d U=%.3f V" % (a.read(), a.read_uv()/1000000))
    sleep_ms(300)
`,cpp:cppHead+`void loop() {
  int n=analogRead(A0);
  Serial.print(F("TEMT6000 ADC=")); Serial.print(n); Serial.print(F(" U=")); Serial.println(n*5.0f/1023,3);
  delay(300);
}
`},
 ntc:{title:'NTC · otpor, Beta i temperatura',py:`from math import log
`+pyHead+pyNtc+`while True:
    print("NTC ADC=%d T=%.2f" % (a.read(), ntc(a.read_uv())))
    sleep_ms(300)
`,cpp:`#include <math.h>
`+cppHead+cppNtc+`void loop() {
  int n=analogRead(A0);
  Serial.print(F("NTC ADC=")); Serial.print(n); Serial.print(F(" T=")); Serial.println(ntc(n),2);
  delay(300);
}
`},
 ky023:{title:'KY-023 · osi, mrtva zona i SW',py:pyHead+`b = ADC(Pin(2), atten=ADC.ATTN_11DB)
sw = Pin(5, Pin.IN, Pin.PULL_UP)
def axis(uv):
    value = 2 * uv / 3300000 - 1
    return 0 if abs(value) < 0.10 else value
while True:
    print("X=%d Y=%d NX=%.2f NY=%.2f SW=%d" % (a.read(), b.read(), axis(a.read_uv()), axis(b.read_uv()), sw.value()))
    sleep_ms(300)
`,cpp:`void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); }
float axis(int n) { float v=2.0f*n/1023-1; return fabs(v)<0.10f ? 0 : v; }
void loop() {
  int x=analogRead(A0), y=analogRead(A1);
  Serial.print(F("X=")); Serial.print(x); Serial.print(F(" Y=")); Serial.print(y);
  Serial.print(F(" NX=")); Serial.print(axis(x),2); Serial.print(F(" NY=")); Serial.print(axis(y),2);
  Serial.print(F(" SW=")); Serial.println(digitalRead(2)); delay(300);
}
`},
 flame:{title:'Plamen · AO, prag i aktivan LOW',py:pyHead+`do = Pin(5, Pin.IN)
while True:
    print("FLAME ADC=%d DO=%d" % (a.read(), do.value()))
    sleep_ms(300)
`,cpp:`void setup() { Serial.begin(9600); pinMode(2,INPUT); }
void loop() {
  Serial.print(F("FLAME ADC=")); Serial.print(analogRead(A0)); Serial.print(F(" DO=")); Serial.println(digitalRead(2));
  delay(300);
}
`},
 sound:{title:'Zvuk · digitalni tropriključni profil',py:`from machine import Pin
from time import sleep_ms
s = Pin(5, Pin.IN)
while True:
    print("SOUND DO=%d" % s.value())
    sleep_ms(300)
`,cpp:`void setup() { Serial.begin(9600); pinMode(2,INPUT); }
void loop() {
  Serial.print(F("SOUND DO=")); Serial.println(digitalRead(2)); delay(300);
}
`},
 analogCompare:{title:'LM35 i NTC · usporedba mjerenja',py:`from math import log
`+pyHead+pyNtc+`b = ADC(Pin(2), atten=ADC.ATTN_11DB)
while True:
    print("COMPARE LM35=%.2f NTC=%.2f" % (a.read_uv()/10000, ntc(b.read_uv())))
    sleep_ms(300)
`,cpp:`#include <math.h>
`+cppHead+cppNtc+`void loop() {
  float t=analogRead(A0)*5.0f/1023/0.010f;
  Serial.print(F("COMPARE LM35=")); Serial.print(t,2); Serial.print(F(" NTC=")); Serial.println(ntc(analogRead(A1)),2);
  delay(300);
}
`},
 dualInputs:{title:'Dva potenciometra i dva tipkala',py:pyHead+`b = ADC(Pin(2), atten=ADC.ATTN_11DB)
s1 = Pin(5, Pin.IN, Pin.PULL_UP)
s2 = Pin(6, Pin.IN, Pin.PULL_UP)
while True:
    print("DUAL A=%d B=%d S1=%d S2=%d" % (a.read(), b.read(), s1.value(), s2.value()))
    sleep_ms(300)
`,cpp:`void setup() { Serial.begin(9600); pinMode(2,INPUT_PULLUP); pinMode(3,INPUT_PULLUP); }
void loop() {
  Serial.print(F("DUAL A=")); Serial.print(analogRead(A0)); Serial.print(F(" B=")); Serial.print(analogRead(A1));
  Serial.print(F(" S1=")); Serial.print(digitalRead(2)); Serial.print(F(" S2=")); Serial.println(digitalRead(3)); delay(300);
}
`},
};
export const analogExamples=Object.fromEntries(Object.entries(specs).map(([key,s])=>[key,{title:s.title,hint:hints[key as AnalogExample],code:s.py}])) as Record<AnalogExample,{title:string;hint:string;code:string}>;
export const arduinoAnalogExamples=Object.fromEntries(Object.entries(specs).map(([key,s])=>[key,{title:'Arduino · '+s.title,hint:hints[key as AnalogExample],code:s.cpp}])) as Record<AnalogExample,{title:string;hint:string;code:string}>;
