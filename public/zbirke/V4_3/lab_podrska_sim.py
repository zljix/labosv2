# PRIPREMLJENA POTPORA iz postojecih vjezbi; ucenik je ne prepisuje.
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

import math

def new_boot_id():
    import os
    import binascii
    if hasattr(os, 'urandom'):
        return binascii.hexlify(os.urandom(8)).decode()
    # U simulaciji preglednik daje slučajne bajtove kroz virtualnu datoteku.
    with open('/dev/urandom', 'rb') as izvor:
        return binascii.hexlify(izvor.read(8)).decode()

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

SCENARIJI = {name: [(8000, x) for x in (26.0, 27.0, 30.0, None, 29.0, 28.0)] for name in ('GRANICE', 'POGRESKA', 'SVJEZINA', 'ALARM', 'STALNO_29', 'ZAVRSNI')}





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
        if scenario not in SCENARIJI:
            raise ValueError('Nepoznat SIM_SCENARIO')
        self.source = 'SIM'
        self.steps = SCENARIJI[scenario]
        self.step = 0
        self.since = None
        self.value = None

    def setup(self, config):
        self.config = dict(config)

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
