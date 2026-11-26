// LV06: potenciometar odreduje kut servomotora SG90.
// Servo napaja vanjski izvor 5 V; GND izvora i Nano plocice je zajednicki.
#include <Servo.h>

Servo servo;
const byte PIN_POTENCIOMETRA = A0;
const byte PIN_SERVA = 9;
const int MIN_KUT = 20;
const int MAX_KUT = 160;

void setup() {
  Serial.begin(9600);
  servo.attach(PIN_SERVA);
  servo.write(90);  // Pocetni polozaj prije ocitavanja potenciometra.
  delay(500);
}

void loop() {
  int ocitanjePotenciometra = analogRead(PIN_POTENCIOMETRA);
  // map() preslikava raspon ADC-a 0-1023 u dopusteni raspon kuta.
  int zadaniKut = map(ocitanjePotenciometra, 0, 1023, MIN_KUT, MAX_KUT);
  servo.write(zadaniKut);

  Serial.print(F("ADC="));
  Serial.print(ocitanjePotenciometra);
  Serial.print(F(" kut="));
  Serial.println(zadaniKut);
  delay(50);
}
