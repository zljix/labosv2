const int PRAG = 1500;  // 12-bitni ADC: 0 do 4095

void setup() {
  Serial.begin(115200);
  pinMode(21, OUTPUT);
}
void loop() {
  int svjetlost = analogRead(1);
  bool tamno = svjetlost < PRAG;
  digitalWrite(21, tamno);
  Serial.print("ADC: "); Serial.print(svjetlost);
  Serial.print(" LED: "); Serial.println(tamno);
  delay(500);
}
