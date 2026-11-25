const int LED_PIN = 21;
const int UKLJUCENO_MS = 500;
const int ISKLJUCENO_MS = 500;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(UKLJUCENO_MS);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(ISKLJUCENO_MS);
}
