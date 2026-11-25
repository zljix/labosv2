const char PORUKA[] = "Pozdrav iz Labosa";
const int INTERVAL_MS = 1000;

void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.println(PORUKA);
  delay(INTERVAL_MS);
}
