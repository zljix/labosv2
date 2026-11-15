import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type ActuatorExample='sg90Sweep'|'relayContacts'|'activeAlarm'|'piezoTone'|'dcDrive'|'dualDrive'|'servoMotorTone';
export function actuatorCircuit(key:ActuatorExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=35;b.y=120;
 const pin=(n:number)=>terminals(b).find(t=>t.gpio===n)!.pin;
 const gnd=terminals(b).find(t=>t.role==='ground')!.pin,v5=terminals(b).find(t=>t.role==='5v')!.pin,lv=terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin;
 const add=(kind:Parameters<typeof makePart>[0],id:string,x:number,y:number)=>{const p=makePart(kind,x,y,id);c.components.push(p);return p;};
 const wire=(a:string,p:string,z:string,q:string,color='#087f8c')=>c.wires.push({id:'aw'+c.wires.length,from:{component:a,pin:p},to:{component:z,pin:q},color,points:[]});
 const signal=(n:number,id:string,p='SIG')=>wire(b.id,pin(n),id,p);
 const power=(id:string)=>{wire(b.id,v5,id,'VCC','#d04b46');wire(b.id,gnd,id,'GND','#334155');};
 if(['sg90Sweep','servoMotorTone'].includes(key)){
  const supply=add('powerSupply','servoSupply',avr?650:400,80);supply.properties.supplyVoltage=5;
  add('sg90','sg90',avr?950:680,100);wire('servoSupply','+','sg90','V+','#d04b46');wire('servoSupply','-','sg90','GND','#334155');wire('servoSupply','-',b.id,gnd,'#334155');signal(avr?8:6,'sg90');
 }
 if(key==='relayContacts'){
  const relay=add('relay','relay1',avr?650:400,120);relay.properties.logicVoltage=avr?5:3.3;power(relay.id);wire(b.id,lv,relay.id,'LV','#d04b46');signal(avr?7:6,relay.id,'IN');
  const supply=add('powerSupply','loadSupply',avr?1040:800,80);supply.properties.supplyVoltage=5;wire(supply.id,'+',relay.id,'COM','#d04b46');
  for(const [i,contact]of ['NO','NC'].entries()){
   const r=add('resistor','relayR'+i,avr?1100:860,350+i*150),led=add('led','relayLED'+i,avr?1320:1080,350+i*150);r.properties.resistance=680;led.properties.color=i?'green':'red';
   wire(relay.id,contact,r.id,'1');wire(r.id,'2',led.id,'A');wire(led.id,'K',supply.id,'-','#334155');
  }
 }
 if(key==='activeAlarm'||key==='piezoTone'||key==='servoMotorTone'){
  const piezo=key!=='activeAlarm';add(piezo?'passiveBuzzer':'activeBuzzer','buzzer1',avr?1050:750,key==='servoMotorTone'?680:200);power('buzzer1');signal(avr?4:7,'buzzer1');
 }
 if(['dcDrive','dualDrive','servoMotorTone'].includes(key)){
  const driver=add('l298n','bridge1',avr?650:400,key==='servoMotorTone'?380:160);driver.properties.jumperA=false;driver.properties.jumperB=false;
  const supply=add('powerSupply','motorSupply',avr?1150:900,100);supply.properties.supplyVoltage=6;wire(supply.id,'+',driver.id,'VS','#d04b46');wire(supply.id,'-',driver.id,'GND','#334155');wire(b.id,gnd,driver.id,'GND','#334155');wire(b.id,v5,driver.id,'VSS','#d04b46');
  for(const [n,p]of (avr?[[5,'ENA'],[7,'IN1'],[12,'IN2'],[6,'ENB'],[10,'IN3'],[11,'IN4']]:[[4,'ENA'],[8,'IN1'],[9,'IN2'],[5,'ENB'],[10,'IN3'],[11,'IN4']])as [number,string][])signal(n,driver.id,p);
  const count=key==='dualDrive'?2:1;
  for(let i=0;i<count;i++){const m=add('motor130','motor'+(i+1),avr?1170:920,350+i*190);m.label=i?'Motor B':'Motor A';wire(driver.id,'OUT'+(i*2+1),m.id,'M+');wire(driver.id,'OUT'+(i*2+2),m.id,'M-');}
 }
 return c;
}
const servoHint='SG90 ima zaseban 5 V izvor i zajedničku masu. Modelni raspon 1000–2000 µs odgovara 0–180°; kalibracija je svojstvo profila, nije jamstvo fizičkog hoda. Impulse mjeri simulator, kut ne preuzima iz varijable programa.';
const dcHint='L298N: VS=6 V iz zasebnog izvora, VSS=5 V, GND zajednički; regulator 5V-EN i oba EN jumpera uklonjeni. IN1/IN2 biraju smjer, ENA nosi PWM. EN LOW znači slobodno zaustavljanje; jednaki IN uz EN HIGH koče. Stalni pad mosta 2 V daje oko 4 V na motoru pri 100 %. Relativni pokazatelj |U|/6 V nije RPM.';
const pyDC=`from machine import Pin, PWM
from time import sleep_ms
a1, a2 = Pin(8, Pin.OUT, value=0), Pin(9, Pin.OUT, value=0)
b1, b2 = Pin(10, Pin.OUT, value=0), Pin(11, Pin.OUT, value=0)
ena, enb = PWM(Pin(4), freq=1000, duty_u16=0), PWM(Pin(5), freq=1000, duty_u16=0)
`;
export const actuatorExamples={
 sg90Sweep:{title:'SG90 · kalibracija i impuls',hint:servoHint,code:`from servo import Servo
from time import sleep_ms
servo = Servo(6, min_us=1000, max_us=2000)
while True:
    for kut in (0, 90, 180):
        servo.angle(kut)
        print("SG90 ANGLE=%d" % kut)
        sleep_ms(600)
`},
 relayContacts:{title:'Relej · COM, NO i NC',hint:'VCC=5 V, LV=3,3 V / 5 V, IN=GPIO6 / D7; aktivan LOW. COM–NC svijetli bez pobude, COM–NO uz pobudu. Kontakti preklapaju zasebni 5 V krug s dva LED-a i otpornicima 680 Ω; njegova masa smije ostati odvojena. Promijeni aktivnu razinu u svojstvima pa prilagodi kod.',code:`from machine import Pin
from time import sleep_ms
# Najprije zadaj neaktivnu razinu HIGH.
relej = Pin(6, Pin.OUT, value=1)
while True:
    relej.value(0)
    print("RELAY ON -> COM-NO")
    sleep_ms(700)
    relej.value(1)
    print("RELAY OFF -> COM-NC")
    sleep_ms(700)
`},
 activeAlarm:{title:'Aktivna zujalica · uključeno i isključeno',hint:'Generički modul s pogonom: VCC=5 V, GND, SIG=GPIO7 / D4. Stalni HIGH uključuje ugrađeni 2300 Hz oscilator; ovo nije potvrđeni SFM-20B. Ton prvo promatraj, zatim po želji uključi slušanje.',code:`from machine import Pin
from time import sleep_ms
zujalica = Pin(7, Pin.OUT, value=0)
while True:
    zujalica.value(1)
    print("ACTIVE ON")
    sleep_ms(500)
    zujalica.value(0)
    print("ACTIVE OFF")
    sleep_ms(500)
`},
 piezoTone:{title:'Pasivni piezo · frekvencija i trajanje',hint:'Piezo s ugrađenim pogonom, VCC=5 V, SIG=GPIO7 / D4. PWM ili tone stvara izmjenični signal. DC je tih. Arduino tone koristi Timer2: ne kombiniraj ga s IR nositeljem ili PWM D3/D11. Zvuk je opcionalan; mjerenja daju frekvenciju i stanje.',code:`from machine import Pin, PWM
from time import sleep_ms
piezo = PWM(Pin(7), freq=440, duty_u16=0)
while True:
    for hz in (440, 880, 1320):
        piezo.freq(hz)
        piezo.duty_u16(32768)
        print("TONE=%d" % hz)
        sleep_ms(400)
        piezo.duty_u16(0)
        sleep_ms(100)
    print("TONE OFF")
    sleep_ms(500)
`},
 dcDrive:{title:'DC motor · smjer, PWM i kočenje',hint:dcHint,code:pyDC+`while True:
    for duty in (16384, 32768, 65535):
        a1.value(1)
        a2.value(0)
        ena.duty_u16(duty)
        print("MOTOR FORWARD PWM=%d" % duty)
        sleep_ms(500)
    ena.duty_u16(0)
    print("MOTOR COAST")
    sleep_ms(300)
    a1.value(0)
    a2.value(1)
    ena.duty_u16(32768)
    print("MOTOR REVERSE")
    sleep_ms(600)
    a1.value(0)
    a2.value(0)
    ena.duty_u16(65535)
    print("MOTOR BRAKE")
    sleep_ms(500)
`},
 dualDrive:{title:'L298N · dva neovisna motora',hint:dcHint+' Drugi motor: IN3/IN4 i ENB. Motor A i B imaju neovisan smjer i radni omjer.',code:pyDC+`while True:
    a1.value(1)
    a2.value(0)
    b1.value(0)
    b2.value(1)
    ena.duty_u16(32768)
    enb.duty_u16(49151)
    print("DUAL A=+50 B=-75")
    sleep_ms(800)
    ena.duty_u16(65535)
    enb.duty_u16(0)
    print("DUAL A=+100 B=COAST")
    sleep_ms(800)
`},
 servoMotorTone:{title:'Servo + motor + ton · raspodjela timera',hint:servoHint+' '+dcHint+' Uno/Nano: Servo Timer1 na D8, motor PWM Timer0 na D5, tone Timer2 na D4; motor D9/D10 uz Servo ili D3/D11 uz tone nije valjan izbor PWM-a. IR prijam bez timera može koegzistirati, IR predajnik koristi Timer2 i sukobljava se s tone.',code:pyDC+`from servo import Servo
servo = Servo(6, min_us=1000, max_us=2000)
piezo = PWM(Pin(7), freq=880, duty_u16=32768)
a1.value(1)
a2.value(0)
ena.duty_u16(32768)
while True:
    for kut in (45, 135):
        servo.angle(kut)
        print("COMBINED ANGLE=%d MOTOR=50 TONE=880" % kut)
        sleep_ms(600)
`},
} as const;
const cppMotorSetup=`const byte ENA = 5, ENB = 6;
const byte IN1 = 7, IN2 = 12, IN3 = 10, IN4 = 11;

void pripremiPogon() {
  const byte pinovi[6] = {ENA, ENB, IN1, IN2, IN3, IN4};
  for (byte i = 0; i < 6; i++) pinMode(pinovi[i], OUTPUT);
  // EN jumperi su uklonjeni. VSS=5 V, VS=6 V, GND zajednicki.
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
}
`;
export const arduinoActuatorExamples={
 sg90Sweep:{...actuatorExamples.sg90Sweep,title:'Arduino · '+actuatorExamples.sg90Sweep.title,code:`#include <Servo.h>
Servo servo;

void setup() {
  Serial.begin(9600);
  // Timer1 stvara impulse na D8; D9/D10 PWM vise nije raspoloziv.
  // Kalibraciju modela i programa mijenjaj zajedno.
  servo.attach(8, 1000, 2000);
}

void loop() {
  const int kutovi[3] = {0, 90, 180};
  for (byte i = 0; i < 3; i++) {
    servo.write(kutovi[i]);
    Serial.print(F("SG90 ANGLE=")); Serial.println(kutovi[i]);
    delay(600);
  }
}
`},
 relayContacts:{...actuatorExamples.relayContacts,title:'Arduino · '+actuatorExamples.relayContacts.title,code:`void setup() {
  // Prvo zadaj HIGH, pa ukljuci izlaz: aktivno LOW pocinje bez pobude.
  digitalWrite(7, HIGH);
  pinMode(7, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(7, LOW);  // pobuda zavojnice: COM se spaja na NO
  Serial.println(F("RELAY ON -> COM-NO"));
  delay(700);
  digitalWrite(7, HIGH); // bez pobude: COM se vraca na NC
  Serial.println(F("RELAY OFF -> COM-NC"));
  delay(700);
}
`},
 activeAlarm:{...actuatorExamples.activeAlarm,title:'Arduino · '+actuatorExamples.activeAlarm.title,code:`void setup() {
  pinMode(4, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // Aktivni modul ima vlastiti oscilator; dovoljan je stalni HIGH.
  digitalWrite(4, HIGH);
  Serial.println(F("ACTIVE ON"));
  delay(500);
  digitalWrite(4, LOW);
  Serial.println(F("ACTIVE OFF"));
  delay(500);
}
`},
 piezoTone:{...actuatorExamples.piezoTone,title:'Arduino · '+actuatorExamples.piezoTone.title,code:`void setup() {
  pinMode(4, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  const unsigned int note[3] = {440, 880, 1320};
  for (byte i = 0; i < 3; i++) {
    // Timer2 stvara signal. Ne koristi PWM D3/D11 ili IR nositelj.
    tone(4, note[i], 400); // frekvencija Hz, trajanje ms
    Serial.print(F("TONE=")); Serial.println(note[i]);
    delay(500);           // nakon tona ostaje 100 ms tisine
  }
  noTone(4);
  Serial.println(F("TONE OFF"));
  delay(500);
}
`},
 dcDrive:{...actuatorExamples.dcDrive,title:'Arduino · '+actuatorExamples.dcDrive.title,code:cppMotorSetup+`
void setup() {
  pripremiPogon();
  Serial.begin(9600);
}

void loop() {
  const byte pwm[3] = {64, 128, 255};
  for (byte i = 0; i < 3; i++) {
    digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
    analogWrite(ENA, pwm[i]); // 0-255; smjer odredjuju IN1 i IN2
    Serial.print(F("MOTOR FORWARD PWM=")); Serial.println(pwm[i]);
    delay(500);
  }
  analogWrite(ENA, 0);  // izlazi visoke impedancije, slobodno zaustavljanje
  Serial.println(F("MOTOR COAST"));
  delay(300);
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  analogWrite(ENA, 128);
  Serial.println(F("MOTOR REVERSE"));
  delay(600);
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  analogWrite(ENA, 255); // jednaki IN uz EN HIGH: kocenje
  Serial.println(F("MOTOR BRAKE"));
  delay(500);
}
`},
 dualDrive:{...actuatorExamples.dualDrive,title:'Arduino · '+actuatorExamples.dualDrive.title,code:cppMotorSetup+`
void setup() {
  pripremiPogon();
  Serial.begin(9600);
}

void loop() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  analogWrite(ENA, 128); // A: pozitivan smjer, oko 50 % PWM
  analogWrite(ENB, 192); // B: negativan smjer, oko 75 % PWM
  Serial.println(F("DUAL A=+50 B=-75"));
  delay(800);
  analogWrite(ENA, 255);
  analogWrite(ENB, 0);   // B je slobodan, A i dalje radi
  Serial.println(F("DUAL A=+100 B=COAST"));
  delay(800);
}
`},
 servoMotorTone:{...actuatorExamples.servoMotorTone,title:'Arduino · '+actuatorExamples.servoMotorTone.title,code:`#include <Servo.h>
Servo servo;
`+cppMotorSetup+`
void setup() {
  pripremiPogon();
  Serial.begin(9600);
  servo.attach(8, 1000, 2000); // Timer1; SIG ne treba hardverski PWM pin
  digitalWrite(IN1, HIGH);
  analogWrite(ENA, 128);      // D5 je Timer0, ne sukobljava se sa Servom
  tone(4, 880);              // Timer2; izbjegavaj PWM D3/D11 i IR nositelj
}

void loop() {
  servo.write(45);
  Serial.println(F("COMBINED ANGLE=45 MOTOR=50 TONE=880"));
  delay(600);
  servo.write(135);
  Serial.println(F("COMBINED ANGLE=135 MOTOR=50 TONE=880"));
  delay(600);
}
`},
} as const;
