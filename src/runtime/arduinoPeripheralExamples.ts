import {type BoardId} from '../boards/profiles';
import {emptyCircuit,makePart,type Circuit} from '../circuit/model';
const oledSetup=`// _1_ koristi spremnik jedne stranice (128 B), a ne punu sliku (1024 B).
// Redoslijed konstruktora: SCL, SDA. Na modulu piše SDA, SCL.
U8G2_SSD1306_128X64_NONAME_1_SW_I2C zaslon(U8G2_R0, 7, 6, U8X8_PIN_NONE);
`;
export const arduinoPeripheralExamples={
  aht10:{title:'Arduino · AHT10 i stvarni Wire',hint:'AHT10: profil modula s prilagodbom I2C razina na 5 V; VCC na 5 V, GND na GND, SDA na A4, SCL na A5. I2C adresa 0x38; senzor ima zasebnu sabirnicu. LabAHT10 šalje naredbu, čeka 80 ms i dekodira 6 bajtova. Mijenjaj temperaturu/vlagu u Živim ulazima.',libraries:['LabAHT10'],code:`#include <Wire.h>
#include <LabAHT10.h>
LabAHT10 senzor;
void setup() {
  Serial.begin(9600);
  Serial.println(senzor.begin() ? F("AHT10 spreman") : F("AHT10: provjeri spoj"));
}
void loop() {
  float temperatura, vlaga;
  if (senzor.read(temperatura, vlaga)) {
    Serial.print(F("T=")); Serial.print(temperatura, 2);
    Serial.print(F(" C RH=")); Serial.println(vlaga, 2);
  } else Serial.println(F("AHT10: nema mjerenja"));
  delay(1920);
}
`},
  oled:{title:'Arduino · OLED preko GPIO bridova',hint:'OLED: profil modula s prilagodbom na 5 V; VCC na 5 V, GND na GND, SDA na D6, SCL na D7, adresa 0x3C. U8g2 software I2C izvodi stvarne GPIO promjene. Prvo firstPage(), zatim crtanje unutar do/while(nextPage()). _1_ sprema 128 B slike u SRAM, a svih 1024 B prenosi u memoriju zaslona.',libraries:['U8g2'],code:`#include <U8g2lib.h>
${oledSetup}unsigned long broj = 0;
void setup() { zaslon.begin(); zaslon.setFont(u8g2_font_6x10_tf); }
void loop() {
  zaslon.firstPage();
  do {
    zaslon.drawStr(0, 12, "OLED: software I2C");
    zaslon.setCursor(0, 30); zaslon.print(F("Brojac: ")); zaslon.print(broj);
    zaslon.drawFrame(0, 45, 128, 12);
    zaslon.drawBox(2, 47, broj % 125, 8);
  } while (zaslon.nextPage());
  broj++; delay(600);
}
`},
  servo:{title:'Arduino · Servo i Timer1',hint:'Servo: V+ na 5 V, GND na zajedničku masu, SIG na D9. Servo 1.2.2 upravlja Timerom1 i GPIO impulsima. attach(9, 500, 2500) usklađuje raspon s idealiziranim modelom 0–180°. Dok je Servo priključen, Timer1 PWM na D9/D10 nije raspoloživ za analogWrite(). Fizički motor zahtijeva odgovarajuće napajanje.',libraries:['Servo'],code:`#include <Servo.h>
Servo motor;
void setup() {
  Serial.begin(9600);
  motor.attach(9, 500, 2500); // kalibracija impulsa modela
}
void loop() {
  for (int kut = 0; kut <= 180; kut += 90) {
    motor.write(kut);
    Serial.print(F("Servo=")); Serial.println(kut);
    delay(700);
  }
}
`},
  regulator:{title:'Arduino · AHT10 → OLED → servo',hint:'AHT10: SDA=A4, SCL=A5. OLED: SDA=D6, SCL=D7 (software I2C, 0x3C). Oba su izričito profili modula s prilagodbom na 5 V. Servo: SIG=D9, V+=5 V, zajednička masa. Histereza zadržava prethodno stanje između 26 i 28 °C. Promijeni ulaz 24 → 30 → 27 → 25 °C; usporedi piksele, kut i zapis mjerenja. Primjer ima uključen provjereni prevedeni program za rad bez prevoditelja.',libraries:['LabAHT10','U8g2','Servo'],code:`#include <Wire.h>
#include <LabAHT10.h>
#include <U8g2lib.h>
#include <Servo.h>
LabAHT10 senzor;
${oledSetup}Servo motor;
bool otvoreno = false;
void setup() {
  Serial.begin(9600);
  motor.attach(9, 500, 2500); motor.write(0);
  if (!senzor.begin()) Serial.println(F("AHT10: provjeri spoj"));
  zaslon.begin(); zaslon.setFont(u8g2_font_6x10_tf);
  Serial.println(F("Regulator spreman"));
}
void loop() {
  float temperatura, vlaga;
  if (!senzor.read(temperatura, vlaga)) {
    motor.write(0); otvoreno = false;
    Serial.println(F("AHT10: nema mjerenja")); delay(500); return;
  }
  // Dva praga sprjecavaju prebacivanje oko jedne granice.
  if (temperatura >= 28) otvoreno = true;
  else if (temperatura <= 26) otvoreno = false;
  int kut = otvoreno ? 90 : 0;
  motor.write(kut);
  zaslon.firstPage();
  do {
    zaslon.setCursor(0, 12); zaslon.print(F("T: ")); zaslon.print(temperatura, 1); zaslon.print(F(" C"));
    zaslon.setCursor(0, 26); zaslon.print(F("RH: ")); zaslon.print(vlaga, 1); zaslon.print(F(" %"));
    zaslon.setCursor(0, 40); zaslon.print(F("Servo: ")); zaslon.print(kut);
    zaslon.drawStr(0, 53, otvoreno ? "OTVORENO" : "ZATVORENO");
    zaslon.drawBox(0, 58, (uint8_t)(vlaga * 1.28f), 6);
  } while (zaslon.nextPage());
  Serial.print(F("T=")); Serial.print(temperatura, 2);
  Serial.print(F(" RH=")); Serial.print(vlaga, 2);
  Serial.print(F(" Servo=")); Serial.println(kut);
  delay(1500);
}
`},
} as const;
export type PeripheralExample=keyof typeof arduinoPeripheralExamples;
export function arduinoPeripheralCircuit(key:PeripheralExample,board:BoardId):Circuit{
  const c=emptyCircuit(board),b=c.components[0].id;c.components[0].x=50;c.components[0].y=90;
  function connect(id:string,pin:string,q:string,color:string){c.wires.push({id:'ap'+c.wires.length,from:{component:b,pin:q},to:{component:id,pin},color,points:[]});}
  if(key==='aht10'||key==='regulator'){
    const p=makePart('aht10',550,90,'aht1');p.properties.moduleVoltage=5;c.components.push(p);
    connect(p.id,'VCC','5V','#d04b46');connect(p.id,'GND','GND','#334155');connect(p.id,'SDA','A4','#087f8c');connect(p.id,'SCL','A5','#d59218');
  }
  if(key==='oled'||key==='regulator'){
    const p=makePart('ssd1306',970,70,'oled1');p.properties.moduleVoltage=5;c.components.push(p);
    connect(p.id,'VCC','5V','#d04b46');connect(p.id,'GND','GND','#334155');connect(p.id,'SDA','D6','#3867d6');connect(p.id,'SCL','D7','#8b52ba');
  }
  if(key==='servo'||key==='regulator'){
    c.components.push(makePart('servo',880,490,'servo1'));
    connect('servo1','V+','5V','#d04b46');connect('servo1','GND','GND','#334155');connect('servo1','SIG','D9','#d59218');
  }
  return c;
}
