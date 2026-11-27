// LV08: BMP180 mjeri temperaturu i tlak; potenciometar je MODEL razine.
#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_BMP085 bmp180;  // Ova knjiznica podrzava i BMP180.
Adafruit_SSD1306 oled(128, 32, &Wire, -1);
bool senzorPokrenut;
bool zaslonPokrenut;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Wire.setWireTimeout(25000, true);
  senzorPokrenut = bmp180.begin();
  zaslonPokrenut = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (zaslonPokrenut) {
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(1);
  }
}

void loop() {
  int razinaModela = map(analogRead(A0), 0, 1023, 0, 100);

  // Provjeri odgovara li senzor na svojoj I2C adresi.
  Wire.beginTransmission(0x77);
  bool senzorSpojen = Wire.endTransmission() == 0;
  float temperatura = NAN;  // NAN oznacava da nema valjanog broja.
  float tlak = NAN;
  if (senzorPokrenut && senzorSpojen) {
    temperatura = bmp180.readTemperature();
    tlak = bmp180.readPressure() / 100.0;  // Pa pretvaramo u hPa.
  }
  bool mjerenjeValjano = senzorSpojen && !isnan(temperatura) &&
                        tlak >= 300 && tlak <= 1100;

  Serial.print(F("Razina model="));
  Serial.print(razinaModela);
  if (mjerenjeValjano) {
    Serial.print(F(" % T="));
    Serial.print(temperatura, 1);
    Serial.print(F(" C p="));
    Serial.print(tlak, 1);
    Serial.println(F(" hPa"));
  } else {
    Serial.println(F(" % BMP180 GRESKA"));
  }

  // Ne pokusavaj crtati ako se OLED nije uspjesno pokrenuo.
  if (zaslonPokrenut) {
    oled.clearDisplay();
    oled.setCursor(0, 0);
    oled.print(F("RAZINA MODEL "));
    oled.print(razinaModela);
    oled.println('%');
    if (mjerenjeValjano) {
      oled.print(F("T "));
      oled.print(temperatura, 1);
      oled.println(F(" C"));
      oled.print(F("p "));
      oled.print(tlak, 1);
      oled.println(F(" hPa"));
    } else {
      oled.println(F("BMP180 GRESKA"));
    }
    oled.display();  // Tek sada prenesi pripremljeni prikaz na zaslon.
  }
  delay(1500);
}
