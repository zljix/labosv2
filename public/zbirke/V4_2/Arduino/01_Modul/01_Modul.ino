// V4.2 Prva uporaba vlastite biblioteke
// V4.2/V4.3: jedna instalirana biblioteka; ovdje nema njezine implementacije.
#include <Arduino.h>
#include <cmath>
#include <initializer_list>
#include <VentModelUcenik.h>
#include <LabHardware.h>

constexpr bool SIMULACIJA = true;
constexpr bool SENZOR_ODOBREN = false;
constexpr bool SERVO_OMOGUCEN = false;
static_assert(!(SIMULACIJA && SENZOR_ODOBREN), "Odaberi samo jedan izvor");
constexpr Config ODOBRENI_MODEL{0.0f,0,0,0,0,50,SERVO_OMOGUCEN};
constexpr float PRAG_OTVARANJA_C=27.0f;
constexpr float PRAG_ZATVARANJA_C=26.0f;

// Projektno pravilo iz V4.1 ostaje u glavnom programu.
bool mojOtvor(float t, bool prethodni) {
  if(t>=PRAG_OTVARANJA_C)return true;
  if(t<=PRAG_ZATVARANJA_C)return false;
  return prethodni;
}
bool autoTarget(float t, bool prethodni, bool uporabljivo) {
  return uporabljivo && std::isfinite(t) ? mojOtvor(t,prethodni) : false;
}
EspVentHardware stvarni;
SimVentHardware simulirani;
VentModel model(SIMULACIJA?static_cast<VentHardware&>(simulirani):static_cast<VentHardware&>(stvarni));
bool modelReady=false;
uint32_t started=0,lastSequence=0;
uint8_t nextEvent=0;
void setup() {
  Serial.begin(115200);
  Serial.printf("BIBLIOTEKA %s AUTOR %s IZVOR %s\n",libraryVersion(),libraryAuthor(),librarySource());
  for(float t : {27.0f,26.0f})
    Serial.printf("PROVJERA T=%.1f prethodni=%s cilj=%s\n",t,t==26?"OPEN":"CLOSED",mojOtvor(t,t==26)?"OPEN":"CLOSED");
  Serial.printf("PROVJERA nevaljano -> %s\n",autoTarget(NAN,true,false)?"OPEN":"CLOSED");
  if(!SIMULACIJA && !SENZOR_ODOBREN){Serial.println("SENZOR NIJE ODOBREN");return;}
  Config c=SIMULACIJA?Config{0,1200,1600,1100,1700,50,false}:ODOBRENI_MODEL;
  modelReady=model.begin(c)==InitStatus::Ready;
  started=millis();
  Serial.println(modelReady?"MODEL READY":"MODEL NIJE SPREMAN");
}
void loop() {
  if(!modelReady){yield();return;}
  const auto event=model.tick(millis());
  const Reading r=model.reading();
  const uint32_t now=millis();
  const bool usable=usableReading(r,now);
  Target desired=model.target();
  bool isNew=false;
  desired=autoTarget(r.valueC,model.target()==Target::Open,usable)?Target::Open:Target::Closed;
  const auto accepted=model.setTarget(desired);
  if(accepted!=CommandStatus::Accepted){Serial.println("CILJ NIJE PRIHVACEN");modelReady=false;return;}
  if(isNew)Serial.printf("DOGADJAJ %u zahtjev=%s uporabljivo=%d cilj=%s\n",nextEvent,nextEvent==1?"OPEN":"CLOSE",usable,model.target()==Target::Open?"OPEN":"CLOSED");
  if(event==PollStatus::Updated && r.sequence!=lastSequence){
    lastSequence=r.sequence;
    Serial.printf("%s seq=%lu status=%d t=%.3f target=%s\n",SIMULACIJA?"SIMULACIJA - NIJE MJERENJE":"SENZOR",(unsigned long)r.sequence,int(r.status),double(r.valueC),model.target()==Target::Open?"OPEN":"CLOSED");
  }
  yield();
}
