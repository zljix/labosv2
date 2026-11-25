# V4.1 - Napiši korekciju i odluku otvora
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# Ucenicke funkcije odmah su ispod ovih uputa; okvir je vec pripremljen.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
# UCENIK - vlastite kratke funkcije ove vjezbe
PRAG_OTVARANJA_C = 27.0
PRAG_ZATVARANJA_C = 26.0
def moja_korekcija(sirovo, korekcija):
    # Vrati zbroj dvaju ulaza.
    return float("nan")  # DOPUNI
def moj_uvjet(temperatura):
    # Vrati je li temperatura <= 26.0.
    return False  # DOPUNI
def moj_otvor(temperatura, prethodni):
    # True znaci OPEN; False znaci CLOSED. Izmedju pragova pamti prethodni.
    return False  # DOPUNI
def moj_alarm(temperatura, prethodni):
    # 30 i vise: True; 28 i manje: False; izmedju pamti.
    if temperatura >= 30.0:
        return True
    if temperatura <= 28.0:
        return False
    return prethodni
def moja_naredba(tekst):
    # Dopustene su tocno OPEN, CLOSE i AUTO.
    return tekst in ("OPEN", "CLOSE", "AUTO")
# KRAJ UCENICKIH FUNKCIJA

# Kratki racunski pokusi bez fizickih izlaza
print("PROVJERA KOREKCIJA", moja_korekcija(24.8,0.5), moja_korekcija(26.0,0.0))
print("PROVJERA UVJET", moj_uvjet(25.9), moj_uvjet(26.1))
_cilj=False
for _t in (27.0,26.5,26.0):
    _cilj=moj_otvor(_t,_cilj)
    print("PROVJERA OTVOR",_t,"OPEN" if _cilj else "CLOSED")
_nevaljano = None
_nevaljan_cilj = moj_otvor(_nevaljano, True) if type(_nevaljano) in (int, float) else False
print("PROVJERA OTVOR nevaljano", "OPEN" if _nevaljan_cilj else "CLOSED", "- zastita okvira")
print("PROVJERA IZ CLOSED",27,moj_otvor(27,False),28,moj_otvor(28,False))
_alarm=False
for _t in (30.0,29.0,28.0):
    _alarm=moj_alarm(_t,_alarm)
    print("PROVJERA ALARM",_t,"ON" if _alarm else "OFF")


class _DioPrograma:
    def __init__(self, vrijednosti):
        for naziv, vrijednost in vrijednosti.items():
            setattr(self, naziv, vrijednost)

# POSTAVKE VJEZBE - mijenjaj samo retke navedene u Wordu.
CONFIG = {
    'dq_pin': 4,
    'led_pin': 21,
    'servo_pin': 14,
    'offset_c': 0.0,
    'servo_enabled': False,
    'servo_min_us': 0,
    'servo_max_us': 0,
    'closed_us': 0,
    'open_us': 0,
    'sample_period_ms': 2000,
    'source': 'SIM',
}
SIM_SCENARIO = 'GRANICE'

_m_postavke = _DioPrograma({
    'CONFIG': CONFIG,
    'SIM_SCENARIO': SIM_SCENARIO,
})

# PRIPREMLJENI DIO PROGRAMA

# Dio: vrijeme
def _pripremi_vrijeme():
    import time
    try:
        ticks_ms = time.ticks_ms
        ticks_diff = time.ticks_diff
        sleep_ms = time.sleep_ms
    except AttributeError:
        _PERIOD = 1 << 30

        def ticks_ms():
            return int(time.monotonic() * 1000) % _PERIOD

        def ticks_diff(a, b):
            return (a - b + _PERIOD // 2) % _PERIOD - _PERIOD // 2

        def sleep_ms(ms):
            time.sleep(ms / 1000)

    async def async_sleep_ms(ms):
        import asyncio
        await asyncio.sleep(ms / 1000)
    return _DioPrograma({'sleep_ms': sleep_ms, 'ticks_diff': ticks_diff, 'ticks_ms': ticks_ms})

_m_vrijeme = _pripremi_vrijeme()

# Dio: scenariji
def _pripremi_scenariji():
    SCENARIJI = {name: [(8000, x) for x in (26.0, 27.0, 30.0, None, 29.0, 28.0)] for name in ('GRANICE', 'POGRESKA', 'SVJEZINA', 'ALARM', 'STALNO_29', 'ZAVRSNI')}
    return _DioPrograma({'SCENARIJI': SCENARIJI})

_m_scenariji = _pripremi_scenariji()

# Dio: io_model
def _pripremi_io_model():
    ticks_ms = _m_vrijeme.ticks_ms
    ticks_diff = _m_vrijeme.ticks_diff

    def _servo_config(cfg):
        if type(cfg.get('servo_enabled')) is not bool:
            raise ValueError('servo_enabled mora biti bool')
        if not cfg['servo_enabled']:
            return
        vals = [cfg.get(k) for k in ('servo_min_us', 'servo_max_us', 'closed_us', 'open_us')]
        if not all((type(v) is int for v in vals)):
            raise ValueError('Impulsi moraju biti cijeli brojevi mikrosekundi')
        lo, hi, closed, opened = vals
        if not (500 <= lo < hi <= 2500 and lo <= closed <= hi and (lo <= opened <= hi) and (closed != opened)):
            raise ValueError('Upisi odobrene razlicite polozaje i granice serva')

    class HardwareIO:

        def __init__(self):
            self.source = 'DS18B20'
            self.pwm = self.led = self.signal = self.ds = None
            self.rom = None
            self.servo_us = None
            self.config = None

        def setup(self, config):
            _servo_config(config)
            if (config.get('dq_pin'), config.get('led_pin'), config.get('servo_pin')) != (4, 21, 14):
                raise ValueError('Ovaj komplet koristi GPIO4/21/14')
            from machine import Pin, PWM
            self.config = dict(config)
            self.led = Pin(21, Pin.OUT, value=0)
            self.signal = Pin(14, Pin.OUT, value=0)
            try:
                if self.source == 'DS18B20':
                    import onewire
                    import ds18x20
                    self.ds = ds18x20.DS18X20(onewire.OneWire(Pin(4)))
                if config['servo_enabled']:
                    self.pwm = PWM(self.signal, freq=50, duty_ns=config['closed_us'] * 1000)
                    self.servo_us = config['closed_us']
            except Exception:
                self.close()
                raise

        def now_ms(self):
            return ticks_ms()

        def start_conversion(self):
            roms = [r for r in self.ds.scan() if r[0] == 40]
            if len(roms) != 1:
                raise OSError('Potreban je tocno jedan DS18B20')
            self.rom = roms[0]
            self.ds.convert_temp()
            return True

        def read_temperature(self):
            return self.ds.read_temp(self.rom)

        def apply_led(self, target_open):
            if type(target_open) is not bool:
                raise ValueError('Cilj mora biti bool')
            self.led.value(1 if target_open else 0)

        def apply_servo(self, target_open):
            if type(target_open) is not bool:
                raise ValueError('Cilj mora biti bool')
            if self.pwm is not None:
                us = self.config['open_us' if target_open else 'closed_us']
                if us != self.servo_us:
                    self.pwm.duty_ns(us * 1000)
                    self.servo_us = us
            return self.servo_us

        def apply_target(self, target_open):
            self.apply_led(target_open)
            self.apply_servo(target_open)

        def close(self):
            if self.led is not None:
                self.led.value(0)
            if self.pwm is not None:
                self.pwm.deinit()
                self.pwm = None
            self.servo_us = None
            if self.signal is not None:
                self.signal.value(0)

    class SimIO(HardwareIO):

        def __init__(self, scenario):
            super().__init__()
            SCENARIJI = _m_scenariji.SCENARIJI
            if scenario not in SCENARIJI:
                raise ValueError('Nepoznat SIM_SCENARIO')
            self.source = 'SIM'
            self.steps = SCENARIJI[scenario]
            self.step = 0
            self.since = None
            self.value = None

        def setup(self, config):
            self.config = dict(config)  # SIM ne pristupa GPIO ni servu.

        def apply_led(self, target_open):
            self.led_value = bool(target_open)

        def apply_servo(self, target_open):
            return None

        def close(self):
            pass

        def start_conversion(self):
            now = self.now_ms()
            if self.since is None:
                self.since = now
            duration, value = self.steps[self.step]
            if self.step < len(self.steps) - 1 and ticks_diff(now, self.since) >= duration:
                self.step += 1
                self.since = now
                duration, value = self.steps[self.step]
                print('SIM_KORAK', self.step + 1, value)
            self.value = value
            return value != 'PAUZA'

        def read_temperature(self):
            return self.value

    def create_io(config, scenario='GRANICE'):
        return SimIO(scenario) if config.get('source') == 'SIM' else HardwareIO()
    return _DioPrograma({'create_io': create_io})

_m_io_model = _pripremi_io_model()

# Dio: odluka
def _pripremi_odluka():
    import math
    OPEN_C = 27.0
    CLOSE_C = 26.0

    def automatic_target(temperature_c, previous_open):
        return moj_otvor(temperature_c, previous_open)

    def decide(temperature_c, valid, previous_open):
        if valid is not True or type(temperature_c) not in (int, float) or (not math.isfinite(temperature_c)) or (not -55 <= temperature_c <= 125):
            return False
        return automatic_target(temperature_c, previous_open)
    return _DioPrograma({'automatic_target': automatic_target, 'decide': decide})

_m_odluka = _pripremi_odluka()

# Dio: main
def _pripremi_main():
    import sys
    import math
    CONFIG = _m_postavke.CONFIG
    SIM_SCENARIO = _m_postavke.SIM_SCENARIO
    create_io = _m_io_model.create_io
    automatic_target = _m_odluka.automatic_target
    decide = _m_odluka.decide
    sleep_ms = _m_vrijeme.sleep_ms
    io = None

    def try_read_temperature():
        try:
            if not io.start_conversion():
                return (None, False)
            sleep_ms(750)
            raw = io.read_temperature()
            if type(raw) not in (int, float) or not math.isfinite(raw) or (not -55 <= raw <= 125):
                return (None, False)
            value = raw if io.source == 'SIM' else moja_korekcija(raw, CONFIG['offset_c'])
            if not math.isfinite(value) or not -55 <= value <= 125:
                return (None, False)
            return (value, True)
        except (OSError, ValueError):
            return (None, False)

    def apply_led(target_open):
        io.apply_led(target_open)

    def apply_servo(target_open):
        return io.apply_servo(target_open)

    def run():
        nonlocal io
        io = create_io(CONFIG, SIM_SCENARIO)
        previous_open = False
        try:
            io.setup(CONFIG)
            print('SIMULACIJA - NIJE MJERENJE' if CONFIG['source'] == 'SIM' else 'STVARNO MJERENJE DS18B20')
            while True:
                value, valid = try_read_temperature()
                target_open = decide(value, valid, previous_open)
                apply_led(target_open)
                pulse = apply_servo(target_open)
                previous_open = target_open
                print('SOURCE', io.source, 'TEMP', value, 'VALID', valid, 'TARGET', 'OPEN' if target_open else 'CLOSED', 'SERVO_US', pulse)
                sleep_ms(1250)
        finally:
            io.close()
    run()
    return _DioPrograma({})

_m_main = _pripremi_main()
