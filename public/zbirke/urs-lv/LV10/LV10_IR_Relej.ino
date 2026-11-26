// LV10: najprije ocitaj kodove vlastitog IR daljinskog upravljaca.
#define IR_RECEIVE_PIN 2
#include <IRremote.hpp>

const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
const bool KODOVI_SPREMNI = false;  // true tek nakon provjere kodova.
const uint16_t ADRESA_DALJINSKOG = 0x0000;
const uint16_t NAREDBA_UKLJUCI = 0x0001;
const uint16_t NAREDBA_ISKLJUCI = 0x0002;
bool relejUkljucen = false;

void postaviRelej(bool ukljucen) {
  if (RELEJ_AKTIVAN_NA_LOW) {
    if (ukljucen) {
      digitalWrite(PIN_RELEJA, LOW);
    } else {
      digitalWrite(PIN_RELEJA, HIGH);
    }
  } else {
    if (ukljucen) {
      digitalWrite(PIN_RELEJA, HIGH);
    } else {
      digitalWrite(PIN_RELEJA, LOW);
    }
  }
}

void setup() {
  postaviRelej(false);
  pinMode(PIN_RELEJA, OUTPUT);
  Serial.begin(9600);
  IrReceiver.begin(IR_RECEIVE_PIN, DISABLE_LED_FEEDBACK);
}

void loop() {
  if (!IrReceiver.decode()) {
    return;  // Nema primljene poruke; loop() ce se ponovno pozvati.
  }

  // Sacuvaj poruku prije nego prijamniku dopustis novu poruku.
  // IRData je tip zapisa koji definira knjiznica IRremote.
  IRData poruka = IrReceiver.decodedIRData;
  IrReceiver.resume();

  Serial.print(F("protokol="));
  Serial.print(poruka.protocol);
  Serial.print(F(" adresa=0x"));
  Serial.print(poruka.address, HEX);
  Serial.print(F(" naredba=0x"));
  Serial.println(poruka.command, HEX);

  // & provjerava oznaku ponavljanja medju zastavicama poruke.
  bool novaPoruka = (poruka.flags & IRDATA_FLAGS_IS_REPEAT) == 0;
  if (KODOVI_SPREMNI && poruka.protocol != UNKNOWN && novaPoruka &&
      poruka.address == ADRESA_DALJINSKOG) {
    if (poruka.command == NAREDBA_ISKLJUCI) {
      relejUkljucen = false;
    } else if (poruka.command == NAREDBA_UKLJUCI) {
      relejUkljucen = true;
    }
  }
  postaviRelej(relejUkljucen);
}
