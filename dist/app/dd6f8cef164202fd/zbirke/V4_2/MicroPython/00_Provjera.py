# Programski testovi vlastite biblioteke; nema pristupa GPIO-u.
import math
import vent_model_ucenik as vm
checks=0
def check(ok,name):
    global checks
    checks+=1
    print('PASS' if ok else 'FAIL',name)
    if not ok: raise AssertionError(name)

class FakeIO:
    source='DS18B20'
    def __init__(self):
        self.ms=0;self.raw=24.8;self.writes=[];self.setups=0
    def now_ms(self): return self.ms
    def setup(self,config): self.setups+=1
    def apply_target(self,target): self.writes.append(target)
    def start_conversion(self): return True
    def read_temperature(self): return self.raw
    def close(self): pass

ok,value=vm.corrected_temperature(24.8,0.5)
check(ok and abs(value-25.3)<0.001,'S1 korekcija jednom')
for raw in (0,-55,125):
    check(vm.corrected_temperature(raw,0)==(True,raw),'S1 valjana granica ili nula')
for raw in (None,True,'25',float('nan'),float('inf'),-127,-55.1,125.1):
    check(vm.corrected_temperature(raw,0)==(False,None),'S1 nevaljan ulaz')
check(vm.corrected_temperature(125,0.5)==(False,None),'S1 rezultat izvan raspona')
check(vm.corrected_temperature(20,float('nan'))==(False,None),'S1 nevaljana korekcija')
c={'dq_pin':4,'led_pin':21,'servo_pin':14,'offset_c':0.5,'servo_enabled':True,
   'servo_min_us':1100,'servo_max_us':1700,'closed_us':1200,'open_us':1600,
   'sample_period_ms':2000,'source':'DS18B20'}
check(vm.select_pulse(False,c)==1200,'S2 zatvoreni impuls')
check(vm.select_pulse(True,c)==1600,'S2 otvoreni impuls')
for bad_target in (9,1,None,'OPEN'):
    check(vm.select_pulse(bad_target,c) is None,'S2 nedopusten tip cilja')
bad=dict(c);bad['open_us']=1800
check(vm.select_pulse(True,bad) is None,'S2 impuls izvan odobrenih granica')
io=FakeIO();model=vm.VentModel(c,io)
check(model.set_target(9)=='NOT_READY' and io.writes==[],'S3 spremnost ima prednost bez izlaza')
bad=dict(c);bad['offset_c']=float('nan');bad_io=FakeIO()
check(vm.VentModel(bad,bad_io).begin()=='BAD_CONFIG' and bad_io.setups==0 and not bad_io.writes,'inicijalizacija odbija prije pogona')
check(model.begin()=='READY','inicijalizacija')
check(model.set_target(True)=='ACCEPTED' and model.target() is True,'S3 prihvat cilja')
n=len(io.writes)
check(model.set_target(9)=='BAD_TARGET' and model.target() is True and len(io.writes)==n,'S3 odbijanje cuva cilj i izlaze')
check(model.tick(0)=='BUSY','ciklus zahtjev')
io.ms=749;check(model.tick(749)=='BUSY' and model.reading()['sequence']==0,'ciklus jos traje')
io.ms=750;check(model.tick(750)=='UPDATED' and model.reading()['sequence']==1 and abs(model.reading()['value_c']-25.3)<0.001,'ciklus korigirani rezultat')
copy=model.reading();copy['value_c']=-999
check(model.reading()['value_c']!=-999,'reading vraca kopiju')
check(vm.usable_reading(model.reading(),6750) and not vm.usable_reading(model.reading(),6751),'starost 6000 i 6001')
io.ms=2000;check(model.tick(2000)=='BUSY' and model.reading()['sequence']==1,'novi zahtjev cuva prethodni zapis')
io.ms=2750;io.raw=None
check(model.tick(2750)=='UPDATED' and model.reading()['sequence']==2 and model.reading()['status']=='INVALID','nevaljan pokus ima novi broj')
other=FakeIO();b=vm.VentModel(c,other);b.begin()
check(b.target() is False and model.target() is True,'objekti imaju zasebno stanje')
sim=FakeIO();sim.source='SIM';simmodel=vm.VentModel(c,sim);simmodel.begin();simmodel.tick(0);sim.ms=750;simmodel.tick(750)
check(abs(simmodel.reading()['value_c']-24.8)<0.001,'SIM se ne korigira drugi put')
print('REZULTAT',checks,'PASS; BIBLIOTEKA',vm.VERZIJA)
