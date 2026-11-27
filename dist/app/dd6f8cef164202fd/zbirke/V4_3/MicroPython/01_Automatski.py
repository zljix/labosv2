# V4.3 Program A
# Na uredjaju ostaju ista vent_model_ucenik.py i lab_podrska.py.
# Ovaj program spremi kao main.py; potom napravi meki reset (Ctrl+D).
import vent_model_ucenik as vm
from lab_podrska import ticks_ms, ticks_diff, sleep_ms

CONFIG = {'dq_pin':4, 'led_pin':21, 'servo_pin':14,
          'offset_c':0.0, 'servo_enabled':False,
          'servo_min_us':0, 'servo_max_us':0, 'closed_us':0, 'open_us':0,
          'sample_period_ms':2000, 'source':'SIM'}
PRAG_OTVARANJA_C=27.0
PRAG_ZATVARANJA_C=26.0

# Projektno pravilo ostaje u glavnom programu.
def moj_otvor(t, prethodni):
    if t >= PRAG_OTVARANJA_C: return True
    if t <= PRAG_ZATVARANJA_C: return False
    return prethodni
def auto_target(t, prethodni, uporabljivo):
    return moj_otvor(t,prethodni) if uporabljivo else False

print('BIBLIOTEKA', vm.VERZIJA, 'AUTOR', vm.AUTOR,
      'IZVOR', getattr(vm, '__file__', 'vent_model_ucenik.py'))
print('PROVJERA 27/CLOSED', moj_otvor(27, False))
print('PROVJERA 26/OPEN', moj_otvor(26, True))
print('PROVJERA nevaljano', 'OPEN' if auto_target(None,True,False) else 'CLOSED')
model=vm.VentModel(CONFIG)
try:
    if model.begin()!='READY': raise RuntimeError('MODEL NIJE SPREMAN')
    print('SIMULACIJA - NIJE MJERENJE' if CONFIG['source']=='SIM' else 'STVARNO MJERENJE DS18B20')
    started=ticks_ms()
    next_event=0
    while True:
        event=model.tick(ticks_ms())
        r=model.reading()
        now=ticks_ms()
        usable=vm.usable_reading(r,now)
        target=model.target()
        is_new=False
        target=auto_target(r['value_c'],model.target(),usable)
        status=model.set_target(target)
        if status!='ACCEPTED': raise RuntimeError('CILJ NIJE PRIHVACEN: '+status)
        if is_new:
            print('DOGADJAJ',next_event,'zahtjev','OPEN' if next_event==1 else 'CLOSE',
                  'uporabljivo',usable,'cilj','OPEN' if target else 'CLOSED')
        if event=='UPDATED': print('UZORAK',r,'TARGET','OPEN' if target else 'CLOSED')
        sleep_ms(20)
finally:
    model.close()
