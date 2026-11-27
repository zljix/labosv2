# V1.9 - Pokreni temperaturno upravljani model
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# POKUS=0: stvarni senzor; POKUS=1/2: pripremljeni SIM niz iz Worda.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.

class _DioPrograma:
    def __init__(self, vrijednosti):
        for naziv, vrijednost in vrijednosti.items():
            setattr(self, naziv, vrijednost)

# POSTAVKE VJEZBE - mijenjaj samo retke navedene u Wordu.
POKUS = 0
ODOBRENA_KOREKCIJA_C = 0.0
ISPITNI_ULAZ = POKUS > 0
KOREKCIJA_C = 0.0 if ISPITNI_ULAZ else ODOBRENA_KOREKCIJA_C
SERVO_OMOGUCEN = False
SERVO_MIN_US = 0
SERVO_MAX_US = 0
SERVO_ZATVORENO_US = 0
SERVO_OTVORENO_US = 0
if POKUS == 1:
    ISPITNI_NIZ = ((4000, 'VALUE', 26.5), (4000, 'VALUE', 27), (4000, 'VALUE', 26.5), (4000, 'VALUE', 26), (4000, 'VALUE', 26.5))
elif POKUS == 2:
    ISPITNI_NIZ = ((4000, 'VALUE', 27), (4000, 'INVALID', None), (4000, 'VALUE', 26.5))
else:
    ISPITNI_NIZ = ((4000, 'VALUE', 26.0),)
GPIO_DQ = 4
GPIO_LED_CILJA = 21
GPIO_LED_ALARMA = 47
ALARM_LED = False
GPIO_SERVO = 14
SERVO_FREQ_HZ = 50
PRAG_OTVARANJA_C = 27.0
PRAG_ZATVARANJA_C = 26.0
UZORAK_MS = 2000
STAROST_MAX_MS = 6000
ISPIS_MS = 1000

_m_postavke = _DioPrograma({
    'ALARM_LED': ALARM_LED,
    'GPIO_DQ': GPIO_DQ,
    'GPIO_LED_ALARMA': GPIO_LED_ALARMA,
    'GPIO_LED_CILJA': GPIO_LED_CILJA,
    'GPIO_SERVO': GPIO_SERVO,
    'ISPIS_MS': ISPIS_MS,
    'ISPITNI_NIZ': ISPITNI_NIZ,
    'ISPITNI_ULAZ': ISPITNI_ULAZ,
    'KOREKCIJA_C': KOREKCIJA_C,
    'ODOBRENA_KOREKCIJA_C': ODOBRENA_KOREKCIJA_C,
    'POKUS': POKUS,
    'PRAG_OTVARANJA_C': PRAG_OTVARANJA_C,
    'PRAG_ZATVARANJA_C': PRAG_ZATVARANJA_C,
    'SERVO_FREQ_HZ': SERVO_FREQ_HZ,
    'SERVO_MAX_US': SERVO_MAX_US,
    'SERVO_MIN_US': SERVO_MIN_US,
    'SERVO_OMOGUCEN': SERVO_OMOGUCEN,
    'SERVO_OTVORENO_US': SERVO_OTVORENO_US,
    'SERVO_ZATVORENO_US': SERVO_ZATVORENO_US,
    'STAROST_MAX_MS': STAROST_MAX_MS,
    'UZORAK_MS': UZORAK_MS,
})

# PRIPREMLJENI DIO PROGRAMA

# Dio: lab_record
def _pripremi_lab_record():
    import math
    try:
        from time import ticks_diff, ticks_ms
    except ImportError:
        from time import monotonic

        def ticks_ms():
            return int(monotonic() * 1000)

        def ticks_diff(a, b):
            return a - b

    def new_boot_id():
        import os
        import binascii
        return binascii.hexlify(os.urandom(8)).decode()

    def local_device_id():
        try:
            import machine
            import binascii
            return binascii.hexlify(machine.unique_id()).decode()
        except (ImportError, AttributeError):
            import sys
            if sys.platform == 'esp32':
                raise
            return 'LOCAL_TEST'

    class LabRecord:

        def __init__(self, difference=None, device_id=None, boot_id=None):
            self.diff = difference or ticks_diff
            self.device_id = device_id or local_device_id()
            self.boot_id = boot_id or new_boot_id()
            self.sample_seq = 0
            self.sample_time_ms = self.attempt_time_ms = None
            self.sample_value = None
            self.attempt_status = 'UNKNOWN'

        def complete(self, value, valid, now):
            self.attempt_time_ms = now
            good = valid and type(value) in (int, float) and math.isfinite(value) and (-55 <= value <= 125)
            self.attempt_status = 'VALID' if good else 'INVALID'
            if good:
                self.sample_seq += 1
                self.sample_time_ms = now
                self.sample_value = value

        def snapshot(self, now, maximum=6000):
            age = None if self.sample_time_ms is None else self.diff(now, self.sample_time_ms)
            attempt_age = None if self.attempt_time_ms is None else self.diff(now, self.attempt_time_ms)
            status = 'UNKNOWN' if age is None else 'STALE' if age < 0 or age > maximum else 'VALID'
            return dict(device_id=self.device_id, boot_id=self.boot_id, sample_seq=self.sample_seq, sample_time_ms=self.sample_time_ms, sample_age_ms=age, attempt_time_ms=self.attempt_time_ms, attempt_age_ms=attempt_age, sample_value=self.sample_value, sample_unit='degC', sample_status=status, attempt_status=self.attempt_status, message_age_ms=None, message_age_reason='UNSYNCHRONIZED_CLOCKS', control_usable=status == 'VALID' and self.attempt_status == 'VALID', estimated_state='UNKNOWN', physical_state='UNKNOWN')
    return _DioPrograma({'LabRecord': LabRecord, 'ticks_ms': ticks_ms})

_m_lab_record = _pripremi_lab_record()

# Dio: logika
def _pripremi_logika():
    import math
    LabRecord = _m_lab_record.LabRecord
    ticks_ms = _m_lab_record.ticks_ms

    def broj(x):
        return type(x) in (int, float) and math.isfinite(x)

    def automatski_cilj(t, prethodno_otvoreno, donji=26.0, gornji=27.0):
        if not broj(t) or not broj(donji) or (not broj(gornji)) or (not donji < gornji):
            raise ValueError('Nevaljane temperature ili pragovi')
        if t >= gornji:
            return True
        if t <= donji:
            return False
        return bool(prethodno_otvoreno)

    class Model:

        def __init__(self, korekcija=0.0, donji=26.0, gornji=27.0):
            if not broj(korekcija) or not broj(donji) or (not broj(gornji)) or (donji >= gornji):
                raise ValueError('Nevaljana konfiguracija modela')
            self.korekcija, self.donji, self.gornji = (korekcija, donji, gornji)
            self.cilj = False
            self.sirovo = None
            self.temperatura = None
            self.status = 'NEMA_UZORKA'
            self.broj_uzorka = 0
            self.record = LabRecord()

        def uzorak(self, sirovo, now=None):
            self._ocitaj(sirovo)
            self.record.complete(self.temperatura, self.status == 'VALJANO', ticks_ms() if now is None else now)

        def _ocitaj(self, sirovo):
            self.broj_uzorka += 1
            if not broj(sirovo) or not -55 <= sirovo <= 125:
                self.pogreska('NEVALJANO')
                return
            t = sirovo + self.korekcija
            if not broj(t) or not -55 <= t <= 125:
                self.pogreska('NEVALJANA_KOREKCIJA')
                return
            self.sirovo, self.temperatura = (sirovo, t)
            self.status = 'VALJANO'
            self.cilj = automatski_cilj(t, self.cilj, self.donji, self.gornji)

        def pogreska(self, status='NEVALJANO'):
            self.sirovo = self.temperatura = None
            self.status = status
            self.cilj = False

        def provjeri_starost(self, starost_ms, granica_ms=6000):
            if self.status == 'VALJANO' and starost_ms > granica_ms:
                self.pogreska('ZASTARJELO')
    return _DioPrograma({'Model': Model})

_m_logika = _pripremi_logika()

# Dio: main
def _pripremi_main():
    import json
    from machine import Pin, PWM
    from time import ticks_ms, ticks_diff, sleep_ms
    import onewire
    import ds18x20
    Model = _m_logika.Model
    P = _m_postavke
    model = Model(P.KOREKCIJA_C, P.PRAG_ZATVARANJA_C, P.PRAG_OTVARANJA_C)
    led = Pin(P.GPIO_LED_CILJA, Pin.OUT, value=0)
    alarm = Pin(P.GPIO_LED_ALARMA, Pin.OUT, value=0) if P.ALARM_LED else None
    servo_pin = Pin(P.GPIO_SERVO, Pin.OUT, value=0)
    pwm = None
    senzor = None
    rom = None
    konverzija = False
    pocetak_konverzije = 0
    zadnji_pokus = ticks_ms()
    zadnji_uzorak = None
    zadnji_ispis = ticks_ms()
    indeks = 0
    pocetak_koraka = ticks_ms()
    zadnji_sim_uzorak = ticks_ms()
    prethodni_cilj = None
    try:
        if P.ISPITNI_ULAZ:
            if not P.ISPITNI_NIZ:
                raise ValueError('Prazan ispitni niz')
            for trajanje, vrsta, sirovo in P.ISPITNI_NIZ:
                if trajanje < 1000 or vrsta not in ('VALUE', 'INVALID', 'STALE'):
                    raise ValueError('Nevaljan ispitni korak')
            print('SIMULACIJA: ne prikazujemo fizicki izmjerenu temperaturu.')
        else:
            senzor = ds18x20.DS18X20(onewire.OneWire(Pin(P.GPIO_DQ)))
            print('STVARNO MJERENJE: DS18B20')
        if P.SERVO_OMOGUCEN:
            xs = (P.SERVO_MIN_US, P.SERVO_MAX_US, P.SERVO_ZATVORENO_US, P.SERVO_OTVORENO_US)
            if not all((type(x) is int and x > 0 for x in xs)):
                raise ValueError('Potrebna su cetiri odobrena servo impulsa')
            if not xs[0] < xs[1] < 1000000 // P.SERVO_FREQ_HZ:
                raise ValueError('Nevaljano podrucje serva')
            if not all((xs[0] <= x <= xs[1] for x in xs[2:])):
                raise ValueError('Polozaj izvan odobrenog podrucja')
            print('Pokretanje serva za 3 s; pocetni cilj ZATVORENO.')
            sleep_ms(3000)
            pwm = PWM(servo_pin, freq=P.SERVO_FREQ_HZ, duty_ns=P.SERVO_ZATVORENO_US * 1000)
        else:
            print('Servo nije omogucen. Senzor i LED mogu se provjeriti.')
        pocetak_koraka = ticks_ms()
        prvi_sim = True
        prvi_pokus = True
        while True:
            sada = ticks_ms()
            if P.ISPITNI_ULAZ:
                trajanje, vrsta, sirovo = P.ISPITNI_NIZ[indeks]
                if indeks < len(P.ISPITNI_NIZ) - 1 and ticks_diff(sada, pocetak_koraka) >= trajanje:
                    indeks += 1
                    pocetak_koraka = sada
                    prvi_sim = True
                    trajanje, vrsta, sirovo = P.ISPITNI_NIZ[indeks]
                if prvi_sim or ticks_diff(sada, zadnji_sim_uzorak) >= P.UZORAK_MS:
                    prvi_sim = False
                    zadnji_sim_uzorak = sada
                    if vrsta == 'VALUE':
                        model.uzorak(sirovo, sada)
                        zadnji_uzorak = sada
                    elif vrsta == 'INVALID':
                        model.uzorak(None, sada)
            else:
                if konverzija and ticks_diff(sada, pocetak_konverzije) >= 750:
                    konverzija = False
                    try:
                        model.uzorak(senzor.read_temp(rom), sada)
                        zadnji_uzorak = sada
                    except (OSError, ValueError) as err:
                        model.uzorak(None, sada)
                        print('Senzor:', err)
                if not konverzija and (prvi_pokus or ticks_diff(sada, zadnji_pokus) >= P.UZORAK_MS):
                    prvi_pokus = False
                    zadnji_pokus = sada
                    try:
                        roms = [r for r in senzor.scan() if r[0] == 40]
                        if len(roms) != 1:
                            raise ValueError('Potreban je tocno jedan DS18B20')
                        rom = roms[0]
                        senzor.convert_temp()
                        pocetak_konverzije = ticks_ms()
                        konverzija = True
                    except (OSError, ValueError) as err:
                        model.uzorak(None, sada)
                        print('Senzor:', err)
            if zadnji_uzorak is not None:
                model.provjeri_starost(ticks_diff(sada, zadnji_uzorak), P.STAROST_MAX_MS)
            led.value(model.cilj)
            if alarm is not None:
                alarm.value(model.status != 'VALJANO')
            if pwm is not None and model.cilj != prethodni_cilj:
                us = P.SERVO_OTVORENO_US if model.cilj else P.SERVO_ZATVORENO_US
                pwm.duty_ns(us * 1000)
                prethodni_cilj = model.cilj
            if ticks_diff(sada, zadnji_ispis) >= P.ISPIS_MS:
                zadnji_ispis = sada
                canonical = model.record.snapshot(sada, P.STAROST_MAX_MS)
                canonical.update(target_state='OPEN' if model.cilj else 'CLOSED', source='SIM' if P.ISPITNI_ULAZ else 'DS18B20')
                print('ZAPIS', json.dumps(canonical))
                print('SIM' if P.ISPITNI_ULAZ else 'MJERENJE', 'uzorak:', model.broj_uzorka, 'sirovo:', model.sirovo, 'korigirano:', model.temperatura, 'status:', model.status, 'cilj:', 'OTVORENO' if model.cilj else 'ZATVORENO', 'LED:', int(model.cilj))
            sleep_ms(10)
    finally:
        led.off()
        if alarm is not None:
            alarm.off()
        if pwm is not None:
            pwm.deinit()
        Pin(P.GPIO_SERVO, Pin.OUT, value=0)
    return _DioPrograma({})

_m_main = _pripremi_main()
