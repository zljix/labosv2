const int DRUGA_SVJETLINA = 75;  // postotak uključenja
const int DRUGI_KUT = 90;

void setup() {
  Serial.begin(115200);
  ledcAttach(21, 1000, 8);
  ledcAttach(14, 50, 14);
}

void postavi(int kut, int postotak) {
  ledcWrite(21, postotak * 255 / 100);
  Serial.print("PWM %: "); Serial.println(postotak);
  long impuls = 1000 + kut * 1000L / 180;
  ledcWrite(14, impuls * 16383L / 20000);
  Serial.print("kut: "); Serial.print(kut);
  Serial.print(" impuls_us: "); Serial.println(impuls);
  delay(1500);
}

void loop() {
  postavi(30, 15);
  postavi(DRUGI_KUT, DRUGA_SVJETLINA);
}
