export const EXAMPLES = {
  blink: {title:'Blink i Serial', files:{'main.ino':`// Promijeni interval i poruku, zatim ponovno prevedi.
const unsigned long INTERVAL = 200;
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(9, OUTPUT);
  Serial.begin(9600);
  Serial.println("Moj offline program");
}
void loop() {
  digitalWrite(LED_BUILTIN, HIGH); digitalWrite(9, HIGH);
  Serial.print("ON "); Serial.println(millis());
  delay(INTERVAL);
  digitalWrite(LED_BUILTIN, LOW); digitalWrite(9, LOW);
  Serial.print("OFF "); Serial.println(millis());
  delay(INTERVAL);
}
`}},
  multi: {title:'Funkcija iz druge datoteke', files:{'main.ino':`#include "helper.h"
void setup() {
  Serial.begin(9600);
  Serial.print("REZULTAT=");
  Serial.println(dvostruko(21));
}
void loop() { delay(100); }
`, 'helper.h':'#pragma once\nint dvostruko(int broj);\n', 'helper.cpp':'#include "helper.h"\nint dvostruko(int broj) { return broj * 2; }\n'}},
  c: {title:'Zasebna C datoteka', files:{'main.ino':'extern "C" int zbroj(int a, int b);\nvoid setup() { Serial.begin(9600); Serial.println(zbroj(20, 22)); }\nvoid loop() { delay(100); }\n','helper.c':'int zbroj(int a, int b) { return a + b; }\n'}}
};
