const byte LED_PIN = LED_BUILTIN;
const unsigned long PAUSE_MS = 500;
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Nano je pokrenut.");
}
void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ukljucena");
  delay(PAUSE_MS);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED iskljucena");
  delay(PAUSE_MS);
}
