import {s3ExampleProject} from '../../src/runtime/s3Examples';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function environmentExample() {
  const project = s3ExampleProject('regulator');
  project.title='S3 · mjerenje temperature i vlage';
  project.settings.example='';
  project.circuit.components=project.circuit.components.filter(part=>part.id!=='servo1');
  project.circuit.wires=project.circuit.wires.filter(wire=>wire.from.component!=='servo1' && wire.to.component!=='servo1');
  Object.assign(project.files,{
    'main.ino': `#include <LabAHT10.h>
#include "mjerenje.h"

LabAHT10 senzor;

void setup() {
  Serial.begin(9600);
  Wire.begin(8, 9, 100000);
  if (!senzor.begin()) Serial.println("Provjeri AHT10");
  pripremiZaslon();
}

void loop() {
  float temperatura, vlaga;
  if (senzor.read(temperatura, vlaga)) {
    prikazi(temperatura, vlaga);
    ispisi(temperatura, vlaga);
  } else {
    Serial.println("Pogreska ocitanja");
  }
  delay(razmakMjerenja());
}
`,
    'ispis.ino': `void ispisi(float t, float h) {
  Serial.print("T=");
  Serial.print(t, 1);
  Serial.print(" C, RH=");
  Serial.print(h, 1);
  Serial.println(" %");
}
`,
    'mjerenje.h': `#pragma once
#ifdef __cplusplus
extern "C" {
#endif
unsigned razmakMjerenja(void);
#ifdef __cplusplus
}
void pripremiZaslon();
void prikazi(float t, float h);
void ispisi(float t, float h);
#endif
`,
    'src/interval.c': `#include "mjerenje.h"

unsigned razmakMjerenja(void) {
  return 500;
}
`,
    'src/prikaz.cpp': `#include <Arduino.h>
#include "mjerenje.h"
#include "lab_oled.h"

static LabOLED oled(Wire1);

void pripremiZaslon() {
  Wire1.begin(10, 11, 400000);
  oled.begin();
}

void prikazi(float t, float h) {
  oled.clear();
  oled.setCursor(0, 0);
  oled.print("T:"); oled.print(t, 1); oled.print(" C");
  oled.setCursor(0, 16);
  oled.print("RH:"); oled.print(h, 1); oled.print("%");
  oled.bar(h);
  oled.show();
}
`
  });
  return project;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  writeFileSync(process.argv[2],JSON.stringify(environmentExample(),null,2)+'\n');
