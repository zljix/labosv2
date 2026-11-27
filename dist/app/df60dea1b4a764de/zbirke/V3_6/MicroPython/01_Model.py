# V3.6 - Doradi raspored i izmjeri interval
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
ISPITNI_SCENARIJ = 'GRANICE'
UZORAK_MS = 2000
GPIO_DQ = 4
GPIO_LED_CILJA = 21
GPIO_SERVO = 14
GPIO_LED_ALARMA = 47
ALARM_LED = False
PRAG_OTVARANJA_C = 27.0
PRAG_ZATVARANJA_C = 26.0
ALARM_UKLJUCI_C = 30.0
ALARM_ISKLJUCI_C = 28.0
STAROST_MAX_MS = 6000
ISPIS_MS = 1000

_m_postavke = _DioPrograma({
    'ALARM_ISKLJUCI_C': ALARM_ISKLJUCI_C,
    'ALARM_LED': ALARM_LED,
    'ALARM_UKLJUCI_C': ALARM_UKLJUCI_C,
    'GPIO_DQ': GPIO_DQ,
    'GPIO_LED_ALARMA': GPIO_LED_ALARMA,
    'GPIO_LED_CILJA': GPIO_LED_CILJA,
    'GPIO_SERVO': GPIO_SERVO,
    'ISPIS_MS': ISPIS_MS,
    'ISPITNI_SCENARIJ': ISPITNI_SCENARIJ,
    'ISPITNI_ULAZ': ISPITNI_ULAZ,
    'KOREKCIJA_C': KOREKCIJA_C,
    'ODOBRENA_KOREKCIJA_C': ODOBRENA_KOREKCIJA_C,
    'POKUS': POKUS,
    'PRAG_OTVARANJA_C': PRAG_OTVARANJA_C,
    'PRAG_ZATVARANJA_C': PRAG_ZATVARANJA_C,
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
    return _DioPrograma({'LabRecord': LabRecord})

_m_lab_record = _pripremi_lab_record()

# Dio: logika
def _pripremi_logika():
    import math
    LabRecord = _m_lab_record.LabRecord

    def broj(x):
        return type(x) in (int, float) and math.isfinite(x)

    def automatski_cilj(t, prethodni, donji=26.0, gornji=27.0):
        if not all((broj(x) for x in (t, donji, gornji))) or donji >= gornji:
            raise ValueError('Nevaljani pragovi ili temperatura')
        if t >= gornji:
            return 'OPEN'
        if t <= donji:
            return 'CLOSED'
        return prethodni

    class Model:

        def __init__(self, korekcija=0.0, donji=26.0, gornji=27.0, starost_max=6000, alarm_donji=28.0, alarm_gornji=30.0, razlika=None):
            if not all((broj(x) for x in (korekcija, donji, gornji, alarm_donji, alarm_gornji))):
                raise ValueError('Konfiguracija mora sadrzavati konacne brojeve')
            if donji >= gornji or alarm_donji >= alarm_gornji:
                raise ValueError('Donji prag mora biti manji od gornjega')
            if type(starost_max) is not int or not 1000 <= starost_max <= 60000:
                raise ValueError('Nevaljana granica svjezine')
            self.korekcija = korekcija
            self.donji, self.gornji = (donji, gornji)
            self.alarm_donji, self.alarm_gornji = (alarm_donji, alarm_gornji)
            self.starost_max = starost_max
            self.razlika = razlika or (lambda a, b: a - b)
            self.seq = 0
            self.record = LabRecord(self.razlika)
            self.raw_c = self.temp_c = None
            self.status = 'NEMA_UZORKA'
            self.target = 'CLOSED'
            self.alarm_memory = False
            self.alarm = 'UNKNOWN'
            self.zadnji_pokus = None

        def _nevazeci(self, status):
            self.raw_c = self.temp_c = None
            self.status = status
            self.target = 'CLOSED'
            self.alarm = 'UNKNOWN'

        def uzorak(self, sirovo, sada, simulacija=False):
            self._ocitaj(sirovo, sada, simulacija)
            self.record.complete(self.temp_c, self.status == 'VALJANO', sada)

        def _ocitaj(self, sirovo, sada, simulacija=False):
            self.seq += 1
            self.zadnji_pokus = sada
            if not broj(sirovo) or not -55 <= sirovo <= 125:
                self._nevazeci('NEVALJANO')
                return
            t = sirovo if simulacija else sirovo + self.korekcija
            if not broj(t) or not -55 <= t <= 125:
                self._nevazeci('NEVALJANO')
                return
            self.raw_c, self.temp_c = (sirovo, t)
            self.status = 'VALJANO'
            self.target = automatski_cilj(t, self.target, self.donji, self.gornji)
            if t >= self.alarm_gornji:
                self.alarm_memory = True
            elif t <= self.alarm_donji:
                self.alarm_memory = False
            self.alarm = 'ON' if self.alarm_memory else 'OFF'

        def starost(self, sada):
            return None if self.zadnji_pokus is None else self.razlika(sada, self.zadnji_pokus)

        def provjeri_starost(self, sada):
            age = self.starost(sada)
            if self.status == 'VALJANO' and age is not None and (age > self.starost_max):
                self._nevazeci('ZASTARJELO')

        def zapis(self, sada):
            out = {'seq': self.seq, 'raw_c': self.raw_c, 'temp_c': self.temp_c, 'unit': 'degC', 'status': self.status, 'attempt_age_ms': self.starost(sada), 'target': self.target, 'led21': int(self.target == 'OPEN'), 'alarm': self.alarm, 'alarm_memory': self.alarm_memory}
            out.update(self.record.snapshot(sada, self.starost_max))
            out['attempt_seq'] = self.seq
            out['target_state'] = 'OPEN' if self.target == 'OPEN' else 'CLOSED'
            return out
    return _DioPrograma({'Model': Model})

_m_logika = _pripremi_logika()

# Dio: scenariji
def _pripremi_scenariji():
    SCENARIJI = {'GRANICE': ((8000, 'PAUZA', None, 'T0'), (8000, 'VALUE', 27, 'T1'), (8000, 'VALUE', 26.5, 'T2'), (8000, 'VALUE', 26, 'T3'), (8000, 'VALUE', 26.5, 'T4'), (8000, 'VALUE', 27, 'T5'), (8000, 'VALUE', None, 'T6'), (8000, 'VALUE', 26.5, 'T7'))}
    return _DioPrograma({'SCENARIJI': SCENARIJI})

_m_scenariji = _pripremi_scenariji()

# Dio: izvori
def _pripremi_izvori():
    from time import ticks_diff, ticks_ms

    def provjeri_interval(interval):
        if type(interval) is not int or not 1000 <= interval <= 60000:
            raise ValueError('UZORAK_MS mora biti cijeli broj 1000..60000')

    class Senzor:

        def __init__(self, gpio=4, interval=2000):
            from machine import Pin
            import onewire
            import ds18x20
            provjeri_interval(interval)
            self.ds = ds18x20.DS18X20(onewire.OneWire(Pin(gpio)))
            self.interval = interval
            self.zadnji_start = self.pocetak = None
            self.rom = None
            self.u_tijeku = False
            self.error = None
            self.step, self.label = (0, 'DS18B20')

        def poll(self, sada):
            if self.u_tijeku and ticks_diff(sada, self.pocetak) >= 750:
                self.u_tijeku = False
                try:
                    x = self.ds.read_temp(self.rom)
                    self.error = None
                    return (True, x)
                except (OSError, ValueError) as err:
                    self.error = str(err)
                    return (True, None)
            if not self.u_tijeku and (self.zadnji_start is None or ticks_diff(sada, self.zadnji_start) >= self.interval):
                self.zadnji_start = sada
                try:
                    roms = [r for r in self.ds.scan() if r[0] == 40]
                    if len(roms) != 1:
                        raise ValueError('Potreban je tocno jedan DS18B20')
                    self.rom = roms[0]
                    self.ds.convert_temp()
                    self.pocetak = ticks_ms()
                    self.u_tijeku = True
                except (OSError, ValueError) as err:
                    self.error = str(err)
                    return (True, None)
            return (False, None)

    class Simulator:

        def __init__(self, naziv, interval=2000):
            SCENARIJI = _m_scenariji.SCENARIJI
            provjeri_interval(interval)
            if naziv not in SCENARIJI:
                raise ValueError('Nepoznat ISPITNI_SCENARIJ')
            self.koraci = SCENARIJI[naziv]
            for trajanje, vrsta, x, oznaka in self.koraci:
                if type(trajanje) is not int or trajanje < interval:
                    raise ValueError('Korak mora trajati barem UZORAK_MS')
                if vrsta not in ('VALUE', 'PAUZA'):
                    raise ValueError('Nepoznata vrsta koraka')
            self.interval = interval
            self.indeks = 0
            self.pocetak = self.zadnji = None
            self.step = 1
            self.label = self.koraci[0][3]
            self.error = None

        def poll(self, sada):
            if self.pocetak is None:
                self.pocetak = sada
            trajanje, vrsta, x, label = self.koraci[self.indeks]
            if self.indeks < len(self.koraci) - 1 and ticks_diff(sada, self.pocetak) >= trajanje:
                self.indeks += 1
                self.pocetak = sada
                self.zadnji = None
                trajanje, vrsta, x, label = self.koraci[self.indeks]
            self.step, self.label = (self.indeks + 1, label)
            if vrsta == 'PAUZA':
                return (False, None)
            if self.zadnji is None or ticks_diff(sada, self.zadnji) >= self.interval:
                self.zadnji = sada
                return (True, x)
            return (False, None)
    return _DioPrograma({'Senzor': Senzor, 'Simulator': Simulator, 'provjeri_interval': provjeri_interval})

_m_izvori = _pripremi_izvori()

# Dio: servo_sigurno
def _pripremi_servo_sigurno():
    from machine import Pin, PWM

    def provjeri_servo(omogucen, minimum, maksimum, start, target):
        if type(omogucen) is not bool:
            raise ValueError('Omogucenje serva mora biti True ili False')
        if not omogucen:
            return
        xs = (minimum, maksimum, start, target)
        if not all((type(x) is int for x in xs)):
            raise ValueError('Servo impulsi moraju biti cijeli brojevi u us')
        if not 500 <= minimum < maksimum <= 2500:
            raise ValueError('Upisi odobreni raspon; programske granice su 500..2500 us')
        if not all((minimum <= x <= maksimum for x in (start, target))):
            raise ValueError('START/CLOSE ili TARGET/OPEN izvan odobrenog raspona')

    class Servo:

        def __init__(self, gpio, omogucen, minimum, maksimum, start, target):
            self.gpio = gpio
            self.pwm = None
            self.us = None
            self.signal = Pin(gpio, Pin.OUT, value=0)
            provjeri_servo(omogucen, minimum, maksimum, start, target)
            self.minimum, self.maksimum = (minimum, maksimum)
            if omogucen:
                self.pwm = PWM(self.signal, freq=50, duty_ns=start * 1000)
                self.us = start

        def zadaj(self, us):
            if self.pwm is None:
                return
            if type(us) is not int or not self.minimum <= us <= self.maksimum:
                raise ValueError('Impuls izvan odobrenog raspona')
            if self.pwm is not None and self.us != us:
                self.pwm.duty_ns(us * 1000)
                self.us = us

        def zaustavi(self):
            if self.pwm is not None:
                self.pwm.deinit()
                self.pwm = None
            self.us = None
            Pin(self.gpio, Pin.OUT, value=0)
    return _DioPrograma({'Servo': Servo, 'provjeri_servo': provjeri_servo})

_m_servo_sigurno = _pripremi_servo_sigurno()

# Dio: main
def _pripremi_main():
    from machine import Pin
    from time import ticks_ms, ticks_diff, sleep_ms
    import json
    P = _m_postavke
    Model = _m_logika.Model
    Senzor = _m_izvori.Senzor
    Simulator = _m_izvori.Simulator
    provjeri_interval = _m_izvori.provjeri_interval
    Servo = _m_servo_sigurno.Servo
    provjeri_servo = _m_servo_sigurno.provjeri_servo

    def pokreni():
        for x in (P.SERVO_OMOGUCEN, P.ISPITNI_ULAZ, P.ALARM_LED):
            if type(x) is not bool:
                raise ValueError('Prekidaci moraju biti True ili False')
        provjeri_interval(P.UZORAK_MS)
        if type(P.ISPIS_MS) is not int or not 100 <= P.ISPIS_MS <= 10000:
            raise ValueError('Nevaljan ISPIS_MS')
        provjeri_servo(P.SERVO_OMOGUCEN, P.SERVO_MIN_US, P.SERVO_MAX_US, P.SERVO_ZATVORENO_US, P.SERVO_OTVORENO_US)
        model = Model(P.KOREKCIJA_C, P.PRAG_ZATVARANJA_C, P.PRAG_OTVARANJA_C, P.STAROST_MAX_MS, P.ALARM_ISKLJUCI_C, P.ALARM_UKLJUCI_C, ticks_diff)
        led = Pin(P.GPIO_LED_CILJA, Pin.OUT, value=0)
        alarm = Pin(P.GPIO_LED_ALARMA, Pin.OUT, value=0) if P.ALARM_LED else None
        Pin(P.GPIO_SERVO, Pin.OUT, value=0)
        servo = None
        try:
            if P.SERVO_OMOGUCEN:
                print('Servo pocinje u CLOSE nakon odgode; hod mora biti slobodan.')
                sleep_ms(3000)
            servo = Servo(P.GPIO_SERVO, P.SERVO_OMOGUCEN, P.SERVO_MIN_US, P.SERVO_MAX_US, P.SERVO_ZATVORENO_US, P.SERVO_OTVORENO_US)
            izvor = Simulator(P.ISPITNI_SCENARIJ, P.UZORAK_MS) if P.ISPITNI_ULAZ else Senzor(P.GPIO_DQ, P.UZORAK_MS)
            pocetak = ticks_ms()
            zadnji_ispis = None
            pocetni = True
            while True:
                sada = ticks_ms()
                novo = False
                if not pocetni:
                    novo, x = izvor.poll(sada)
                    if novo:
                        model.uzorak(x, sada, P.ISPITNI_ULAZ)
                model.provjeri_starost(sada)
                led.value(model.target == 'OPEN')
                if alarm is not None:
                    alarm.value(ticks_diff(sada, pocetak) // 500 % 2 if model.alarm == 'UNKNOWN' else model.alarm == 'ON')
                servo.zadaj(P.SERVO_OTVORENO_US if model.target == 'OPEN' else P.SERVO_ZATVORENO_US)
                if pocetni or novo or zadnji_ispis is None or (ticks_diff(sada, zadnji_ispis) >= P.ISPIS_MS):
                    zapis = model.zapis(sada)
                    if not P.ALARM_LED:
                        del zapis['alarm']
                        del zapis['alarm_memory']
                    zapis.update({'source': 'SIM' if P.ISPITNI_ULAZ else 'DS18B20', 't_ms': ticks_diff(sada, pocetak), 'servo_enabled': P.SERVO_OMOGUCEN, 'servo_us': servo.us, 'test_step': izvor.step, 'test_label': izvor.label, 'error': izvor.error})
                    print(json.dumps(zapis))
                    zadnji_ispis = sada
                pocetni = False
                sleep_ms(10)
        finally:
            led.off()
            if alarm is not None:
                alarm.off()
            if servo is not None:
                servo.zaustavi()
            else:
                Pin(P.GPIO_SERVO, Pin.OUT, value=0)
            print('Izlazi zaustavljeni; odspoji oba izvora prije promjene spoja.')
    pokreni()
    return _DioPrograma({})

_m_main = _pripremi_main()
