// Virtualni daljinski upravljac salje NEC okvire. D2 biljezi rubove impulsa.
#pragma once
#include "LabNEC.h"
const uint8_t UNKNOWN = 0, DISABLE_LED_FEEDBACK = 0, IRDATA_FLAGS_IS_REPEAT = 1;
struct IRData {
  uint8_t protocol, address, command, flags;
};
static LabNEC decoder;
static uint8_t receiverPin;
static void receiveEdge() { decoder.edge(digitalRead(receiverPin)); }
class UrsReceiver {
public:
  IRData decodedIRData;
  void begin(uint8_t pin, uint8_t) {
    receiverPin = pin;
    pinMode(pin, INPUT);
    attachInterrupt(digitalPinToInterrupt(pin), receiveEdge, CHANGE);
  }
  bool decode() {
    bool repeat = false;
    if (!decoder.read(decodedIRData.address, decodedIRData.command, repeat)) return false;
    decodedIRData.protocol = 1;
    decodedIRData.flags = repeat ? IRDATA_FLAGS_IS_REPEAT : 0;
    return true;
  }
  void resume() { /* Dekoder nastavlja primati nakon read(). */ }
};
static UrsReceiver IrReceiver;
