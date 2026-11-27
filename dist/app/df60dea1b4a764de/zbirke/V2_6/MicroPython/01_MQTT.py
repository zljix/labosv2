# V2.6 - Prikaži cjelovit povezan model
# Potvrdi CLOSE i ACK -> Pauziraj nadzor -> vise od 6 s OFFLINE/AUTO -> Obnovi nadzor: ONLINE/AUTO, bez stare naredbe.
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
UREDAJ_ID = 'u07'
WIFI_SSID = 'UPISI_SSID'
WIFI_LOZINKA = 'UPISI_LOZINKU'
MREZA_OMOGUCENA = False
SERVO_OMOGUCEN = False
SERVO_MIN_US = 0
SERVO_MAX_US = 0
SERVO_ZATVORENO_US = 0
SERVO_OTVORENO_US = 0
ISPITNI_SCENARIJ = 'POKUS_{}'.format(POKUS)
ISPITNA_TEMPERATURA_C = 25.8
UZORAK_MS = 2000
ALARM_UKLJUCI_C = 30.0
ALARM_ISKLJUCI_C = 28.0
GPIO_DQ = 4
GPIO_LED_CILJA = 21
GPIO_LED_ALARMA = 47
GPIO_SERVO = 14
SERVO_FREQ_HZ = 50
PRAG_OTVARANJA_C = 27.0
PRAG_ZATVARANJA_C = 26.0
STAROST_MAX_MS = 6000
VEZA_MAX_MS = 6000
ODGOVOR_MAX_MS = 6000
ALARM_OMOGUCEN = True
PROTOKOL = 'MQTT'
MQTT_BROKER = '192.168.1.10'
MQTT_PORT = 1883
OBJAVA_MS = 1000
TEMA_STATE = 'skola/iot/{}/state'.format(UREDAJ_ID)
TEMA_COMMAND = 'skola/iot/{}/command'.format(UREDAJ_ID)
TEMA_ACK = 'skola/iot/{}/ack'.format(UREDAJ_ID)

_m_postavke = _DioPrograma({
    'ALARM_ISKLJUCI_C': ALARM_ISKLJUCI_C,
    'ALARM_OMOGUCEN': ALARM_OMOGUCEN,
    'ALARM_UKLJUCI_C': ALARM_UKLJUCI_C,
    'GPIO_DQ': GPIO_DQ,
    'GPIO_LED_ALARMA': GPIO_LED_ALARMA,
    'GPIO_LED_CILJA': GPIO_LED_CILJA,
    'GPIO_SERVO': GPIO_SERVO,
    'ISPITNA_TEMPERATURA_C': ISPITNA_TEMPERATURA_C,
    'ISPITNI_SCENARIJ': ISPITNI_SCENARIJ,
    'ISPITNI_ULAZ': ISPITNI_ULAZ,
    'KOREKCIJA_C': KOREKCIJA_C,
    'MQTT_BROKER': MQTT_BROKER,
    'MQTT_PORT': MQTT_PORT,
    'MREZA_OMOGUCENA': MREZA_OMOGUCENA,
    'OBJAVA_MS': OBJAVA_MS,
    'ODGOVOR_MAX_MS': ODGOVOR_MAX_MS,
    'ODOBRENA_KOREKCIJA_C': ODOBRENA_KOREKCIJA_C,
    'POKUS': POKUS,
    'PRAG_OTVARANJA_C': PRAG_OTVARANJA_C,
    'PRAG_ZATVARANJA_C': PRAG_ZATVARANJA_C,
    'PROTOKOL': PROTOKOL,
    'SERVO_FREQ_HZ': SERVO_FREQ_HZ,
    'SERVO_MAX_US': SERVO_MAX_US,
    'SERVO_MIN_US': SERVO_MIN_US,
    'SERVO_OMOGUCEN': SERVO_OMOGUCEN,
    'SERVO_OTVORENO_US': SERVO_OTVORENO_US,
    'SERVO_ZATVORENO_US': SERVO_ZATVORENO_US,
    'STAROST_MAX_MS': STAROST_MAX_MS,
    'TEMA_ACK': TEMA_ACK,
    'TEMA_COMMAND': TEMA_COMMAND,
    'TEMA_STATE': TEMA_STATE,
    'UREDAJ_ID': UREDAJ_ID,
    'UZORAK_MS': UZORAK_MS,
    'VEZA_MAX_MS': VEZA_MAX_MS,
    'WIFI_LOZINKA': WIFI_LOZINKA,
    'WIFI_SSID': WIFI_SSID,
})

# PRIPREMLJENI DIO PROGRAMA

# Dio: logika
def _pripremi_logika():
    import math

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
                raise ValueError('Nevaljana konfiguracija')
            self.korekcija, self.donji, self.gornji = (korekcija, donji, gornji)
            self.cilj = False
            self.sirovo = self.temperatura = None
            self.status = 'NEMA_UZORKA'
            self.broj_uzorka = 0

        def uzorak(self, sirovo):
            self.broj_uzorka += 1
            if not broj(sirovo) or not -55 <= sirovo <= 125:
                self.pogreska()
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
    return _DioPrograma({'Model': Model, 'automatski_cilj': automatski_cilj, 'broj': broj})

_m_logika = _pripremi_logika()

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

# Dio: iot_logika
def _pripremi_iot_logika():
    Model = _m_logika.Model
    LabRecord = _m_lab_record.LabRecord
    try:
        from time import ticks_diff
    except ImportError:

        def ticks_diff(a, b):
            return a - b

    class IoTModel:

        def __init__(self, korekcija=0.0, donji=26.0, gornji=27.0, starost_ms=6000, veza_ms=6000):
            self.m = Model(korekcija, donji, gornji)
            self.record = LabRecord(ticks_diff)
            self.starost_ms, self.veza_ms = (starost_ms, veza_ms)
            self.last_sample = self.last_contact = None
            self.mode, self.manual = ('AUTO', False)
            self.ack_id, self.ack_command, self.ack_result = (0, None, 'NEMA_NAREDBE')

        def sample(self, raw, now):
            self.m.uzorak(raw)
            self.last_sample = now
            self.record.complete(self.m.temperatura, self.m.status == 'VALJANO', now)
            if self.m.status != 'VALJANO':
                self.mode = 'AUTO'

        def disconnected(self):
            self.last_contact = None
            self.mode = 'AUTO'
            self.ack_id, self.ack_command, self.ack_result = (0, None, 'NEMA_NAREDBE')

        def contact(self, now):
            self.last_contact = now

        def state(self, now):
            age = None if self.last_sample is None else ticks_diff(now, self.last_sample)
            if age is not None:
                self.m.provjeri_starost(age, self.starost_ms)
            fresh = self.m.status == 'VALJANO' and age is not None and (0 <= age <= self.starost_ms)
            online = self.last_contact is not None and 0 <= ticks_diff(now, self.last_contact) <= self.veza_ms
            if not fresh or not online:
                self.mode = 'AUTO'
            target = self.manual if fresh and self.mode == 'MANUAL' else self.m.cilj
            out = {'raw_c': self.m.sirovo, 'temp_c': self.m.temperatura, 'unit': 'degC', 'seq': self.m.broj_uzorka, 'status': self.m.status, 'valid': fresh, 'attempt_age_ms': age, 'mode': self.mode, 'target': 'OPEN' if target else 'CLOSED', 'ack_id': self.ack_id, 'ack_command': self.ack_command, 'ack_result': self.ack_result}
            out.update(self.record.snapshot(now, self.starost_ms))
            out['attempt_seq'] = self.m.broj_uzorka
            out['target_state'] = 'OPEN' if target else 'CLOSED'
            out['communication_state'] = 'ONLINE' if online else 'OFFLINE'
            out['app_online'] = online
            out['command_id'] = self.ack_id or None
            out['command_status'] = 'NONE' if not self.ack_id else 'ACCEPTED' if self.ack_result == 'PRIHVACENO' else 'REJECTED'
            out['command'] = self.ack_command
            return out

        def command(self, ident, command, now):
            state = self.state(now)
            self.ack_id, self.ack_command = (ident, command)
            if command not in ('OPEN', 'CLOSE', 'AUTO'):
                self.ack_result = 'ODBIJENO_NAREDBA'
            elif command == 'AUTO':
                self.mode = 'AUTO'
                self.ack_result = 'PRIHVACENO'
            elif not state['valid'] or self.last_contact is None or (not 0 <= ticks_diff(now, self.last_contact) <= self.veza_ms):
                self.ack_result = 'ODBIJENO_MJERENJE_ILI_VEZA'
            else:
                self.mode, self.manual = ('MANUAL', command == 'OPEN')
                self.ack_result = 'PRIHVACENO'
            return self.ack_result

    class Gate:

        def __init__(self, device, boot, session, max_age_ms=4000):
            self.device, self.boot, self.session = (device, boot, session)
            self.max_age_ms = max_age_ms
            self.server, self.last_id = (None, 0)

        def accept(self, msg, request, sent, now):
            if not isinstance(msg, dict):
                raise ValueError('format odgovora')
            age = ticks_diff(now, sent)
            if not 0 <= age <= self.max_age_ms:
                raise ValueError('zakasnjeli odgovor')
            if msg.get('device') != self.device or msg.get('boot') != self.boot or msg.get('session') != self.session or (type(msg.get('request')) is not int) or (msg['request'] != request):
                raise ValueError('identitet odgovora')
            server, ident, command = (msg.get('server'), msg.get('cmd_id'), msg.get('command'))
            if not isinstance(server, str) or len(server) != 16 or any((c not in '0123456789abcdef' for c in server)) or (type(ident) is not int) or (ident < 0) or (command not in (None, 'OPEN', 'CLOSE', 'AUTO')):
                raise ValueError('sadrzaj odgovora')
            if server != self.server:
                self.server, self.last_id = (server, ident)
                return None
            if command is None or ident <= self.last_id:
                return None
            self.last_id = ident
            return (ident, command)
    return _DioPrograma({'Gate': Gate, 'IoTModel': IoTModel, 'ticks_diff': ticks_diff})

_m_iot_logika = _pripremi_iot_logika()

# Dio: alarm_logika
def _pripremi_alarm_logika():
    def alarm_after_valid(temperatura, prethodno, prag_ukljuci, prag_iskljuci):
        if temperatura >= prag_ukljuci:
            return True
        if temperatura <= prag_iskljuci:
            return False
        return prethodno
    return _DioPrograma({'alarm_after_valid': alarm_after_valid})

_m_alarm_logika = _pripremi_alarm_logika()

# Dio: model_razrade
def _pripremi_model_razrade():
    IoTModel = _m_iot_logika.IoTModel
    ticks_diff = _m_iot_logika.ticks_diff
    alarm_after_valid = _m_alarm_logika.alarm_after_valid
    broj = _m_logika.broj
    automatski_cilj = _m_logika.automatski_cilj

    class ModelRazrade(IoTModel):

        def __init__(self, p):
            super().__init__(p.KOREKCIJA_C, p.PRAG_ZATVARANJA_C, p.PRAG_OTVARANJA_C, p.STAROST_MAX_MS, p.VEZA_MAX_MS)
            if not (broj(p.ALARM_ISKLJUCI_C) and broj(p.ALARM_UKLJUCI_C) and (p.ALARM_ISKLJUCI_C < p.ALARM_UKLJUCI_C)):
                raise ValueError('alarmni pragovi')
            self.p, self.alarm_memory = (p, False)

        def sample(self, raw, now):
            super().sample(raw, now)
            if self.m.status == 'VALJANO':
                self.alarm_memory = alarm_after_valid(self.m.temperatura, self.alarm_memory, self.p.ALARM_UKLJUCI_C, self.p.ALARM_ISKLJUCI_C)
                if self.mode == 'MANUAL':
                    self.m.cilj = self.manual

        def _pripremi_auto(self):
            if self.m.status == 'VALJANO':
                prethodno = self.manual if self.mode == 'MANUAL' else self.m.cilj
                self.m.cilj = automatski_cilj(self.m.temperatura, prethodno, self.m.donji, self.m.gornji)

        def disconnected(self):
            self._pripremi_auto()
            super().disconnected()

        def state(self, now):
            if self.mode == 'MANUAL' and (self.last_contact is None or not 0 <= ticks_diff(now, self.last_contact) <= self.veza_ms):
                self._pripremi_auto()
            out = super().state(now)
            out['alarm_memory'] = self.alarm_memory
            out['alarm'] = ('ON' if self.alarm_memory else 'OFF') if out['valid'] else 'UNKNOWN'
            out['alarm_state'] = out['alarm']
            return out

        def command(self, ident, command, now):
            if command == 'AUTO':
                self._pripremi_auto()
            result = super().command(ident, command, now)
            if result == 'PRIHVACENO' and command in ('OPEN', 'CLOSE'):
                self.m.cilj = command == 'OPEN'
            return result
    return _DioPrograma({'ModelRazrade': ModelRazrade})

_m_model_razrade = _pripremi_model_razrade()

# Dio: sklop_iot
def _pripremi_sklop_iot():
    from machine import Pin, PWM
    from time import ticks_ms, ticks_diff
    import onewire
    import ds18x20
    broj = _m_logika.broj

    def provjeri_postavke(p):
        if type(p.UZORAK_MS) is not int or not 1000 <= p.UZORAK_MS <= 60000 or p.STAROST_MAX_MS <= p.UZORAK_MS + 750:
            raise ValueError('vremena mjerenja')
        if not broj(p.KOREKCIJA_C):
            raise ValueError('korekcija')
        if p.ISPITNI_ULAZ and (not broj(p.ISPITNA_TEMPERATURA_C) or not -55 <= p.ISPITNA_TEMPERATURA_C <= 125):
            raise ValueError('ispitna temperatura')
        if p.SERVO_OMOGUCEN:
            x = (p.SERVO_MIN_US, p.SERVO_MAX_US, p.SERVO_ZATVORENO_US, p.SERVO_OTVORENO_US)
            if p.SERVO_FREQ_HZ != 50 or not all((type(v) is int and v > 0 for v in x)):
                raise ValueError('potvrdi frekvenciju i cetiri impulsa serva')
            if not 500 <= x[0] < x[1] <= 2500 or not all((x[0] <= v <= x[1] for v in x[2:])) or x[2] == x[3]:
                raise ValueError('podrucje/polozaji serva')

    class Sklop:

        def __init__(self, p):
            provjeri_postavke(p)
            self.p, self.pwm = (p, None)
            self.led = Pin(p.GPIO_LED_CILJA, Pin.OUT, value=0)
            self.alarm = Pin(p.GPIO_LED_ALARMA, Pin.OUT, value=0)
            self.servo_pin = Pin(p.GPIO_SERVO, Pin.OUT, value=0)
            self.ds = None if p.ISPITNI_ULAZ else ds18x20.DS18X20(onewire.OneWire(Pin(p.GPIO_DQ)))
            self.last_start, self.started, self.rom = (None, None, None)
            self.target = None

        def arm(self):
            if self.p.SERVO_OMOGUCEN:
                self.pwm = PWM(self.servo_pin, freq=50, duty_ns=self.p.SERVO_ZATVORENO_US * 1000)

        def read(self, now):
            if self.started is not None:
                if ticks_diff(now, self.started) < 750:
                    return (False, None)
                self.started = None
                try:
                    return (True, self.ds.read_temp(self.rom))
                except (OSError, ValueError):
                    return (True, None)
            if self.last_start is not None and ticks_diff(now, self.last_start) < self.p.UZORAK_MS:
                return (False, None)
            self.last_start = now
            if self.p.ISPITNI_ULAZ:
                return (True, self.p.ISPITNA_TEMPERATURA_C)
            try:
                roms = [r for r in self.ds.scan() if r[0] == 40]
                if len(roms) != 1:
                    return (True, None)
                self.rom = roms[0]
                self.ds.convert_temp()
                self.started = ticks_ms()
                return (False, None)
            except (OSError, ValueError):
                return (True, None)

        def apply(self, state):
            opened = state['target'] == 'OPEN'
            self.led.value(opened)
            self.alarm.value(not state['valid'])
            if self.pwm is not None and opened != self.target:
                us = self.p.SERVO_OTVORENO_US if opened else self.p.SERVO_ZATVORENO_US
                self.pwm.duty_ns(us * 1000)
            self.target = opened

        def close(self):
            self.led.off()
            self.alarm.off()
            if self.pwm is not None:
                self.pwm.deinit()
            Pin(self.p.GPIO_SERVO, Pin.OUT, value=0)
    return _DioPrograma({'Sklop': Sklop})

_m_sklop_iot = _pripremi_sklop_iot()

# Dio: ispitni_ulaz
def _pripremi_ispitni_ulaz():
    from time import ticks_diff
    # Isti redoslijed i trajanja kao u odgovarajucoj Arduino vjezbi.
    SCENARIJI = {1: [('PAUZA', 4000), (27.0, 4000), (26.5, 4000), (26.0, 4000), (26.5, 4000), (27.0, 4000), (None, 4000), (26.5, 4000)], 2: [(26.0, 4000)], 0: [(26.0, 4000)]}

    class IspitniUlaz:
        def __init__(self, p):
            self.steps = SCENARIJI.get(p.POKUS, SCENARIJI[0])
            self.interval = p.UZORAK_MS
            self.index, self.start, self.last = (0, None, None)

        def accepted(self, action, now):
            pass  # Naredba ne mijenja izvor ni vezu uredjaja.

        def read(self, now):
            if self.start is None:
                self.start = now
            value, duration = self.steps[self.index]
            if self.index < len(self.steps)-1 and ticks_diff(now, self.start) >= duration:
                self.index += 1
                self.start, self.last = (now, None)
                value, duration = self.steps[self.index]
            if value == 'PAUZA':
                return (False, None)
            if self.last is not None and ticks_diff(now, self.last) < self.interval:
                return (False, None)
            self.last = now
            return (True, value)

        def details(self):
            value = self.steps[self.index][0]
            return (self.index+1, 'NEVALJANO' if value is None else str(value))
    return _DioPrograma({'IspitniUlaz': IspitniUlaz})

_m_ispitni_ulaz = _pripremi_ispitni_ulaz()

# Dio: sklop_razrade
def _pripremi_sklop_razrade():
    Sklop = _m_sklop_iot.Sklop
    IspitniUlaz = _m_ispitni_ulaz.IspitniUlaz
    from time import ticks_ms

    class SklopRazrade(Sklop):

        def __init__(self, p):
            super().__init__(p)
            self.ispit = IspitniUlaz(p) if p.ISPITNI_ULAZ else None

        def read(self, now):
            return self.ispit.read(now) if self.ispit else super().read(now)

        def accepted(self, action, now):
            if self.ispit:
                self.ispit.accepted(action, now)

        def details(self):
            return self.ispit.details() if self.ispit else (None, 'STVARNO MJERENJE')

        def apply(self, state):
            super().apply(state)
            if self.p.ALARM_OMOGUCEN:
                alarm = state['alarm']
                self.alarm.value(ticks_ms() // 250 % 2 if alarm == 'UNKNOWN' else alarm == 'ON')
    return _DioPrograma({'SklopRazrade': SklopRazrade})

_m_sklop_razrade = _pripremi_sklop_razrade()

# Dio: mqtt_async
def _pripremi_mqtt_async():
    import asyncio
    import struct

    def string(value):
        value = value.encode() if isinstance(value, str) else value
        if len(value) > 65535:
            raise ValueError('MQTT string')
        return struct.pack('!H', len(value)) + value

    def remaining(n):
        out = bytearray()
        while True:
            b, n = (n % 128, n // 128)
            out.append(b | (128 if n else 0))
            if not n:
                return bytes(out)

    class MQTTClient:

        def __init__(self, client_id, server, port=1883):
            self.client_id, self.server, self.port = (client_id, server, port)
            self.reader = self.writer = None
            self.lock = asyncio.Lock()

        async def _send(self, op, data=b''):
            if len(data) > 4096:
                raise ValueError('MQTT paket prevelik')
            async with self.lock:
                self.writer.write(bytes([op]) + remaining(len(data)) + data)
                await asyncio.wait_for(self.writer.drain(), 4)

        async def _packet(self):
            first = await self.reader.readexactly(1)
            length, mult = (0, 1)
            for _ in range(4):
                byte = (await self.reader.readexactly(1))[0]
                length += (byte & 127) * mult
                if not byte & 128:
                    break
                mult *= 128
            else:
                raise ValueError('MQTT duljina')
            if length > 4096:
                raise ValueError('MQTT paket prevelik')
            return (first[0], await self.reader.readexactly(length))

        async def packet(self):
            return await asyncio.wait_for(self._packet(), 5)

        async def connect(self):
            self.reader, self.writer = await asyncio.wait_for(asyncio.open_connection(self.server, self.port), 5)
            await self._send(16, b'\x00\x04MQTT\x04\x02\x00\n' + string(self.client_id))
            op, data = await self.packet()
            if op != 32 or data != b'\x00\x00':
                raise OSError('MQTT CONNACK')

        async def subscribe(self, topic):
            await self._send(130, b'\x00\x01' + string(topic) + b'\x00')
            op, data = await self.packet()
            if op != 144 or data != b'\x00\x01\x00':
                raise OSError('MQTT SUBACK')

        async def publish(self, topic, payload):
            payload = payload.encode() if isinstance(payload, str) else payload
            await self._send(48, string(topic) + payload)

        async def ping(self):
            await self._send(192)

        @staticmethod
        def decode_publish(op, data):
            if op & 240 != 48 or op & 6:
                raise ValueError('samo MQTT QoS0')
            if len(data) < 2:
                raise ValueError('kratka MQTT tema')
            n = data[0] << 8 | data[1]
            if not 0 < n <= len(data) - 2:
                raise ValueError('MQTT tema')
            return (data[2:2 + n].decode(), data[2 + n:], bool(op & 1))

        def close(self):
            if self.writer:
                self.writer.close()
            self.writer = self.reader = None
    return _DioPrograma({'MQTTClient': MQTTClient})

_m_mqtt_async = _pripremi_mqtt_async()

# Dio: mqtt_guard
def _pripremi_mqtt_guard():
    try:
        from time import ticks_diff
    except ImportError:

        def ticks_diff(a, b):
            return a - b

    class CommandGuard:

        def __init__(self, device, boot, session, max_age=6000):
            self.device, self.boot, self.session = (device, boot, session)
            self.max_age, self.last_id = (max_age, 0)
            self.challenges = []
            self.heartbeat_seen = []

        def published(self, request, now):
            self.challenges.append((request, now))
            self.challenges = self.challenges[-8:]

        def heartbeat(self, msg, now):
            if not isinstance(msg, dict) or msg.get('type') != 'heartbeat':
                return None
            if any(msg.get(k) != v for k, v in (('device', self.device), ('boot', self.boot), ('session', self.session))):
                return None
            request = msg.get('request')
            found = [t for r, t in self.challenges if type(request) is int and r == request]
            if not found or request in self.heartbeat_seen or not 0 <= ticks_diff(now, found[-1]) <= self.max_age:
                return None
            self.heartbeat_seen = (self.heartbeat_seen + [request])[-8:]
            return found[-1]  # Dob izazova, ne vrijeme dostave ili MQTT PONG.

        def accept(self, msg, now):
            if not isinstance(msg, dict):
                return 'ODBIJENO_IDENTITET'
            ident = msg.get('cmd_id')
            if msg.get('device') != self.device or msg.get('boot') != self.boot or msg.get('session') != self.session or (type(ident) is not int) or (ident <= 0):
                return 'ODBIJENO_IDENTITET'
            if ident <= self.last_id:
                return 'ODBIJENO_DUPLIKAT'
            request = msg.get('request')
            found = [t for r, t in self.challenges if type(request) is int and r == request]
            if not found or not 0 <= ticks_diff(now, found[-1]) <= self.max_age:
                return 'ODBIJENO_STAROST'
            self.challenges = [(r, t) for r, t in self.challenges if r != request]
            self.last_id = ident
            if msg.get('command') not in ('OPEN', 'CLOSE', 'AUTO'):
                return 'ODBIJENO_NAREDBA'
            return 'DOPUSTENO'
    return _DioPrograma({'CommandGuard': CommandGuard})

_m_mqtt_guard = _pripremi_mqtt_guard()

# Dio: aplikacija_razrade
def _pripremi_aplikacija_razrade():
    import asyncio
    import os
    import binascii
    import json
    import network
    from time import ticks_ms, ticks_diff
    P = _m_postavke
    ModelRazrade = _m_model_razrade.ModelRazrade
    SklopRazrade = _m_sklop_razrade.SklopRazrade
    Gate = _m_iot_logika.Gate

    def oznaka():
        return binascii.hexlify(os.urandom(8)).decode()

    def provjeri():
        if not isinstance(P.UREDAJ_ID, str) or not 1 <= len(P.UREDAJ_ID) <= 24 or any((c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in P.UREDAJ_ID)):
            raise ValueError('UREDAJ_ID:1do24 slova/brojevi/_/-')
        if P.PROTOKOL not in ('HTTP', 'MQTT'):
            raise ValueError('PROTOKOL')
        for key in ('SLANJE_MS' if P.PROTOKOL == 'HTTP' else 'OBJAVA_MS',):
            if type(getattr(P, key)) is not int or not 500 <= getattr(P, key) <= 2000:
                raise ValueError('interval objave500do2000ms')
        if not P.MREZA_OMOGUCENA:
            return
        host = P.HTTP_POSLUZITELJ if P.PROTOKOL == 'HTTP' else P.MQTT_BROKER
        port = P.HTTP_PORT if P.PROTOKOL == 'HTTP' else P.MQTT_PORT
        parts = host.split('.')
        if len(parts) != 4 or any((not x.isdigit() or not 0 <= int(x) <= 255 for x in parts)) or int(parts[0]) in (0, 127):
            raise ValueError('upisi brojcani IPv4 nastavnikova racunala bez http://')
        if type(port) is not int or not 1 <= port <= 65535:
            raise ValueError('port')
        if not P.WIFI_SSID or P.WIFI_SSID == 'UPISI_SSID' or P.WIFI_LOZINKA == 'UPISI_LOZINKU':
            raise ValueError('upisi dodijeljene mrezne podatke')

    class Rad:

        def __init__(self):
            provjeri()
            self.ctl, self.hw = (ModelRazrade(P), SklopRazrade(P))
            self.boot, self.session = (oznaka(), oznaka())
            self.request, self.wlan = (0, None)

        def state(self, now):
            out = self.ctl.state(now)
            step, label = self.hw.details()
            out.update(device_id=P.UREDAJ_ID, boot_id=self.boot, device=P.UREDAJ_ID, boot=self.boot, session=self.session, request=self.request, simulated=P.ISPITNI_ULAZ, source='SIM' if P.ISPITNI_ULAZ else 'DS18B20', actuatorArmed=self.hw.pwm is not None, alarm_enabled=P.ALARM_OMOGUCEN, test_step=step, test_label=label, t_ms=now)
            return out

        def accepted(self, action, now):
            self.hw.accepted(action, now)

        async def local(self):
            last_state = last_step = None
            while True:
                now = ticks_ms()
                done, raw = self.hw.read(now)
                if done:
                    self.ctl.sample(raw, now)
                state = self.state(now)
                if done:
                    print('UZORAK', json.dumps(state))
                step = state['test_step']
                if step != last_step:
                    print('ISPITNI_KORAK', step, state['test_label'])
                    last_step = step
                signature = (state['status'], state['mode'], state['target'], state['alarm'], state['communication_state'])
                if signature != last_state:
                    print('STANJE', json.dumps(state))
                    last_state = signature
                self.hw.apply(state)
                await asyncio.sleep_ms(20)

        async def wifi(self):
            if self.wlan is None:
                interface = getattr(network.WLAN, 'IF_STA', None)
                if interface is None:
                    interface = network.STA_IF
                self.wlan = network.WLAN(interface)
                self.wlan.active(True)
            if not self.wlan.isconnected():
                self.ctl.disconnected()
                self.wlan.connect(P.WIFI_SSID, P.WIFI_LOZINKA)
                start = ticks_ms()
                while not self.wlan.isconnected():
                    if ticks_diff(ticks_ms(), start) > 10000:
                        self.wlan.disconnect()
                        raise OSError('Wi-Fi istek cekanja')
                    await asyncio.sleep_ms(100)

        async def http(self):
            raise RuntimeError('Za drugi protokol otvori njegov pocetni program.')

        async def mqtt(self):
            MQTTClient = _m_mqtt_async.MQTTClient
            CommandGuard = _m_mqtt_guard.CommandGuard
            while True:
                client, tasks = (None, [])
                try:
                    await self.wifi()
                    self.session, self.request = (oznaka(), 0)
                    guard = CommandGuard(P.UREDAJ_ID, self.boot, self.session, P.ODGOVOR_MAX_MS)
                    client = MQTTClient(P.UREDAJ_ID, P.MQTT_BROKER, P.MQTT_PORT)
                    await client.connect()
                    await client.subscribe(P.TEMA_COMMAND)
                    print('MREZA MQTT SPOJENA; session', self.session)

                    async def receive():
                        while True:
                            op, data = await client.packet()
                            if op == 208 and data == b'':
                                continue  # Broker odgovara; to nije nadzor aplikacije.
                            topic, body, retained = client.decode_publish(op, data)
                            if topic != P.TEMA_COMMAND or retained:
                                continue
                            try:
                                msg = json.loads(body)
                            except (ValueError, UnicodeError):
                                print('MQTT neispravan JSON odbijen')
                                continue
                            now = ticks_ms()
                            if isinstance(msg, dict) and msg.get('type') == 'heartbeat':
                                issued = guard.heartbeat(msg, now)
                                if issued is not None:
                                    self.ctl.contact(issued)
                                continue
                            reason = guard.accept(msg, now)
                            if reason == 'DOPUSTENO':
                                reason = self.ctl.command(msg['cmd_id'], msg['command'], now) if self.ctl.state(now)['communication_state'] == 'ONLINE' else 'ODBIJENO_MJERENJE_ILI_VEZA'
                            ack = {'device': P.UREDAJ_ID, 'boot': self.boot, 'session': self.session, 'request': msg.get('request') if isinstance(msg, dict) else None, 'cmd_id': msg.get('cmd_id') if isinstance(msg, dict) else None, 'accepted': reason == 'PRIHVACENO', 'reason': reason}
                            ack.update(device_id=P.UREDAJ_ID, boot_id=self.boot, command_id=ack['cmd_id'], command_status='ACCEPTED' if ack['accepted'] else 'REJECTED', physical_state='UNKNOWN')
                            await client.publish(P.TEMA_ACK, json.dumps(ack))
                            now = ticks_ms()
                            print('NAREDBA', json.dumps(ack))
                            if reason == 'PRIHVACENO':
                                self.accepted(msg['command'], now)
                            self.hw.apply(self.state(now))

                    async def publish():
                        nonlocal guard
                        last_pub = last_ping = None
                        while True:
                            now = ticks_ms()
                            if self.ctl.last_contact is not None and ticks_diff(now, self.ctl.last_contact) > P.VEZA_MAX_MS:
                                self.ctl.disconnected()
                                self.session, self.request = (oznaka(), 0)
                                guard = CommandGuard(P.UREDAJ_ID, self.boot, self.session, P.ODGOVOR_MAX_MS)
                                print('NADZOR OFFLINE; lokalno AUTO; nova sesija bez stare naredbe')
                            if not self.wlan.isconnected():
                                raise OSError('Wi-Fi veza prekinuta')
                            if last_pub is None or ticks_diff(now, last_pub) >= P.OBJAVA_MS:
                                self.request += 1
                                guard.published(self.request, now)
                                await client.publish(P.TEMA_STATE, json.dumps(self.state(now)))
                                last_pub = now
                            if last_ping is None or ticks_diff(now, last_ping) >= 2000:
                                await client.ping()
                                last_ping = now
                            await asyncio.sleep_ms(50)
                    tasks = [asyncio.create_task(receive()), asyncio.create_task(publish())]
                    await asyncio.gather(*tasks)
                except (OSError, ValueError, TypeError, IndexError, EOFError, asyncio.TimeoutError) as err:
                    self.ctl.disconnected()
                    self.hw.apply(self.state(ticks_ms()))
                    print('MREZA', type(err).__name__, 'AUTO; lokalni rad nastavlja')
                finally:
                    for task in tasks:
                        task.cancel()
                    if client:
                        client.close()
                await asyncio.sleep_ms(1000)

    async def run():
        rad = Rad()
        tasks = []
        try:
            print('P13_HTTP' if P.PROTOKOL == 'HTTP' else 'P14_MQTT', P.UREDAJ_ID, 'boot', rad.boot)
            print('SIMULACIJA - NIJE MJERENJE' if P.ISPITNI_ULAZ else 'STVARNO MJERENJE DS18B20')
            if P.SERVO_OMOGUCEN:
                print('Odobreni servo pokrece se za3s; prostor mora biti slobodan.')
                await asyncio.sleep_ms(3000)
                rad.hw.arm()
            else:
                print('Servo onemogucen: cilj/LED nisu dokaz fizickog pomaka.')
            print('STANJE', json.dumps(rad.state(ticks_ms())))
            tasks.append(asyncio.create_task(rad.local()))
            if P.MREZA_OMOGUCENA:
                tasks.append(asyncio.create_task(rad.http() if P.PROTOKOL == 'HTTP' else rad.mqtt()))
            else:
                print('MREZA ONEMOGUCENA; lokalna petlja radi.')
            await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                task.cancel()
            if rad.wlan:
                rad.wlan.active(False)
            rad.hw.close()
    return _DioPrograma({'run': run})

_m_aplikacija_razrade = _pripremi_aplikacija_razrade()

# Dio: main
def _pripremi_main():
    import sys
    import asyncio
    run = _m_aplikacija_razrade.run
    try:
        asyncio.run(run())
    finally:
        asyncio.new_event_loop()
    return _DioPrograma({})

_m_main = _pripremi_main()
