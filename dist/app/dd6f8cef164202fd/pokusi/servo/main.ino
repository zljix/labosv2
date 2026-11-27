const int DRUGI_KUT = 90;

void setup() {
  Serial.begin(115200);
  ledcAttach(14, 50, 14);
}

void postavi(int kut) {
  long impuls = 1000 + kut * 1000L / 180;
  ledcWrite(14, impuls * 16383L / 20000);
  Serial.print("kut: "); Serial.print(kut);
  Serial.print(" impuls_us: "); Serial.println(impuls);
  delay(1500);
}

void loop() {
  postavi(30);
  postavi(DRUGI_KUT);
}
