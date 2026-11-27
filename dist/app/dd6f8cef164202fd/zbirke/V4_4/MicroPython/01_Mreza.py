# V4.4 - Mjerenje tijekom čekanja mrežnog odgovora
# Potvrdi CLOSE i ACK -> Pauziraj nadzor -> vise od 6 s OFFLINE/AUTO -> Obnovi nadzor: ONLINE/AUTO, bez stare naredbe.
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
    return sirovo + korekcija
def moj_uvjet(temperatura):
    # Vrati je li temperatura <= 26.0.
    return temperatura <= 26.0
def moj_otvor(temperatura, prethodni):
    # True znaci OPEN; False znaci CLOSED. Izmedju pragova pamti prethodni.
    if temperatura >= PRAG_OTVARANJA_C:
        return True
    if temperatura <= PRAG_ZATVARANJA_C:
        return False
    return prethodni
def moj_alarm(temperatura, prethodni):
    # 30 i vise: True; 28 i manje: False; izmedju pamti.
    if temperatura >= 30.0:
        return True
    if temperatura <= 28.0:
        return False
    return prethodni
def moja_naredba(tekst):
    # Dopustene su tocno OPEN, CLOSE i AUTO.
    return False  # DOPUNI
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
DEVICE_ID = 'u07'
NETWORK_ENABLED = False
WIFI_SSID = 'UPISI_SSID'
WIFI_PASSWORD = 'UPISI_LOZINKU'
SERVER_IP = 'UPISI_IP'
SERVER_PORT = 8765

_m_postavke = _DioPrograma({
    'CONFIG': CONFIG,
    'DEVICE_ID': DEVICE_ID,
    'NETWORK_ENABLED': NETWORK_ENABLED,
    'SERVER_IP': SERVER_IP,
    'SERVER_PORT': SERVER_PORT,
    'SIM_SCENARIO': SIM_SCENARIO,
    'WIFI_PASSWORD': WIFI_PASSWORD,
    'WIFI_SSID': WIFI_SSID,
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
    return _DioPrograma({'async_sleep_ms': async_sleep_ms, 'ticks_diff': ticks_diff, 'ticks_ms': ticks_ms})

_m_vrijeme = _pripremi_vrijeme()

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

# Dio: vent_model
def _pripremi_vent_model():
    import math
    ticks_diff = _m_vrijeme.ticks_diff
    LabRecord = _m_lab_record.LabRecord

    def _number(value):
        return type(value) in (int, float) and math.isfinite(value)

    class VentModel:

        def __init__(self, config, io=None):
            self._config = dict(config) if isinstance(config, dict) else None
            self._io = io
            self._ready = False
            self._record = LabRecord(ticks_diff)
            self._target_open = False
            self._started = None
            self._last_start = None
            self._last = {'status': 'NOT_READY', 'value_c': None, 'raw_c': None, 'sequence': 0, 'completed_at_ms': None, 'source': config.get('source', 'DS18B20') if isinstance(config, dict) else 'DS18B20'}

        def _valid_config(self):
            c = self._config
            if not isinstance(c, dict) or not _number(c.get('offset_c')):
                return False
            if c.get('source') not in ('DS18B20', 'SIM'):
                return False
            for key, wanted in (('dq_pin', 4), ('led_pin', 21), ('servo_pin', 14)):
                if type(c.get(key)) is not int or c[key] != wanted:
                    return False
            if type(c.get('servo_enabled')) is not bool:
                return False
            period = c.get('sample_period_ms')
            if type(period) is not int or not 1000 <= period <= 60000:
                return False
            if not c['servo_enabled']:
                return True
            vals = [c.get(k) for k in ('servo_min_us', 'servo_max_us', 'closed_us', 'open_us')]
            if not all((type(v) is int for v in vals)):
                return False
            lo, hi, closed, opened = vals
            return 500 <= lo < hi <= 2500 and lo <= closed <= hi and (lo <= opened <= hi) and (closed != opened)

        def begin(self):
            if self._ready:
                return 'READY'
            if not self._valid_config():
                return 'BAD_CONFIG'
            try:
                if self._io is None:
                    create_io = _m_io_model.create_io
                    try:
                        SIM_SCENARIO = _m_postavke.SIM_SCENARIO
                    except ImportError:
                        SIM_SCENARIO = 'GRANICE'
                    self._io = create_io(self._config, SIM_SCENARIO)
                self._io.setup(self._config)
                self._io.apply_target(False)
            except (OSError, ValueError, ImportError):
                if self._io is not None:
                    self._io.close()
                return 'INIT_ERROR'
            self._ready = True
            self._target_open = False
            self._last['source'] = self._io.source
            return 'READY'

        def _publish(self, raw):
            valid = _number(raw) and -55 <= raw <= 125
            value = raw if self._io.source == 'SIM' else moja_korekcija(raw, self._config['offset_c']) if valid else None
            valid = valid and _number(value) and (-55 <= value <= 125)
            self._last = {'status': 'VALID' if valid else 'INVALID', 'value_c': value if valid else None, 'raw_c': raw if valid else None, 'sequence': self._last['sequence'] + 1, 'completed_at_ms': self._io.now_ms(), 'source': self._io.source}
            self._record.complete(value, valid, self._last['completed_at_ms'])
            return 'UPDATED'

        def tick(self, now_ms):
            if not self._ready:
                return 'NOT_READY'
            if self._started is not None:
                if ticks_diff(now_ms, self._started) < 750:
                    return 'BUSY'
                self._started = None
                try:
                    raw = self._io.read_temperature()
                except (OSError, ValueError):
                    raw = None
                return self._publish(raw)
            if self._last_start is not None and ticks_diff(now_ms, self._last_start) < self._config['sample_period_ms']:
                return 'IDLE'
            self._last_start = now_ms
            try:
                if not self._io.start_conversion():
                    return 'IDLE'
                self._started = self._io.now_ms()
                self._last_start = self._started
                return 'BUSY'
            except (OSError, ValueError):
                return self._publish(None)

        def reading(self):
            out = dict(self._last)
            now = self._io.now_ms() if self._io is not None else 0
            out.update(self._record.snapshot(now))
            out['control_usable'] = self._ready and out['control_usable']
            out['attempt_seq'] = self._last['sequence']
            out['target_state'] = 'OPEN' if self._target_open else 'CLOSED'
            return out

        def set_target(self, target_open):
            if not self._ready:
                return 'NOT_READY'
            if type(target_open) is not bool:
                return 'BAD_TARGET'
            self._io.apply_target(target_open)
            self._target_open = target_open
            return 'ACCEPTED'

        def target(self):
            return self._target_open

        def close(self):
            if self._io is not None:
                self._io.close()
            self._ready = False
            self._started = None
            self._last_start = None
            self._last = {'status': 'NOT_READY', 'value_c': None, 'raw_c': None, 'sequence': 0, 'completed_at_ms': None, 'source': self._last['source']}
    return _DioPrograma({'VentModel': VentModel})

_m_vent_model = _pripremi_vent_model()

# Dio: project_logic
def _pripremi_project_logic():
    import math
    ticks_diff = _m_vrijeme.ticks_diff
    OPEN_C = 27.0
    CLOSE_C = 26.0
    MAX_AGE_MS = 6000

    def is_usable(reading, now_ms, max_age_ms=6000):
        value = reading.get('value_c')
        completed = reading.get('completed_at_ms')
        if reading.get('status') != 'VALID' or type(value) not in (int, float) or (not math.isfinite(value)) or (not -55 <= value <= 125) or (type(completed) is not int):
            return False
        return 0 <= ticks_diff(now_ms, completed) <= max_age_ms

    def desired_state(usable, temperature_c, mode, target_open, command=None):
        if not usable:
            return ('AUTO', False)
        if command == 'AUTO':
            mode = 'AUTO'
        elif command in ('OPEN', 'CLOSE'):
            return ('MANUAL', command == 'OPEN')
        if mode == 'AUTO':
            target_open = moj_otvor(temperature_c, target_open)
        return (mode, target_open)
    return _DioPrograma({'desired_state': desired_state, 'is_usable': is_usable})

_m_project_logic = _pripremi_project_logic()

# Dio: framing
def _pripremi_framing():
    async def read_line(reader, max_bytes=2048):
        if type(max_bytes) is not int or max_bytes < 1:
            raise ValueError('Nevaljana granica retka')
        data = bytearray()
        while len(data) < max_bytes:
            chunk = await reader.read(1)
            if not chunk:
                raise OSError('EOF prije zavrsnog LF')
            data.extend(chunk)
            if chunk == b'\n':
                if len(data) == 1:
                    raise ValueError('Prazan redak')
                data.decode('utf-8')
                return bytes(data)
        raise ValueError('Redak je dulji od 2048 bajtova ukljucujuci LF')
    return _DioPrograma({'read_line': read_line})

_m_framing = _pripremi_framing()

# Dio: net_client
def _pripremi_net_client():
    import asyncio
    import json
    import math
    read_line = _m_framing.read_line

    def _json_finite(value):
        if type(value) is float:
            return math.isfinite(value)
        if isinstance(value, dict):
            return all((isinstance(k, str) and _json_finite(v) for k, v in value.items()))
        if isinstance(value, (list, tuple)):
            return all((_json_finite(v) for v in value))
        return value is None or type(value) in (bool, int, str)

    async def exchange(message, server_ip, server_port, timeout_ms=4000):
        if not _json_finite(message):
            raise ValueError('JSON ne smije sadrzavati NaN/inf ni nepodrzane tipove')
        line = (json.dumps(message) + '\n').encode('utf-8')
        if len(line) > 2048:
            raise ValueError('Odlazni redak prelazi 2048 bajtova')

        async def work():
            writer = None
            try:
                reader, writer = await asyncio.open_connection(server_ip, server_port)
                writer.write(line)
                await writer.drain()
                return await read_line(reader, 2048)
            finally:
                if writer is not None:
                    writer.close()
                    try:
                        await asyncio.wait_for(writer.wait_closed(), 0.25)
                    except (OSError, asyncio.TimeoutError):
                        pass
        return await asyncio.wait_for(work(), timeout_ms / 1000)

    def parse_and_validate_command(line, device_id, boot_id, last_cmd_id, expected_sequence):
        try:
            if not isinstance(line, (bytes, bytearray)) or not 1 < len(line) <= 2048 or (not line.endswith(b'\n')):
                return (None, 'BAD_MESSAGE')
            obj = json.loads(line.decode('utf-8'))
        except (ValueError, UnicodeError):
            return (None, 'BAD_JSON')
        if not isinstance(obj, dict):
            return (None, 'BAD_MESSAGE')
        if obj.get('device_id') != device_id:
            return (None, 'WRONG_DEVICE')
        if obj.get('boot_id') != boot_id:
            return (None, 'WRONG_BOOT')
        if type(obj.get('sequence')) is not int or obj['sequence'] != expected_sequence:
            return (None, 'WRONG_SEQUENCE')
        if obj.get('type') == 'app_paused':
            return (None, 'APP_PAUSED')
        if obj.get('type') == 'no_command':
            return (None, 'NO_COMMAND')
        if obj.get('type') != 'command':
            return (None, 'BAD_MESSAGE')
        ident = obj.get('cmd_id')
        if type(ident) is not int or ident <= 0:
            return (None, 'BAD_ID')
        if ident <= last_cmd_id:
            return (obj, 'DUPLICATE')
        if not moja_naredba(obj.get('command')):
            return (obj, 'BAD_ACTION')
        return ({'type': 'command', 'device_id': device_id, 'boot_id': boot_id, 'sequence': obj['sequence'], 'cmd_id': ident, 'command': obj['command']}, 'ACCEPTED')
    return _DioPrograma({'exchange': exchange, 'parse_and_validate_command': parse_and_validate_command})

_m_net_client = _pripremi_net_client()

# Dio: async_queue
def _pripremi_async_queue():
    import asyncio

    class AsyncQueue:

        def __init__(self, maxsize=4):
            if type(maxsize) is not int or maxsize < 1:
                raise ValueError('maxsize mora biti pozitivan cijeli broj')
            self.maxsize = maxsize
            self._items = []
            self._event = asyncio.Event()

        def put_nowait(self, item):
            if len(self._items) >= self.maxsize:
                return False
            self._items.append(item)
            self._event.set()
            return True

        async def get(self):
            while not self._items:
                self._event.clear()
                await self._event.wait()
            return self._items.pop(0)

        def qsize(self):
            return len(self._items)

        def clear(self):
            self._items[:] = []
            self._event.clear()
    return _DioPrograma({'AsyncQueue': AsyncQueue})

_m_async_queue = _pripremi_async_queue()

# Dio: wifi_podrska
def _pripremi_wifi_podrska():
    ticks_ms = _m_vrijeme.ticks_ms
    ticks_diff = _m_vrijeme.ticks_diff
    async_sleep_ms = _m_vrijeme.async_sleep_ms

    class WiFiLink:

        def __init__(self, settings):
            self.settings = settings
            self.wlan = None

        async def ensure(self):
            if not self.settings.NETWORK_ENABLED:
                return False
            if self.wlan is None:
                import network
                self.wlan = network.WLAN(network.STA_IF)
                self.wlan.active(True)
            if self.wlan.isconnected():
                return True
            self.wlan.connect(self.settings.WIFI_SSID, self.settings.WIFI_PASSWORD)
            started = ticks_ms()
            while not self.wlan.isconnected():
                if ticks_diff(ticks_ms(), started) > 5000:
                    self.wlan.disconnect()
                    return False
                await async_sleep_ms(100)
            return True
    return _DioPrograma({'WiFiLink': WiFiLink})

_m_wifi_podrska = _pripremi_wifi_podrska()

# Dio: main
def _pripremi_main():
    import sys
    import asyncio
    import json
    import os
    import binascii
    P = _m_postavke
    ticks_ms = _m_vrijeme.ticks_ms
    ticks_diff = _m_vrijeme.ticks_diff
    async_sleep_ms = _m_vrijeme.async_sleep_ms
    VentModel = _m_vent_model.VentModel
    is_usable = _m_project_logic.is_usable
    desired_state = _m_project_logic.desired_state
    exchange = _m_net_client.exchange
    parse_and_validate_command = _m_net_client.parse_and_validate_command
    AsyncQueue = _m_async_queue.AsyncQueue
    WiFiLink = _m_wifi_podrska.WiFiLink
    ALARM_ENABLED = False
    model = state = command_queue = transmit_queue = wifi = alarm_led = None

    def new_state():
        return {'mode': 'AUTO', 'target': False, 'usable': False, 'alarm_memory': False, 'alarm': 'UNKNOWN', 'generation': 0, 'connected': False, 'last_contact': None, 'last_cmd_id': 0, 'pending': None, 'ack': None, 'boot_id': binascii.hexlify(os.urandom(8)).decode()}

    def log(event, **details):
        details['t_ms'] = ticks_ms()
        print(event, json.dumps(details))

    def ack_for(command, accepted, reason):
        state['ack'] = {'cmd_id': command['cmd_id'], 'accepted': accepted, 'reason': reason, 'mode': state['mode'], 'target': 'OPEN' if state['target'] else 'CLOSED'}
        state['ack'].update(command_id=command['cmd_id'], command_status='ACCEPTED' if accepted else 'REJECTED', target_state='OPEN' if state['target'] else 'CLOSED', physical_state='UNKNOWN')
        log('ACK', **state['ack'])

    def invalidate(reason):
        state['generation'] += 1
        command_queue.clear()
        pending = state['pending']
        state['pending'] = None
        state['mode'] = 'AUTO'
        if reason in ('DISCONNECTED', 'SUPERVISION_TIMEOUT'):
            state['connected'] = False
            state['last_contact'] = None
        if pending is not None:
            ack_for(pending['command'], False, reason)
        log('PONISTENJE', reason=reason, generation=state['generation'])

    def snapshot():
        reading = model.reading()
        now = ticks_ms()
        usable = is_usable(reading, now)
        completed = reading['completed_at_ms']
        message = {'type': 'telemetry', 'device_id': P.DEVICE_ID, 'boot_id': state['boot_id'], 'sequence': reading['sequence'], 'source': reading['source'], 'valid': usable, 'temperature_c': reading['value_c'] if usable else None, 'attempt_age_ms': None if completed is None else ticks_diff(now, completed), 'mode': state['mode'], 'target': 'OPEN' if state['target'] else 'CLOSED'}
        for key in ('sample_seq', 'sample_time_ms', 'sample_age_ms', 'attempt_time_ms', 'attempt_age_ms', 'sample_value', 'sample_unit', 'sample_status', 'attempt_status', 'message_age_ms', 'message_age_reason', 'control_usable', 'estimated_state', 'physical_state'):
            message[key] = reading[key]
        message['communication_state'] = 'ONLINE' if state['connected'] else 'OFFLINE'
        message['app_online'] = state['connected']
        message['alarm_state'] = state.get('alarm', 'UNKNOWN')
        message['target_state'] = 'OPEN' if state['target'] else 'CLOSED'
        if state['ack'] is not None:
            message['ack'] = dict(state['ack'])
        return message

    async def local_task():
        while True:
            now = ticks_ms()
            if state['last_contact'] is not None and ticks_diff(now, state['last_contact']) > 6000:
                invalidate('SUPERVISION_TIMEOUT')
            event = model.tick(now)
            reading = model.reading()
            decision_now = ticks_ms()
            usable = is_usable(reading, decision_now)
            if state['usable'] and (not usable):
                invalidate('BAD_MEASUREMENT')
            state['usable'] = usable
            command = None
            pending = state['pending']
            state['pending'] = None
            reason = None
            if pending is not None:
                if pending['generation'] != state['generation']:
                    reason = 'STALE_GENERATION'
                elif not usable:
                    reason = 'BAD_MEASUREMENT'
                elif not state['connected']:
                    reason = 'DISCONNECTED'
                else:
                    command = pending['command']['command']
            if not state['connected']:
                state['mode'] = 'AUTO'
            mode, target = desired_state(usable, reading['value_c'], state['mode'], state['target'], command)
            target_status = model.set_target(target)
            if target_status != 'ACCEPTED':
                raise RuntimeError('CILJ_NIJE_PRIHVACEN: ' + str(target_status))
            state['mode'], state['target'] = (mode, target)
            if pending is not None:
                ack_for(pending['command'], reason is None, reason or 'ACCEPTED')
            if event == 'UPDATED':
                log('LOCAL_UPDATED', sample_seq=reading['sample_seq'], sample_time_ms=reading['sample_time_ms'], sequence=reading['sequence'], source=reading['source'], status=reading['status'], value_c=reading['value_c'], communication_state='ONLINE' if state['connected'] else 'OFFLINE', mode=state['mode'], target='OPEN' if target else 'CLOSED')
            await async_sleep_ms(20)

    async def telemetry_task():
        while True:
            transmit_queue.put_nowait(True)
            await async_sleep_ms(2000)

    async def network_task():
        while True:
            await transmit_queue.get()
            try:
                if not await wifi.ensure():
                    if state['connected']:
                        invalidate('DISCONNECTED')
                    await async_sleep_ms(1000)
                    continue
                message = snapshot()
                generation = state['generation']
                log('NET_SEND', sequence=message['sequence'], generation=generation)
                line = await exchange(message, P.SERVER_IP, P.SERVER_PORT, 4000)
                log('NET_REPLY', sequence=message['sequence'])
                if generation != state['generation']:
                    log('NET_REJECT', reason='STALE_GENERATION')
                    continue
                command, reason = parse_and_validate_command(line, P.DEVICE_ID, state['boot_id'], state['last_cmd_id'], message['sequence'])
                if reason == 'APP_PAUSED':
                    log('APP_PAUSED', communication_state='ONLINE' if state['connected'] else 'OFFLINE')
                    continue
                if reason in ('NO_COMMAND', 'ACCEPTED', 'BAD_ACTION', 'DUPLICATE'):
                    state['connected'] = True
                    state['last_contact'] = ticks_ms()
                if command is not None and reason != 'ACCEPTED':
                    state['last_cmd_id'] = max(state['last_cmd_id'], command['cmd_id'])
                    ack_for(command, False, reason)
                elif command is not None:
                    item = {'line': line, 'sequence': message['sequence'], 'generation': generation}
                    if not command_queue.put_nowait(item):
                        log('NET_REJECT', reason='QUEUE_FULL')
                elif reason != 'NO_COMMAND':
                    log('NET_REJECT', reason=reason)
            except (OSError, ValueError, asyncio.TimeoutError) as error:
                invalidate('DISCONNECTED')
                log('NET_ERROR', error=str(error))
                await async_sleep_ms(1000)

    async def command_task():
        while True:
            if state['pending'] is not None:
                await async_sleep_ms(20)
                continue
            item = await command_queue.get()
            command, reason = parse_and_validate_command(item['line'], P.DEVICE_ID, state['boot_id'], state['last_cmd_id'], item['sequence'])
            if command is None:
                log('COMMAND_REJECT', reason=reason)
            elif reason != 'ACCEPTED':
                state['last_cmd_id'] = max(state['last_cmd_id'], command['cmd_id'])
                ack_for(command, False, reason)
            else:
                state['last_cmd_id'] = command['cmd_id']
                if item['generation'] != state['generation']:
                    ack_for(command, False, 'STALE_GENERATION')
                elif not state['usable']:
                    ack_for(command, False, 'BAD_MEASUREMENT')
                elif not state['connected']:
                    ack_for(command, False, 'DISCONNECTED')
                else:
                    state['pending'] = {'command': command, 'generation': item['generation']}
            await async_sleep_ms(20)

    async def main():
        nonlocal model, state, command_queue, transmit_queue, wifi, alarm_led
        state = new_state()
        command_queue, transmit_queue = (AsyncQueue(4), AsyncQueue(1))
        wifi = WiFiLink(P)
        model = VentModel(P.CONFIG)
        tasks = []
        try:
            result = model.begin()
            if result != 'READY':
                raise ValueError('begin: ' + result)
            print('SIMULACIJA - NIJE MJERENJE' if P.CONFIG['source'] == 'SIM' else 'STVARNO MJERENJE DS18B20')
            for function in (local_task, telemetry_task, network_task, command_task):
                tasks.append(asyncio.create_task(function()))
            await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                task.cancel()
            if alarm_led is not None:
                alarm_led.value(0)
            if model is not None:
                model.close()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('Zaustavljeno; odspoji oba izvora.')
    return _DioPrograma({})

_m_main = _pripremi_main()
