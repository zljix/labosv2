#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(128, 32, &Wire, -1);
void setup() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    while (true) { }
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
}
void loop() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("URS - OLED");
  display.setTextSize(2);
  display.setCursor(0, 14);
  display.print(millis() / 1000);
  display.print(" s");
  display.display();
  delay(200);
}
