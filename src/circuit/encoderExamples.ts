import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';

export type EncoderExample='encoderRaw'|'ky040'|'encoderBounce'|'encoderPWM';
export function encoderCircuit(key:EncoderExample,board:BoardId=S3):Circuit {
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=120;
 const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 const p=makePart('ky040',avr?620:430,180,'enc1');p.label='KY-040 1';p.properties.moduleVoltage=avr?5:3.3;
 p.properties.encoderBounce=key==='encoderBounce';if(key==='encoderRaw')p.properties.encoderEdgeMs=100;c.components.push(p);
 const connect=(a:string,pin:string,to:string,q:string,color:string)=>c.wires.push({id:'encw'+c.wires.length,from:{component:a,pin},to:{component:to,pin:q},color,points:[]});
 for(const [contact,gpio]of [['CLK',avr?2:4],['DT',avr?3:5],['SW',avr?4:6]]as const)connect(b.id,pin(gpio),p.id,contact,'#087f8c');
 connect(b.id,terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin,p.id,'VCC','#d04b46');
 const ground=terminals(b).find(t=>t.role==='ground')!.pin;connect(b.id,ground,p.id,'GND','#334155');
 if(key==='encoderPWM'){
  const r=makePart('resistor',avr?950:770,420,'encR'),led=makePart('led',avr?1150:970,420,'encLED');r.properties.resistance=680;c.components.push(r,led);
  connect(b.id,pin(avr?9:7),r.id,'1','#d59218');connect(r.id,'2',led.id,'A','#d59218');connect(led.id,'K',b.id,ground,'#334155');
 }
 return c;
}
const intro='KY-040: VCC=3,3 V za ESP32 / 5 V za Uno/Nano, zajednički GND. CLK/DT/SW=GPIO4/5/6 na ESP32 ili D2/D3/D4 na Arduinu. CLK i DT imaju pull-up 10 kΩ; SW traži programski pull-up. CW slijed CLK,DT je 11→01→00→10→11: četiri brida daju jedan zadržni korak. Brojač počinje od 0, ne otkriva početni fizički kut.';
const pyInit=`from machine import Pin
from time import sleep_ms
from lab_encoder import Encoder

# Signali su ulazi: CLK=A, DT=B, tipkalo SW je aktivno LOW.
enkoder = Encoder(Pin(4, Pin.IN), Pin(5, Pin.IN), Pin(6, Pin.IN, Pin.PULL_UP))
`;
const pyCounter=pyInit+`print("ENC READY P=0; CW=+1 CCW=-1; SW resetira brojac")
while True:
    korak, pritisak = enkoder.update()
    if pritisak:
        enkoder.reset()
        print("ENC RESET P=0")
    elif korak:
        print("ENC P=%d DIR=%s ERR=%d" % (enkoder.position, "CW" if korak > 0 else "CCW", enkoder.errors))
    # Polling mora biti brzi od promjena. Velik sleep moze izgubiti bridove.
    sleep_ms(1)
`;
export const encoderExamples={
 encoderRaw:{title:'KY-040 · CLK, DT i tipkalo',hint:intro+' Najprije promatraj dva digitalna signala. Ispis pri svakoj promjeni usporava program; pri brzoj vrtnji ili poskakivanju dio bridova može izostati iz konzole.',code:`from machine import Pin
from time import sleep_ms
clk = Pin(4, Pin.IN)
dt = Pin(5, Pin.IN)
sw = Pin(6, Pin.IN, Pin.PULL_UP)
prethodno = None
while True:
    stanje = (clk.value(), dt.value(), sw.value())
    if stanje != prethodno:
        print("RAW CLK=%d DT=%d SW=%d" % stanje)
        prethodno = stanje
    sleep_ms(1)
`},
 ky040:{title:'KY-040 · smjer, koraci i reset',hint:intro+' lab_encoder.py provjerava Gray prijelaze i zbraja četiri promjene do povratka na 11. Nevaljan skok obaju bitova odbacuje nepotpun korak. SW nakon 20 ms resetira brojač.',code:pyCounter},
 encoderBounce:{title:'KY-040 · poskakivanje i Gray dekoder',hint:intro+' Uključen je deterministički pokus: novi/stari/novi/stari/novi kontakt na 0/200/400/600/800 µs. Dekoder poništava povratne prijelaze. Fizičko poskakivanje je promjenjivo; spori polling i dalje može izgubiti korake.',code:pyCounter},
 encoderPWM:{title:'KY-040 → PWM svjetlina LED-ice',hint:intro+' Program mijenja svjetlinu za 5 % po koraku, ograničava 0–100 % i tipkalom vraća 50 %. LED preko 680 Ω na GPIO7 ili D9. Mijenja se programska varijabla, enkoder nema analogni izlaz.',code:pyInit+`from machine import PWM
led = PWM(Pin(7), freq=1000, duty_u16=32768)
svjetlina = 50
print("PWM=50")
while True:
    korak, pritisak = enkoder.update()
    if korak or pritisak:
        svjetlina = 50 if pritisak else max(0, min(100, svjetlina + korak * 5))
        led.duty_u16(svjetlina * 65535 // 100)
        print("PWM=%d" % svjetlina)
    sleep_ms(1)
`},
};

// Same Gray transition table as the visible Python file, executed as AVR code.
const cppDecoder=`// MIT. Polling decoder; one full detent at AB=11, four valid edges.
const int8_t delta[16]={0,-1,1,0,1,0,0,-1,-1,0,0,1,0,1,-1,0};
uint8_t previousAB=3, rawSW=1, stableSW=1;
bool ready=true, pressed=false;
int8_t partial=0;
long position=0;
unsigned long changedAt=0;
uint16_t errors=0;
void initEncoder(){
  pinMode(2,INPUT);pinMode(3,INPUT);pinMode(4,INPUT_PULLUP);
  previousAB=(digitalRead(2)<<1)|digitalRead(3);ready=previousAB==3;
  rawSW=stableSW=digitalRead(4);changedAt=millis();
}
int8_t updateEncoder(){
  uint8_t now=(digitalRead(2)<<1)|digitalRead(3);int8_t step=0;pressed=false;
  if(now!=previousAB){
    if((now^previousAB)==3){partial=0;errors++;ready=false;}
    else if(ready)partial+=delta[(previousAB<<2)|now];
    if(now==3){if(ready&&(partial==4||partial==-4)){step=partial>0?1:-1;position+=step;}partial=0;ready=true;}
    previousAB=now;
  }
  uint8_t raw=digitalRead(4);
  if(raw!=rawSW){rawSW=raw;changedAt=millis();}
  if(raw!=stableSW&&(unsigned long)(millis()-changedAt)>=20){stableSW=raw;pressed=raw==LOW;}
  return step;
}
void resetEncoder(){position=0;partial=0;previousAB=(digitalRead(2)<<1)|digitalRead(3);ready=previousAB==3;}
`;
const cppCounter=cppDecoder+`void setup(){Serial.begin(9600);initEncoder();Serial.println(F("ENC READY P=0; CW=+1 CCW=-1; SW resetira brojac"));}
void loop(){
  int8_t step=updateEncoder();
  if(pressed){resetEncoder();Serial.println(F("ENC RESET P=0"));}
  else if(step){Serial.print(F("ENC P="));Serial.print(position);Serial.print(F(" DIR="));Serial.print(step>0?F("CW"):F("CCW"));Serial.print(F(" ERR="));Serial.println(errors);}
  delay(1);
}
`;
export const arduinoEncoderExamples={
 encoderRaw:{title:'Arduino · '+encoderExamples.encoderRaw.title,hint:encoderExamples.encoderRaw.hint,code:`int previous=-1;
void setup(){Serial.begin(9600);pinMode(2,INPUT);pinMode(3,INPUT);pinMode(4,INPUT_PULLUP);}
void loop(){
  int a=digitalRead(2),b=digitalRead(3),s=digitalRead(4),now=(a<<2)|(b<<1)|s;
  if(now!=previous){Serial.print(F("RAW CLK="));Serial.print(a);Serial.print(F(" DT="));Serial.print(b);Serial.print(F(" SW="));Serial.println(s);previous=now;}
  delay(1);
}
`},
 ky040:{title:'Arduino · '+encoderExamples.ky040.title,hint:encoderExamples.ky040.hint.replace('lab_encoder.py','C++ dekoder u main.ino'),code:cppCounter},
 encoderBounce:{title:'Arduino · '+encoderExamples.encoderBounce.title,hint:encoderExamples.encoderBounce.hint,code:cppCounter},
 encoderPWM:{title:'Arduino · '+encoderExamples.encoderPWM.title,hint:encoderExamples.encoderPWM.hint,code:cppDecoder+`int brightness=50;
void setup(){Serial.begin(9600);initEncoder();pinMode(9,OUTPUT);analogWrite(9,128);Serial.println(F("PWM=50"));}
void loop(){
  int8_t step=updateEncoder();
  if(step||pressed){brightness=pressed?50:constrain(brightness+step*5,0,100);analogWrite(9,(long)brightness*255/100);Serial.print(F("PWM="));Serial.println(brightness);}
  delay(1);
}
`},
} as const;
