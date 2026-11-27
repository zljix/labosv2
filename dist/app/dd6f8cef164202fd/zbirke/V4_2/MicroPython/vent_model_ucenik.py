# Vlastita biblioteka. SuceIje je zajednicko programima A i B.
import math
from lab_podrska import ticks_diff, LabRecord, create_io

AUTOR = "UPISI IME I PREZIME"
VERZIJA = "1.0.0"
DOVRSENO = False
if not DOVRSENO:
    raise NotImplementedError("V4.2: dopuni S1-S3, zatim postavi DOVRSENO=True")

def _number(value):
    return type(value) in (int, float) and math.isfinite(value)

def corrected_temperature(raw, offset):
    # TODO S1: provjeri tip, konacnost i sirovi raspon -55..125.
    # Zatim jednom dodaj offset i provjeri rezultat.
    # Uspjeh: (True, vrijednost); odbijanje: (False, None).
    raise NotImplementedError("S1")

def select_pulse(target_open, config):
    # TODO S2: samo bool cilj; cijeli impulsi, 500 <= min < max <= 2500,
    # dva razlicita polozaja unutar odobrenih granica.
    # Vrati odabrani impuls; pri odbijanju None. Ne pristupaj GPIO-u.
    raise NotImplementedError("S2")

def usable_reading(reading, now_ms):
    value=reading.get('value_c')
    completed=reading.get('completed_at_ms')
    return (reading.get('status')=='VALID' and _number(value) and -55 <= value <= 125
            and type(completed) is int and 0 <= ticks_diff(now_ms, completed) <= 6000)


class VentModel:

    def __init__(self, config, io=None, scenario="GRANICE"):
        self._scenario = scenario
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
                self._io = create_io(self._config, self._scenario)
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
        offset = 0.0 if self._io.source == 'SIM' else self._config['offset_c']
        valid, value = corrected_temperature(raw, offset)
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
        # TODO S3: prvo self._ready, zatim type(target_open) is bool.
        # Ako je servo omogucen, select_pulse ne smije vratiti None.
        # Pri uspjehu: self._io.apply_target(target_open), spremi self._target_open.
        # Statusi: NOT_READY, BAD_TARGET ili ACCEPTED. Odbijanje nema izlaza.
        raise NotImplementedError("S3")

    def target(self):
        return self._target_open

    def close(self):
        if self._io is not None:
            self._io.close()
        self._ready = False
        self._started = None
        self._last_start = None
        self._last = {'status': 'NOT_READY', 'value_c': None, 'raw_c': None, 'sequence': 0, 'completed_at_ms': None, 'source': self._last['source']}
