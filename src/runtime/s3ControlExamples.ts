import {encoderCircuit,type EncoderExample} from '../circuit/encoderExamples';
import {actuatorCircuit,type ActuatorExample} from '../circuit/actuatorExamples';
import {arduinoStepperExamples,stepperCircuit,type StepperExample} from '../circuit/stepperExamples';
import type {Project} from '../project/model';

// Visible project source. The decoder reads contacts; it never reads the UI position.
export const cppS3Encoder=`// MIT. KY-040: cetiri Gray brida daju jedan zadrzni korak.
#pragma once
#include <Arduino.h>
class LabEncoder {
  uint8_t a,b,sw,previousAB=3,rawSW=1,stableSW=1;
  bool ready=true;
  int8_t partial=0;
  unsigned long changedAt=0;
public:
  long position=0;
  uint16_t errors=0;
  bool pressed=false;
  LabEncoder(uint8_t clk,uint8_t dt,uint8_t button):a(clk),b(dt),sw(button){}
  void begin() {
    // CLK/DT imaju vanjski 10 kOhm; SW koristi programski pull-up.
    pinMode(a,INPUT); pinMode(b,INPUT); pinMode(sw,INPUT_PULLUP);
    previousAB=(digitalRead(a)<<1)|digitalRead(b); ready=previousAB==3;
    rawSW=stableSW=digitalRead(sw); changedAt=millis();
  }
  int8_t update() {
    const int8_t delta[16]={0,-1,1,0,1,0,0,-1,-1,0,0,1,0,1,-1,0};
    uint8_t now=(digitalRead(a)<<1)|digitalRead(b);
    int8_t step=0; pressed=false;
    if(now!=previousAB) {
      if((now^previousAB)==3) { partial=0; errors++; ready=false; }
      else if(ready) partial+=delta[(previousAB<<2)|now];
      if(now==3) {
        if(ready&&(partial==4||partial==-4)) { step=partial>0?1:-1; position+=step; }
        partial=0; ready=true;
      }
      previousAB=now;
    }
    uint8_t raw=digitalRead(sw);
    if(raw!=rawSW) { rawSW=raw; changedAt=millis(); }
    // unsigned oduzimanje ostaje valjano i kad se millis() prelije.
    if(raw!=stableSW&&(unsigned long)(millis()-changedAt)>=20) {
      stableSW=raw; pressed=raw==LOW;
    }
    return step;
  }
  void reset() {
    position=0; partial=0;
    previousAB=(digitalRead(a)<<1)|digitalRead(b); ready=previousAB==3;
  }
};
`;
const encoderHint='S3: VCC=3,3 V, zajednički GND, CLK/DT/SW=GPIO4/5/6. CLK/DT imaju 10 kΩ, SW INPUT_PULLUP. CW je 11→01→00→10→11; četiri brida daju jedan korak. Vidljivi lab_encoder.h broji od 0, odbacuje nemoguć skok obaju bitova i prihvaća tipkalo nakon 20 ms. Brojač nije apsolutni kut; spor polling može izgubiti bridove.';
const encoderStart=`#include "lab_encoder.h"
LabEncoder encoder(4,5,6);
`;
const encoderCounter=encoderStart+`void setup() {
  Serial.begin(9600); encoder.begin();
  Serial.println("S3 ENC READY P=0");
}
void loop() {
  int8_t step=encoder.update();
  if(encoder.pressed) { encoder.reset(); Serial.println("S3 ENC RESET P=0"); }
  else if(step) {
    Serial.print("S3 ENC P="); Serial.print(encoder.position);
    Serial.print(" DIR="); Serial.print(step>0?"CW":"CCW");
    Serial.print(" ERR="); Serial.println(encoder.errors);
  }
  delay(1); // citaj cesce nego sto se mijenjaju kontakti
}
`;
const motorStart=`// L298N: VS=6 V, VSS=5 V, zajednicki GND; EN jumperi uklonjeni.
const byte ENA=4, ENB=5, IN1=8, IN2=9, IN3=10, IN4=11;
void pripremiPogon() {
  // Najprije iskljuci EN; GPIO ne napaja motor.
  digitalWrite(ENA,LOW); digitalWrite(ENB,LOW);
  const byte pins[6]={ENA,ENB,IN1,IN2,IN3,IN4};
  for(byte p:pins) pinMode(p,OUTPUT);
  analogWrite(ENA,0); analogWrite(ENB,0);
}
`;
const motorHint='S3: ENA/ENB=GPIO4/5, IN1/2=GPIO8/9, IN3/4=GPIO10/11. L298N: zasebnih VS=6 V, VSS=5 V, zajednički GND, EN i 5V-EN jumperi uklonjeni. EN LOW daje slobodno zaustavljanje; jednaki IN uz EN HIGH koče. Idealni pad mosta 2 V daje ±4 V pri 100 %. Relativni pokazatelj |U|/6 V nije RPM. S3 analogWrite koristi LEDC 1 kHz / 8 bita; AVR raspodjela timera ovdje se ne primjenjuje.';
const passiveHint='S3: generički pasivni piezo modul s pogonom, VCC=5 V, GND, SIG=GPIO7. LEDC 8 bita stvara 440/880/1320 Hz uz duty 128/255. Program mjeri 400 ms tona i 100 ms stanke. DC je tih. Ovo ne dodaje tone() niti AVR Timer2; zvuk se može promatrati bez uključivanja slušanja.';
const tone=`bool postaviTon(unsigned int hz) {
  // Prije promjene frekvencije ugasi i odvoji prethodni LEDC kanal.
  ledcDetach(7);
  if(!ledcAttach(7,hz,8)) return false;
  return ledcWrite(7,128);
}
`;
export const s3ControlExamples={
 encoderRaw:{title:'S3 C++ · KY-040, sirovi CLK/DT/SW',hint:encoderHint+' Najprije promatraj pojedinačne kontakte. Ispisuje samo promjenu; zadani bridovi su usporeni na 100 ms.',code:`// KY-040: CLK4, DT5, SW6; VCC3V3 i zajednicki GND.
int previous=-1;
void setup() {
  Serial.begin(9600); pinMode(4,INPUT); pinMode(5,INPUT); pinMode(6,INPUT_PULLUP);
}
void loop() {
  int a=digitalRead(4), b=digitalRead(5), s=digitalRead(6);
  int now=(a<<2)|(b<<1)|s;
  if(now!=previous) {
    Serial.print("S3 RAW CLK="); Serial.print(a);
    Serial.print(" DT="); Serial.print(b);
    Serial.print(" SW="); Serial.println(s); previous=now;
  }
  delay(1);
}
`},
 ky040:{title:'S3 C++ · KY-040, smjer i reset',hint:encoderHint,code:encoderCounter},
 encoderBounce:{title:'S3 C++ · KY-040, poskakivanje',hint:encoderHint+' Uključen je deterministički novi/stari/novi/stari/novi kontakt tijekom 800 µs. Gray dekoder poništava opažene povratne prijelaze; fizički kontakt i spor polling nisu time općenito riješeni.',code:encoderCounter},
 encoderPWM:{title:'S3 C++ · KY-040 → PWM LED',hint:encoderHint+' LED preko 680 Ω na GPIO7. Svaki korak mijenja svjetlinu za 5 %, raspon 0–100 %. SW vraća 50 %, bez promjene mehaničkog položaja.',code:encoderStart+`int brightness=50;
void setup() {
  Serial.begin(9600); encoder.begin(); analogWrite(7,128);
  Serial.println("S3 PWM=50");
}
void loop() {
  int8_t step=encoder.update();
  if(step||encoder.pressed) {
    brightness=encoder.pressed?50:constrain(brightness+step*5,0,100);
    analogWrite(7,(long)brightness*255/100);
    Serial.print("S3 PWM="); Serial.println(brightness);
  }
  delay(1);
}
`},
 relayContacts:{title:'S3 C++ · relej, COM/NO/NC',hint:'S3: IN=GPIO6, VCC=5 V, LV=3,3 V i zajednička masa upravljanja. Izričiti Lab profil ima prilagodnik logike; LV nije standardni izvod svakog kupljenog releja. Aktivno LOW: HIGH prije OUTPUT daje početno COM–NC. Zaseban 5 V krug preko 680 Ω napaja NO/NC LED-ice i može imati odvojenu masu. Promijeni aktivnu razinu pa uskladi kod.',code:`void setup() {
  // Zadaj neaktivnu razinu prije ukljucivanja izlaza.
  digitalWrite(6,HIGH); pinMode(6,OUTPUT); Serial.begin(9600);
  Serial.println("S3 RELAY READY OFF"); delay(100);
}
void loop() {
  digitalWrite(6,LOW); Serial.println("S3 RELAY ON -> COM-NO"); delay(700);
  digitalWrite(6,HIGH); Serial.println("S3 RELAY OFF -> COM-NC"); delay(700);
}
`},
 activeAlarm:{title:'S3 C++ · aktivna zujalica',hint:'S3: generički modul s pogonom, VCC=5 V, GND, SIG=GPIO7. Stalni HIGH uključuje vlastiti modelni oscilator 2300 Hz; LOW gasi. Početak je LOW. To nije potvrđena izvedba SFM-20B. Za opažanje je dovoljan pokazatelj frekvencije; slušanje je zasebna korisnička radnja.',code:`void setup() {
  digitalWrite(7,LOW); pinMode(7,OUTPUT); Serial.begin(9600);
  Serial.println("S3 ACTIVE READY OFF"); delay(100);
}
void loop() {
  digitalWrite(7,HIGH); Serial.println("S3 ACTIVE ON"); delay(500);
  digitalWrite(7,LOW); Serial.println("S3 ACTIVE OFF"); delay(500);
}
`},
 piezoTone:{title:'S3 C++ · pasivni piezo i LEDC',hint:passiveHint,code:tone+`void setup() { Serial.begin(9600); digitalWrite(7,LOW); pinMode(7,OUTPUT); }
void loop() {
  const unsigned int notes[3]={440,880,1320};
  for(unsigned int hz:notes) {
    if(!postaviTon(hz)) { Serial.println("S3 LEDC ERROR"); delay(1000); return; }
    Serial.print("S3 TONE="); Serial.println(hz); delay(400);
    ledcWrite(7,0); Serial.println("S3 TONE PAUSE"); delay(100);
  }
  ledcDetach(7); pinMode(7,OUTPUT); digitalWrite(7,LOW);
  Serial.println("S3 TONE OFF"); delay(500);
}
`},
 dcDrive:{title:'S3 C++ · L298N, smjer i kočenje',hint:motorHint,code:motorStart+`void setup() { pripremiPogon(); Serial.begin(9600); }
void loop() {
  const byte pwm[3]={64,128,255};
  digitalWrite(IN1,HIGH); digitalWrite(IN2,LOW);
  for(byte duty:pwm) {
    analogWrite(ENA,duty);
    Serial.print("S3 MOTOR FORWARD PWM="); Serial.println(duty); delay(500);
  }
  analogWrite(ENA,0); Serial.println("S3 MOTOR COAST"); delay(300);
  digitalWrite(IN1,LOW); digitalWrite(IN2,HIGH); analogWrite(ENA,128);
  Serial.println("S3 MOTOR REVERSE"); delay(600);
  // Kocenje: oba IN LOW, EN ukljucen.
  analogWrite(ENA,0); digitalWrite(IN2,LOW); analogWrite(ENA,255);
  Serial.println("S3 MOTOR BRAKE"); delay(500);
  analogWrite(ENA,0); // promjenu smjera iduce petlje zapocni bez pobude
}
`},
 dualDrive:{title:'S3 C++ · L298N, dva motora',hint:motorHint+' A i B imaju neovisne smjerove i radne omjere.',code:motorStart+`void setup() { pripremiPogon(); Serial.begin(9600); }
void loop() {
  digitalWrite(IN1,HIGH); digitalWrite(IN2,LOW);
  digitalWrite(IN3,LOW); digitalWrite(IN4,HIGH);
  analogWrite(ENA,128); analogWrite(ENB,192);
  Serial.println("S3 DUAL A=+50 B=-75"); delay(800);
  analogWrite(ENA,255); analogWrite(ENB,0);
  Serial.println("S3 DUAL A=+100 B=COAST"); delay(800);
}
`},
 servoMotorTone:{title:'S3 C++ · SG90, motor i ton',hint:motorHint+' SG90 SIG=GPIO6, zasebnih 5 V i zajednička masa; LEDC 50 Hz/14 bita i 1000–2000 µs. Pasivni piezo SIG=GPIO7, 880 Hz/8 bita. Četiri neovisna LEDC izlaza (ENA/ENB/servo/piezo); nema AVR Servo/Timer1/tone ovisnosti. Nema simulacije struje ni momenta.',code:motorStart+tone+`void setup() {
  pripremiPogon(); Serial.begin(9600);
  if(!ledcAttach(6,50,14)||!postaviTon(880)) {
    Serial.println("S3 LEDC ERROR"); while(true) delay(100);
  }
  digitalWrite(IN1,HIGH); digitalWrite(IN2,LOW); analogWrite(ENA,128);
}
void loop() {
  const int angles[2]={45,135};
  for(int angle:angles) {
    int pulse=1000+angle*1000/180;
    // Zaokruzi 14-bitni radni omjer na najblizi broj.
    ledcWrite(6,((uint32_t)pulse*16383+10000)/20000);
    Serial.print("S3 COMBINED ANGLE="); Serial.print(angle);
    Serial.println(" MOTOR=50 TONE=880"); delay(600);
  }
}
`},
 stepperBasic:{...arduinoStepperExamples.stepperBasic,title:'S3 C++ · A4988, koraci i smjer'},
 stepperMicro:{...arduinoStepperExamples.stepperMicro,title:'S3 C++ · A4988, pet mikrostep načina'},
 stepperControl:{...arduinoStepperExamples.stepperControl,title:'S3 C++ · A4988, ENABLE/RESET/SLEEP'},
} as const;

export function attachS3ControlExample(p:Project,key:string) {
 if(!Object.hasOwn(s3ControlExamples,key)) return;
 if(['encoderRaw','ky040','encoderBounce','encoderPWM'].includes(key)) {
   p.circuit=encoderCircuit(key as EncoderExample);
   if(key!=='encoderRaw') p.files['lab_encoder.h']=cppS3Encoder;
 } else if(key.startsWith('stepper')) p.circuit=stepperCircuit(key as StepperExample);
 else p.circuit=actuatorCircuit(key as ActuatorExample);
}
