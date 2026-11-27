// LV14: PWM upravljanje DC motorom preko L298N i zaustavljanje tipkom.
// STOP je programsko zaustavljanje modela, ne sigurnosni sklop stroja.
#include <util/atomic.h>

const byte PIN_POTENCIOMETRA = A0;
const byte PIN_PWM = 5;
const byte PIN_IN1 = 7;
const byte PIN_IN2 = 8;
const byte PIN_STOP = 2;
// volatile: ovu varijablu mijenja i prekidna funkcija.
volatile bool zahtjevZaStop = false;
bool zaustavljeno = false;
bool pokretanjeDopusteno = false;
unsigned long vrijemeZadnjegIspisa = 0;

void prekidStop() {
  zahtjevZaStop = true;  // U prekidu samo zabiljezi zahtjev.
}

void setup() {
  pinMode(PIN_PWM, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  analogWrite(PIN_PWM, 0);
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  pinMode(PIN_STOP, INPUT_PULLUP);
  Serial.begin(9600);
  attachInterrupt(digitalPinToInterrupt(PIN_STOP), prekidStop, FALLING);
}

void loop() {
  bool zaprimljenStop;
  // Citaj i obrisi zahtjev kao jednu cjelinu, bez prekida izmedju.
  // Na izlasku iz bloka vraca se prethodno stanje prekida.
  ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
    zaprimljenStop = zahtjevZaStop;
    zahtjevZaStop = false;
  }
  if (zaprimljenStop || digitalRead(PIN_STOP) == LOW) {
    zaustavljeno = true;  // Ostaje true do reseta plocice.
  }

  int ocitanjePotenciometra = analogRead(PIN_POTENCIOMETRA);
  // Nakon ukljucivanja prvo vrati potenciometar blizu nule.
  if (!zaustavljeno && ocitanjePotenciometra < 50) {
    pokretanjeDopusteno = true;
  }

  int pwm = 0;
  if (pokretanjeDopusteno && !zaustavljeno) {
    pwm = map(ocitanjePotenciometra, 0, 1023, 0, 255);
  }
  if (pwm < 45) {
    pwm = 0;  // Vrlo mali zadani PWM ovdje znaci mirovanje.
  }

  if (pwm > 0) {
    digitalWrite(PIN_IN1, HIGH);
  } else {
    digitalWrite(PIN_IN1, LOW);
  }
  digitalWrite(PIN_IN2, LOW);
  analogWrite(PIN_PWM, pwm);

  // Ispis ne mora nastati pri svakom prolasku kroz loop().
  if (millis() - vrijemeZadnjegIspisa >= 200) {
    vrijemeZadnjegIspisa = millis();
    Serial.print(F("ADC="));
    Serial.print(ocitanjePotenciometra);
    Serial.print(F(" PWM="));
    Serial.print(pwm);
    if (zaustavljeno) {
      Serial.println(F(" STOP"));
    } else if (pokretanjeDopusteno) {
      Serial.println(F(" RAD"));
    } else {
      Serial.println(F(" POSTAVI NULU"));
    }
  }
}
