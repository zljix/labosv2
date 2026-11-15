import {analogCircuit,type AnalogExample} from '../circuit/analogExamples';
import type {Project} from '../project/model';

// Visible, source-bound helpers for the existing ideal ADC profile. This is not
// a physical ESP32 calibration library; keep that distinction in every export.
export const cppS3Analog=`// MIT. ESP32 Lab: linearni 12-bitni ADC, 11 dB, puni raspon 3,1 V.
// Fizicki ESP32: koristi izmjeren/kalibriran napon umjesto idealnog modela.
#pragma once
#include <Arduino.h>
#include <math.h>
const int LAB_ADC_MAX = 4095;
const float LAB_ADC_FULL_SCALE_V = 3.1f;
const float LAB_INPUT_SUPPLY_V = 3.3f;

void labAnalogBegin(uint8_t pin) {
  analogReadResolution(12);
  analogSetPinAttenuation(pin, ADC_11db);
}
float labVoltage(int raw) {
  return raw * LAB_ADC_FULL_SCALE_V / LAB_ADC_MAX;
}
// Djelilo: VCC -> fiksnih 10 kOhm -> AO -> NTC -> GND.
// Napajanje djelila je 3,3 V; puni ADC raspon je 3,1 V.
// R25=10 kOhm i Beta=3950 K moraju odgovarati svojstvima sklopa.
float labNtcTemperature(int raw) {
  if (raw <= 0 || raw >= LAB_ADC_MAX) return NAN;
  float u = labVoltage(raw);
  float r = 10000.0f * u / (LAB_INPUT_SUPPLY_V - u);
  return 1.0f / (1.0f / 298.15f + log(r / 10000.0f) / 3950.0f) - 273.15f;
}
// Normalizacija prema napajanju joysticka. Mrtva zona: |N| < 0,10
// (oko +/-5% hoda oko sredine 50%). Iznad 3,1 V ADC je zasicen.
float labJoystickAxis(int raw) {
  float value = 2.0f * labVoltage(raw) / LAB_INPUT_SUPPLY_V - 1.0f;
  return fabs(value) < 0.10f ? 0 : value;
}
`;
const head=`#include "lab_analog.h"
// Analogni ulazi: GPIO1/2. LM35 napajaj s 5 V, ostale ulazne module s 3,3 V.
// Spoji zajednicki GND. Program cita elektricne GPIO/ADC ulaze sklopa.
`;
export const s3AnalogExamples={
 lm35:{title:'S3 C++ · LM35, napon i temperatura',hint:'VCC=5 V, GND, OUT=GPIO1. Program čita 12-bitni ADC pri 11 dB te u vidljivom lab_analog.h računa U=raw·3,1/4095 i T=U/0,010. Napajanje LM35 nije ADC referenca. Za 25 °C očekuj oko 330 i 25 °C; fizički ADC zahtijeva kalibraciju.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); }
void loop() {
  int raw = analogRead(1);
  float u = labVoltage(raw);
  Serial.print("S3 LM35 ADC="); Serial.print(raw);
  Serial.print(" U="); Serial.print(u,3);
  Serial.print(" T="); Serial.println(u / 0.010f,2);
  delay(300);
}
`},
 temt6000:{title:'S3 C++ · TEMT6000 i zasićenje',hint:'VCC=3,3 V, AO=GPIO1. Nominalni model 0,5 µA/lx i 10 kΩ daje oko 0,5 V pri 100 lx. Program ispisuje ADC, napon i SAT=1 na gornjoj ADC granici 3,1 V. To nije izmjeren broj luksa; fizički senzor i ADC traže kalibraciju.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); }
void loop() {
  int raw = analogRead(1);
  Serial.print("S3 TEMT6000 ADC="); Serial.print(raw);
  Serial.print(" U="); Serial.print(labVoltage(raw),3);
  Serial.print(" SAT="); Serial.println(raw >= LAB_ADC_MAX);
  delay(300);
}
`},
 ntc:{title:'S3 C++ · NTC, djelilo i Beta',hint:'VCC=3,3 V, AO=GPIO1. Vidljivi helper koristi R25=10 kΩ, Beta=3950 K i djelilo s fiksnih 10 kΩ. Izračun napona koristi ADC raspon 3,1 V, a otpora napajanje 3,3 V. ADC 0 ili 4095 daje NaN i poruku granice. To ne dijagnosticira svaki loš spoj; pogledaj i dijagnostiku sklopa.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); }
void loop() {
  int raw = analogRead(1);
  Serial.print("S3 NTC ADC="); Serial.print(raw);
  Serial.print(" T="); Serial.println(labNtcTemperature(raw),2);
  if (raw <= 0 || raw >= LAB_ADC_MAX) Serial.println("NTC GRANICA: provjeri spoj ili ADC zasicenje");
  delay(300);
}
`},
 ky023:{title:'S3 C++ · KY-023, dvije osi i tipkalo',hint:'VCC=3,3 V; VRX=GPIO1, VRY=GPIO2, SW=GPIO5 uz INPUT_PULLUP. NX/NY računaju se prema napajanju 3,3 V, uz mrtvu zonu |N|<0,10 (oko ±5 % hoda). Gornji hod zasićuje ADC na 3,1 V: NX je najviše oko 0,88, SATX=1. Pritisak daje SW=0.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); labAnalogBegin(2); pinMode(5,INPUT_PULLUP); }
void loop() {
  int x = analogRead(1), y = analogRead(2);
  Serial.print("S3 JOY X="); Serial.print(x); Serial.print(" Y="); Serial.print(y);
  Serial.print(" NX="); Serial.print(labJoystickAxis(x),2);
  Serial.print(" NY="); Serial.print(labJoystickAxis(y),2);
  Serial.print(" SW="); Serial.print(digitalRead(5));
  Serial.print(" SATX="); Serial.print(x >= LAB_ADC_MAX);
  Serial.print(" SATY="); Serial.println(y >= LAB_ADC_MAX);
  delay(300);
}
`},
 flame:{title:'S3 C++ · plamen, AO i aktivan LOW',hint:'Lab profil: VCC=3,3 V, AO=GPIO1, DO=GPIO5. Relativna IR pobuda smanjuje AO. DO je aktivan LOW: uključuje pri 52 %, isključuje pri 48 %, a između čuva stanje. ADC se iznad 3,1 V zasićuje. Nema mjerenja temperature, udaljenosti ni opće tvrdnje o fizičkim modulima.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); pinMode(5,INPUT); }
void loop() {
  int raw = analogRead(1);
  Serial.print("S3 FLAME ADC="); Serial.print(raw);
  Serial.print(" DO="); Serial.println(digitalRead(5));
  delay(300);
}
`},
 sound:{title:'S3 C++ · zvuk, tropriključni DO profil',hint:'Lab profil s tri izvoda: VCC=3,3 V, GND i DO=GPIO5. Nema AO priključka. Relativna sintetska pobuda daje DO=0 pri ≥52 %, DO=1 pri ≤48 %; područje između čuva stanje. Program stvarno čita digitalni ulaz. Nema dB, mikrofona računala ni potvrde fizičke izvedbe.',code:head+`void setup() { Serial.begin(9600); pinMode(5,INPUT); }
void loop() {
  Serial.print("S3 SOUND DO="); Serial.println(digitalRead(5));
  delay(300);
}
`},
 analogCompare:{title:'S3 C++ · LM35 i NTC, usporedba',hint:'LM35: VCC=5 V, OUT=GPIO1. NTC: VCC=3,3 V, AO=GPIO2. Zajednička masa. Isti 12-bitni ADC čita različite karakteristike; helper sadrži napon, Beta i granice. Postavi oba okoliša na 25, zatim 50 °C. Pri promjeni R25/Beta/fiksnog otpornika uskladi konstante u lab_analog.h.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); labAnalogBegin(2); }
void loop() {
  int a = analogRead(1), b = analogRead(2);
  Serial.print("S3 COMPARE LM35="); Serial.print(labVoltage(a) / 0.010f,2);
  Serial.print(" NTC="); Serial.println(labNtcTemperature(b),2);
  if (b <= 0 || b >= LAB_ADC_MAX) Serial.println("NTC GRANICA: provjeri spoj ili ADC zasicenje");
  delay(300);
}
`},
 dualInputs:{title:'S3 C++ · dva potenciometra i dva tipkala',hint:'Potenciometri 1 kΩ: krajevi 3V3/GND, klizači GPIO1/2. Tipkala GPIO5/6 prema GND, INPUT_PULLUP; pritisak daje 0. Ulazi se mijenjaju neovisno tijekom rada. ADC 0–4095 zasićuje oko 94 % hoda (3,1/3,3); početnih 25/75 % daje oko 1090/3269.',code:head+`void setup() { Serial.begin(9600); labAnalogBegin(1); labAnalogBegin(2); pinMode(5,INPUT_PULLUP); pinMode(6,INPUT_PULLUP); }
void loop() {
  Serial.print("S3 DUAL A="); Serial.print(analogRead(1));
  Serial.print(" B="); Serial.print(analogRead(2));
  Serial.print(" S1="); Serial.print(digitalRead(5));
  Serial.print(" S2="); Serial.println(digitalRead(6));
  delay(300);
}
`},
} as const;

export function attachS3AnalogExample(p:Project,key:string) {
 if (!Object.hasOwn(s3AnalogExamples,key)) return;
 p.circuit=analogCircuit(key as AnalogExample);
 p.files['lab_analog.h']=cppS3Analog;
}
