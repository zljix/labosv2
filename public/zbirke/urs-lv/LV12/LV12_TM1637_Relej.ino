// LV12: pritisak pokrece rad i odbrojavanje na pokazniku TM1637.
#include <TM1637Display.h>

TM1637Display pokaznik(3, 2);  // CLK, DIO.
const byte PIN_TIPKE = 4;
const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
const unsigned long TRAJANJE_RADA = 10000UL;  // 10 000 ms = 10 s.

// enum daje imena mogucim stanjima programa.
enum Stanje { SPREMNO, RAD, GOTOVO };
Stanje stanje = SPREMNO;
unsigned long pocetakRada = 0;
unsigned long vrijemePromjeneTipke = 0;
bool prethodnoOcitanje = HIGH;
bool stabilnoStanjeTipke = HIGH;

// Vraca true samo jednom za svaki priznati pritisak, ne dok se drzi.
bool novaTipkaPritisnuta() {
  bool ocitanjeTipke = digitalRead(PIN_TIPKE);
  if (ocitanjeTipke != prethodnoOcitanje) {
    prethodnoOcitanje = ocitanjeTipke;
    vrijemePromjeneTipke = millis();
  }
  if (millis() - vrijemePromjeneTipke >= 30 &&
      ocitanjeTipke != stabilnoStanjeTipke) {
    stabilnoStanjeTipke = ocitanjeTipke;
    return stabilnoStanjeTipke == LOW;
  }
  return false;
}

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
  pinMode(PIN_TIPKE, INPUT_PULLUP);
  pokaznik.setBrightness(4);
  pokaznik.showNumberDec(0, true);
  Serial.begin(9600);
}

void loop() {
  bool noviPritisak = novaTipkaPritisnuta();
  unsigned long sada = millis();

  if (noviPritisak && stanje != RAD) {
    stanje = RAD;
    pocetakRada = sada;
  }
  if (stanje == RAD && sada - pocetakRada >= TRAJANJE_RADA) {
    stanje = GOTOVO;
  }

  bool radUTijeku = stanje == RAD;
  postaviRelej(radUTijeku);
  unsigned long preostaloVrijeme = 0;
  if (radUTijeku) {
    preostaloVrijeme = TRAJANJE_RADA - (sada - pocetakRada);
  }
  // Zaokruzi ostatak na vise: zadnjih 1-999 ms prikazuje se kao 1 s.
  pokaznik.showNumberDec((preostaloVrijeme + 999) / 1000, true);
  // Nema delay(10000): loop() se i dalje vrti i osvjezava pokaznik.
  // Novi pritisci za vrijeme rada u pocetnoj izvedbi nemaju ucinak.
}
