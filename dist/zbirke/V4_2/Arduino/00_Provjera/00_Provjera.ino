#include <VentModelUcenik.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <initializer_list>
#ifdef ARDUINO
#include <Arduino.h>
#define REPORT(...) Serial.printf(__VA_ARGS__)
#else
#define REPORT(...) std::printf(__VA_ARGS__)
#endif
int failures=0, checks=0;
void check(bool ok, const char* name){++checks;if(!ok)++failures;REPORT("%s %s\n",ok?"PASS":"FAIL",name);}
class FakeIO : public VentHardware {
public:
  uint32_t ms=0;float raw=24.8f;int writes=0,ledWrites=0,starts=0;bool attached=false,led=false,sensorOK=true;
  uint32_t now() const override{return ms;}
  bool sensorBegin() override{++starts;return sensorOK;}
  bool servoBegin(const Config&) override{attached=true;return true;}
  bool servoAttached() const override{return attached;}
  SensorRequest request() override{return {true,ms};}
  float readRaw() override{return raw;}
  void writePulse(int) override{++writes;}
  void targetLed(bool b) override{led=b;++ledWrites;}
};
void runTests(){
  float out=-999;
  check(correctedTemperature(24.8f,0.5f,out)&&std::fabs(out-25.3f)<0.001f,"S1 korekcija jednom");
  check(correctedTemperature(0,0,out)&&out==0,"S1 nula je valjana");
  check(correctedTemperature(-55,0,out)&&out==-55,"S1 donja granica");
  check(correctedTemperature(125,0,out)&&out==125,"S1 gornja granica");
  for(float raw:{NAN,INFINITY,-127.0f,-55.1f,125.1f}){
    out=-999;check(!correctedTemperature(raw,0,out)&&out==-999,"S1 nevaljan ulaz cuva izlaz");
  }
  out=-999;check(!correctedTemperature(125,0.5f,out)&&out==-999,"S1 rezultat izvan raspona");
  check(!correctedTemperature(20,NAN,out)&&out==-999,"S1 nevaljana korekcija");
  Config c{0.5f,1200,1600,1100,1700,50,true};int pulse=-999;
  check(selectPulse(Target::Closed,c,pulse)&&pulse==1200,"S2 zatvoreni impuls");
  check(selectPulse(Target::Open,c,pulse)&&pulse==1600,"S2 otvoreni impuls");
  pulse=-999;check(!selectPulse(static_cast<Target>(9),c,pulse)&&pulse==-999,"S2 nedopusten cilj cuva izlaz");
  Config bad=c;bad.openUs=1800;
  check(!selectPulse(Target::Open,bad,pulse)&&pulse==-999,"S2 impuls izvan odobrenih granica");
  FakeIO io;VentModel model(io);
  check(model.setTarget(static_cast<Target>(9))==CommandStatus::NotReady&&io.writes==0&&io.ledWrites==0,"S3 spremnost ima prednost bez izlaza");
  bad=c;bad.offsetC=NAN;
  FakeIO invalid;VentModel rejected(invalid);
  check(rejected.begin(bad)==InitStatus::BadConfig&&invalid.starts==0&&invalid.writes==0,"inicijalizacija odbija prije pogona");
  check(model.begin(c)==InitStatus::Ready,"inicijalizacija");
  check(model.setTarget(Target::Open)==CommandStatus::Accepted&&model.target()==Target::Open&&io.led,"S3 prihvat otvorenog cilja");
  int w=io.writes,l=io.ledWrites;
  check(model.setTarget(static_cast<Target>(9))==CommandStatus::BadTarget&&model.target()==Target::Open&&io.writes==w&&io.ledWrites==l,"S3 odbijanje cuva cilj i izlaze");
  check(model.tick(0)==PollStatus::Busy,"ciklus zahtjev");
  io.ms=749;check(model.tick(749)==PollStatus::Busy&&model.reading().sequence==0,"ciklus jos traje");
  io.ms=750;check(model.tick(750)==PollStatus::Updated&&model.reading().sequence==1&&std::fabs(model.reading().valueC-25.3f)<0.001f,"ciklus jedan korigirani rezultat");
  Reading copy=model.reading();copy.valueC=-999;
  check(copy.valueC==-999&&model.reading().valueC!=-999,"reading vraca kopiju");
  check(usableReading(model.reading(),6750)&&!usableReading(model.reading(),6751),"starost 6000 i 6001");
  io.ms=2000;check(model.tick(2000)==PollStatus::Busy&&model.reading().sequence==1,"novi zahtjev cuva prethodni zapis");
  io.raw=NAN;io.ms=2750;check(model.tick(2750)==PollStatus::Updated&&model.reading().sequence==2&&model.reading().status==ReadingStatus::Invalid,"nevaljan pokus ima novi broj");
  FakeIO other;VentModel b(other);Config noServo=c;noServo.servoEnabled=false;
  check(b.begin(noServo)==InitStatus::Ready&&b.target()==Target::Closed&&model.target()==Target::Open,"objekti imaju zasebno stanje");
  check(b.setTarget(Target::Open)==CommandStatus::Accepted&&other.writes==0&&other.led,"LED radi uz onemogucen servo");
  FakeIO wrap;VentModel wrapped(wrap);wrapped.begin(noServo);wrap.ms=0xffffff00u;
  wrapped.tick(wrap.ms);wrap.ms+=750u;
  check(wrapped.tick(wrap.ms)==PollStatus::Updated,"prijelaz brojac kroz nulu");
  REPORT("REZULTAT %d/%d PASS; BIBLIOTEKA %s\n",checks-failures,checks,libraryVersion());
}
#ifdef ARDUINO
void setup(){Serial.begin(115200);delay(1000);runTests();}
void loop(){yield();}
#else
int main(){runTests();return failures?1:0;}
#endif
