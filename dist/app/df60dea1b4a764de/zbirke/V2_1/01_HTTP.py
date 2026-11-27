# V2.1 - Prikaži model na računalu preko HTTP-a
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
ODGOVOR_MAX_MS = 4000
ALARM_OMOGUCEN = False
PROTOKOL = 'HTTP'
HTTP_POSLUZITELJ = '192.168.1.10'
HTTP_PORT = 8080
SLANJE_MS = 1000
HTTP_CEKANJE_MS = 4500

_m_postavke = _DioPrograma({
    'ALARM_ISKLJUCI_C': ALARM_ISKLJUCI_C,
    'ALARM_OMOGUCEN': ALARM_OMOGUCEN,
    'ALARM_UKLJUCI_C': ALARM_UKLJUCI_C,
    'GPIO_DQ': GPIO_DQ,
    'GPIO_LED_ALARMA': GPIO_LED_ALARMA,
    'GPIO_LED_CILJA': GPIO_LED_CILJA,
    'GPIO_SERVO': GPIO_SERVO,
    'HTTP_CEKANJE_MS': HTTP_CEKANJE_MS,
    'HTTP_PORT': HTTP_PORT,
    'HTTP_POSLUZITELJ': HTTP_POSLUZITELJ,
    'ISPITNA_TEMPERATURA_C': ISPITNA_TEMPERATURA_C,
    'ISPITNI_SCENARIJ': ISPITNI_SCENARIJ,
    'ISPITNI_ULAZ': ISPITNI_ULAZ,
    'KOREKCIJA_C': KOREKCIJA_C,
    'MREZA_OMOGUCENA': MREZA_OMOGUCENA,
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
    'SLANJE_MS': SLANJE_MS,
    'STAROST_MAX_MS': STAROST_MAX_MS,
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
    SCENARIJI = {1: [(27.0, 4000), (26.0, 4000)], 2: [(26.0, 4000)], 0: [(26.0, 4000)]}

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
                self.alarm.value(ticks_ms() // 300 % 2 if alarm == 'UNKNOWN' else alarm == 'ON')
    return _DioPrograma({'SklopRazrade': SklopRazrade})

_m_sklop_razrade = _pripremi_sklop_razrade()

# Dio: http_async
def _pripremi_http_async():
    import asyncio
    import json

    async def _line(reader, limit=1024):
        data = bytearray()
        while len(data) <= limit:
            c = await reader.read(1)
            if not c:
                raise OSError('prekinuto zaglavlje')
            data.extend(c)
            if c == b'\n':
                return bytes(data)
        raise ValueError('predugacak redak zaglavlja')

    async def _post(host, port, payload):
        writer = None
        try:
            reader, writer = await asyncio.open_connection(host, port)
            body = json.dumps(payload).encode()
            head = 'POST /api/update HTTP/1.0\r\nHost: %s:%d\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n' % (host, port, len(body))
            writer.write(head.encode() + body)
            await writer.drain()
            status = await _line(reader)
            if status.split()[1:2] != [b'200']:
                raise OSError('HTTP status nije 200')
            length, total = (None, 0)
            while True:
                line = await _line(reader)
                total += len(line)
                if total > 2048:
                    raise ValueError('preveliko zaglavlje')
                if line == b'\r\n':
                    break
                key, _, value = line.partition(b':')
                if key.lower() == b'content-length':
                    if length is not None:
                        raise ValueError('dvostruka duljina')
                    length = int(value.strip())
                if key.lower() == b'transfer-encoding':
                    raise ValueError('nepodrzano kodiranje prijenosa')
            if length is None or not 0 < length <= 2048:
                raise ValueError('duljina odgovora')
            chunks = bytearray()
            while len(chunks) < length:
                piece = await reader.read(length - len(chunks))
                if not piece:
                    raise OSError('prekinuto tijelo odgovora')
                chunks.extend(piece)
            return json.loads(bytes(chunks).decode())
        finally:
            if writer is not None:
                writer.close()

    async def post_json(host, port, payload, timeout_ms=4500):
        return await asyncio.wait_for(_post(host, port, payload), timeout_ms / 1000)
    return _DioPrograma({'post_json': post_json})

_m_http_async = _pripremi_http_async()

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
                signature = (state['status'], state['mode'], state['target'], state['alarm'])
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
            post_json = _m_http_async.post_json
            gate = Gate(P.UREDAJ_ID, self.boot, self.session, P.ODGOVOR_MAX_MS)
            while True:
                try:
                    await self.wifi()
                    self.request += 1
                    sent = ticks_ms()
                    reply = await post_json(P.HTTP_POSLUZITELJ, P.HTTP_PORT, self.state(sent), P.HTTP_CEKANJE_MS)
                    now, old_server = (ticks_ms(), gate.server)
                    cmd = gate.accept(reply, self.request, sent, now)
                    if old_server != gate.server:
                        self.ctl.disconnected()
                    self.ctl.contact(now)
                    if cmd:
                        result = self.ctl.command(cmd[0], cmd[1], now)
                        print('NAREDBA', json.dumps({'cmd_id': cmd[0], 'command': cmd[1], 'reason': result}))
                        if result == 'PRIHVACENO':
                            self.accepted(cmd[1], now)
                        self.hw.apply(self.state(now))
                except (OSError, ValueError, TypeError, IndexError, EOFError, asyncio.TimeoutError) as err:
                    self.ctl.disconnected()
                    self.hw.apply(self.state(ticks_ms()))
                    print('MREZA', type(err).__name__, 'AUTO; lokalni rad nastavlja')
                    self.session, self.request = (oznaka(), 0)
                    gate = Gate(P.UREDAJ_ID, self.boot, self.session, P.ODGOVOR_MAX_MS)
                await asyncio.sleep_ms(P.SLANJE_MS)

        async def mqtt(self):
            raise RuntimeError('Za drugi protokol otvori njegov pocetni program.')

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
