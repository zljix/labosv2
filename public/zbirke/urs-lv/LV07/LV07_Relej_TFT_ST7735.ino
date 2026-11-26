// LV07: tipka mijenja stanje releja, a TFT prikazuje isto stanje.
// Kontakti COM/NO/NC ostaju prazni; ne prikljucuj mrezni napon.
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

Adafruit_ST7735 tft(10, 9, 8);  // CS, DC, RST.
const byte PIN_TIPKE = 4;
const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
bool relejUkljucen = false;
bool prethodnoOcitanje = HIGH;
bool stabilnoStanjeTipke = HIGH;
unsigned long vrijemePromjeneTipke = 0;

// Logicko stanje prevodimo u razinu koju trazi konkretni modul.
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

void prikaziStanje() {
  postaviRelej(relejUkljucen);
  tft.fillScreen(ST77XX_BLACK);
  tft.setCursor(8, 10);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE);
  tft.print("RELEJ");

  if (relejUkljucen) {
    tft.fillCircle(64, 64, 22, ST77XX_GREEN);
  } else {
    tft.fillCircle(64, 64, 22, ST77XX_RED);
  }
  tft.setCursor(18, 104);
  if (relejUkljucen) {
    tft.print("UKLJUCEN");
  } else {
    tft.print("ISKLJUCEN");
  }
}

void setup() {
  // Iskljucenu razinu pripremamo prije postavljanja pina kao izlaza.
  postaviRelej(false);
  pinMode(PIN_RELEJA, OUTPUT);
  pinMode(PIN_TIPKE, INPUT_PULLUP);  // Pritisnuta tipka daje LOW.
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  prikaziStanje();
}

void loop() {
  bool ocitanjeTipke = digitalRead(PIN_TIPKE);
  if (ocitanjeTipke != prethodnoOcitanje) {
    prethodnoOcitanje = ocitanjeTipke;
    vrijemePromjeneTipke = millis();
  }

  // Priznaj promjenu tek kada kontakt miruje najmanje 30 ms.
  if (millis() - vrijemePromjeneTipke >= 30 &&
      ocitanjeTipke != stabilnoStanjeTipke) {
    stabilnoStanjeTipke = ocitanjeTipke;
    if (stabilnoStanjeTipke == LOW) {
      if (relejUkljucen) {
        relejUkljucen = false;
      } else {
        relejUkljucen = true;
      }
      prikaziStanje();  // Relej i prikaz mijenjaju se istim pritiskom.
    }
  }
}
