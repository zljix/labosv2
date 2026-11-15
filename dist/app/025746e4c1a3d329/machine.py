"""Functional ESP32-S3 teaching adapter; declared subset, not hardware emulation."""
import _lab

class SPI:
    """Functional 8-bit master adapter; bytes, no ESP32 peripheral cycles."""
    MSB = 0
    LSB = 1

    def __init__(self, id, baudrate=1000000, *, polarity=0, phase=0, bits=8,
                 firstbit=0, sck=None, mosi=None, miso=None):
        if id not in (1, 2, -1):
            raise ValueError("Lab SPI koristi id 1/2; SoftSPI je zaseban objekt")
        self.id = id
        self.active = False
        self.init(baudrate, polarity=polarity, phase=phase, bits=bits,
                  firstbit=firstbit, sck=sck, mosi=mosi, miso=miso)

    def init(self, baudrate=1000000, *, polarity=0, phase=0, bits=8,
             firstbit=0, sck=None, mosi=None, miso=None):
        if bits != 8 or firstbit != SPI.MSB or (polarity, phase) not in ((0, 0), (1, 1)):
            raise NotImplementedError("Lab SPI: 8 bita, MSB prvi, mode 0 ili 3")
        if not isinstance(baudrate, int) or not 1 <= baudrate <= 10000000:
            raise ValueError("Lab SPI: baudrate 1-10000000 Hz")
        self.sck = sck if sck is not None else getattr(self, 'sck', None)
        self.mosi = mosi if mosi is not None else getattr(self, 'mosi', None)
        self.miso = miso if miso is not None else getattr(self, 'miso', None)
        if not isinstance(self.sck, Pin) or not isinstance(self.mosi, Pin):
            raise ValueError("SPI trazi eksplicitne sck i mosi Pin objekte")
        if self.miso is not None and not isinstance(self.miso, Pin):
            raise ValueError("miso treba biti Pin ili None")
        self.sck.init(Pin.OUT, value=polarity)
        self.mosi.init(Pin.OUT, value=0)
        if self.miso is not None:
            self.miso.init(Pin.IN)
        _lab.spi_config(self.id, self.sck.id, self.mosi.id,
                        self.miso.id if self.miso is not None else -1,
                        baudrate, polarity * 2 + phase, firstbit)
        self.active = True

    def deinit(self):
        _lab.spi_config(self.id, self.sck.id, self.mosi.id, -1, 0, 0, 0)
        self.active = False
        self.sck.init(Pin.IN)
        self.mosi.init(Pin.IN)

    def _exchange(self, data):
        if not self.active:
            raise OSError(19)
        return _lab.spi_exchange(self.id, data)

    def write(self, buf):
        self._exchange(buf)

    def read(self, nbytes, write=0):
        if not isinstance(nbytes, int) or not 0 <= nbytes <= 4096:
            raise ValueError("SPI read: 0-4096 bajtova po pozivu")
        return self._exchange(bytes([write]) * nbytes)

    def readinto(self, buf, write=0):
        buf[:] = self.read(len(buf), write)

    def write_readinto(self, write_buf, read_buf):
        if len(write_buf) != len(read_buf):
            raise ValueError("SPI spremnici trebaju jednaku duljinu")
        read_buf[:] = self._exchange(write_buf)

class SoftSPI(SPI):
    """Same functional byte contract; not a bit-timing GPIO emulation."""
    def __init__(self, baudrate=500000, **kwargs):
        super().__init__(-1, baudrate, **kwargs)

_pins = {}
_allowed = tuple(range(22)) + tuple(range(38, 49))

class Pin:
    IN = 0
    OUT = 1
    OPEN_DRAIN = 2
    PULL_UP = 1
    PULL_DOWN = 2

    def __init__(self, id, mode=-1, pull=None, *, value=None):
        if not isinstance(id, int) or id not in _allowed:
            raise ValueError("GPIO nije dostupan na referentnoj N16R8 plocici (35-37: PSRAM)")
        self.id = id
        if id not in _pins:
            _pins[id] = [Pin.IN, None, 0]
        self.init(mode, pull, value=value)

    def init(self, mode=-1, pull=None, *, value=None):
        if mode != -1:
            if mode not in (Pin.IN, Pin.OUT, Pin.OPEN_DRAIN):
                raise ValueError("Nepodrzan nacin rada pina")
            _pins[self.id][0] = mode
        if pull not in (None, Pin.PULL_UP, Pin.PULL_DOWN):
            raise ValueError("Nepodrzan pull otpornik")
        _pins[self.id][1] = pull
        if value is not None and _pins[self.id][0] not in (Pin.OUT, Pin.OPEN_DRAIN):
            raise ValueError("Pin treba biti postavljen kao izlaz")
        if value is not None:
            _pins[self.id][2] = 1 if value else 0
        requested = _pins[self.id][0]
        latch = _pins[self.id][2]
        output = requested == Pin.OUT or (requested == Pin.OPEN_DRAIN and latch == 0)
        _lab.mode(self.id, output, pull or 0, latch if output else -1)

    def value(self, x=None):
        mode, pull, latch = _pins[self.id]
        if x is not None:
            if mode not in (Pin.OUT, Pin.OPEN_DRAIN):
                raise ValueError("Pin treba biti postavljen kao izlaz")
            _pins[self.id][2] = 1 if x else 0
            if mode == Pin.OPEN_DRAIN:
                _lab.mode(self.id, not bool(x), pull or 0, 0 if not x else -1)
            else:
                _lab.write(self.id, 1 if x else 0)
        else:
            v = _lab.read(self.id, pull or 0)
            if v == -2:
                raise RuntimeError("Sukob izlaza ili previsok napon: pregledaj provjeru spojeva")
            if v == -3:
                raise RuntimeError("Napon je izmedju LOW i HIGH: koristi ADC ili definiraj digitalnu razinu")
            if v < 0:
                raise RuntimeError("Nepobudjen ulaz: spoji izvor ili postavi pull otpornik")
            return v

    __call__ = value

    def on(self):
        self.value(1)

    def off(self):
        self.value(0)

class ADC:
    """Ideal linear 12-bit model; no calibration, noise or hardware sampling."""
    ATTN_0DB = 0
    ATTN_2_5DB = 1
    ATTN_6DB = 2
    ATTN_11DB = 3
    WIDTH_12BIT = 12
    _ranges = (950000, 1250000, 1750000, 3100000)

    def __init__(self, pin, *, atten=0):
        self.pin = pin if isinstance(pin, Pin) else Pin(pin)
        if not 1 <= self.pin.id <= 20:
            raise ValueError("ADC na ESP32-S3 koristi GPIO1-20")
        self.pin.init(Pin.IN)
        self.atten(atten)

    def atten(self, value):
        if not isinstance(value, int) or not 0 <= value <= 3:
            raise ValueError("Nepodrzano ADC prigusenje")
        self._atten = value

    def init(self, *, atten=None):
        if atten is not None:
            self.atten(atten)

    def width(self, value):
        if value != 12:
            raise ValueError("ESP32-S3 podrzava 12-bitni ADC")

    def read(self):
        uv = _lab.adc(self.pin.id)
        if uv == -2:
            raise RuntimeError("ADC: sukob izlaza ili previsok ulazni napon")
        if uv < 0:
            raise RuntimeError("ADC: nepobudjen ulaz; provjeri spoj klizaca i napajanje")
        return min(4095, max(0, (uv * 4095 + self._ranges[self._atten] // 2) // self._ranges[self._atten]))

    def read_u16(self):
        raw = self.read()
        return (raw << 4) | (raw >> 8)

    def read_uv(self):
        return self.read() * self._ranges[self._atten] // 4095

class PWM:
    """Ideal duty model. Hardware timers, phase and frequency quantisation omitted."""
    def __init__(self, dest, *, freq=5000, duty_u16=None, duty_ns=None, duty=None, invert=False):
        self.pin = dest if isinstance(dest, Pin) else Pin(dest)
        self._freq = freq
        self._duty = 32768
        self._active = False
        if invert:
            raise NotImplementedError("PWM invert nije dio podrske v0.1")
        self.init(freq=freq, duty_u16=duty_u16, duty_ns=duty_ns, duty=duty)

    def _apply(self):
        _lab.pwm(self.pin.id, self._freq, self._duty)
        self._active = True

    def init(self, *, freq=None, duty_u16=None, duty_ns=None, duty=None):
        if sum(x is not None for x in (duty_u16, duty_ns, duty)) > 1:
            raise ValueError("Odaberi samo jedan nacin zadavanja radnog omjera")
        f = self._freq if freq is None else freq
        if not isinstance(f, int) or not 1 <= f <= 40000000:
            raise ValueError("PWM frekvencija mora biti 1-40000000 Hz")
        d = self._duty
        if duty_u16 is not None:
            if not isinstance(duty_u16, int) or not 0 <= duty_u16 <= 65535:
                raise ValueError("PWM duty_u16 mora biti 0-65535")
            d = duty_u16
        if duty is not None:
            if not isinstance(duty, int) or not 0 <= duty <= 1023:
                raise ValueError("PWM duty mora biti 0-1023")
            d = (duty * 65535 + 511) // 1023
        if duty_ns is not None:
            if not isinstance(duty_ns, int) or duty_ns < 0 or duty_ns * f > 1000000000:
                raise ValueError("Trajanje impulsa prelazi period PWM-a")
            d = duty_ns * f * 65535 // 1000000000
        self._freq, self._duty = f, d
        self._apply()

    def _require(self):
        if not self._active:
            raise RuntimeError("PWM je iskljucen; ponovno pozovi init")

    def freq(self, value=None):
        self._require()
        if value is None:
            return self._freq
        self.init(freq=value)

    def duty_u16(self, value=None):
        self._require()
        if value is None:
            return self._duty
        self.init(duty_u16=value)

    def duty(self, value=None):
        self._require()
        if value is None:
            return (self._duty * 1023 + 32767) // 65535
        self.init(duty=value)

    def duty_ns(self, value=None):
        self._require()
        if value is None:
            return self._duty * 1000000000 // (65535 * self._freq)
        self.init(duty_ns=value)

    def deinit(self):
        _lab.pwm(self.pin.id, 0, 0)
        self._active = False

_buses = {}

class I2C:
    """Transaction I2C: scan, read/write, repeated START and 8/16-bit memory addresses.
    Primitive GPIO bit-level I2C is not exposed by this functional adapter.
    """
    def __init__(self, id, *, scl, sda, freq=400000, timeout=50000):
        if not isinstance(id, int) or id not in (0, 1):
            raise ValueError("I2C id mora biti 0 ili 1")
        self.id = id
        self.init(scl=scl, sda=sda, freq=freq, timeout=timeout)

    def init(self, *, scl, sda, freq=400000, timeout=50000):
        if not isinstance(sda, Pin) or not isinstance(scl, Pin):
            raise TypeError("sda i scl trebaju biti Pin")
        if sda.id == scl.id or not isinstance(freq, int) or not 1 <= freq <= 400000 or not isinstance(timeout, int) or timeout <= 0:
            raise ValueError("I2C: razliciti GPIO-i, frekvencija 1-400000 Hz i pozitivan timeout")
        _lab.bus_config(self.id, sda.id, scl.id, freq)
        _buses[self.id] = (sda.id, scl.id, freq)

    def deinit(self):
        _lab.bus_config(self.id, -1, -1, 0)
        _buses.pop(self.id, None)

    def _address(self, address):
        if self.id not in _buses:
            raise OSError(19)
        if not isinstance(address, int) or not 0 <= address <= 127:
            raise ValueError("Ocekivana 7-bitna I2C adresa")

    def scan(self):
        self._address(8)
        return [a for a in range(8, 120) if _lab.bus_probe(self.id, a)]

    def writeto(self, address, buf, stop=True):
        self._address(address)
        return _lab.bus_tx(self.id, address, buf, stop)

    def writevto(self, address, vector, stop=True):
        self._address(address)
        if not isinstance(vector, (tuple, list)):
            raise TypeError("vector treba biti tuple ili list")
        # memoryview checks the buffer protocol, including for zero-length items.
        views = [bytes(memoryview(buf)) for buf in vector]
        total = sum(len(v) for v in views)
        if total > 4096:
            raise ValueError("I2C: najvise 4096 bajtova po prijenosu")
        return self.writeto(address, b"".join(views), stop)

    def readfrom(self, address, nbytes, stop=True):
        self._address(address)
        if not isinstance(nbytes, int) or not 0 <= nbytes <= 4096:
            raise ValueError("I2C: najvise 4096 bajtova po prijenosu")
        return _lab.bus_rx(self.id, address, nbytes, stop)

    def readfrom_into(self, address, buf, stop=True):
        self._address(address)
        _lab.bus_into(self.id, address, buf, stop)

    def _memaddr(self, address, addrsize):
        if addrsize not in (8, 16) or not isinstance(address, int) or not 0 <= address < (1 << addrsize):
            raise ValueError("I2C: memorijska adresa treba odgovarati addrsize 8 ili 16")
        return address.to_bytes(addrsize // 8, "big")

    def readfrom_mem(self, address, memaddr, nbytes, *, addrsize=8):
        prefix = self._memaddr(memaddr, addrsize)
        if not isinstance(nbytes, int) or not 0 <= nbytes <= 4096:
            raise ValueError("I2C: najvise 4096 bajtova po prijenosu")
        self.writeto(address, prefix, False)
        return self.readfrom(address, nbytes)

    def readfrom_mem_into(self, address, memaddr, buf, *, addrsize=8):
        view = memoryview(buf)
        # readfrom_into validates the writable destination in the native adapter.
        self.writeto(address, self._memaddr(memaddr, addrsize), False)
        return self.readfrom_into(address, view)

    def writeto_mem(self, address, memaddr, buf, *, addrsize=8):
        self.writeto(address, self._memaddr(memaddr, addrsize) + bytes(memoryview(buf)))


def disable_irq():
    """Functional virtual timing lock. It does not emulate Xtensa interrupts."""
    return _lab.timing(-1)


def enable_irq(state):
    _lab.timing(state)


def time_pulse_us(pin, pulse_level, timeout_us=1000000):
    """Measure a timed GPIO waveform. -2 waits for start; -1 waits for end."""
    if not isinstance(pin, Pin) or pulse_level not in (0, 1):
        raise ValueError("Ocekivani Pin i razina 0/1")
    if not isinstance(timeout_us, int) or not 1 <= timeout_us <= 1000000:
        raise ValueError("timeout_us treba biti 1-1000000")
    result = _lab.pulse_us(pin.id, pulse_level, timeout_us)
    if result == -3:
        raise RuntimeError("Nevaljana DATA razina: provjeri spoj i napon")
    return result


def dht_readinto(pin, buf):
    """DHT transport for upstream dht.py; decodes 40 measured GPIO pulses.

    Virtual microseconds remove browser scheduling jitter. No temperature or
    humidity is obtained from the host: this routine receives pulse durations.
    """
    from time import sleep_ms, sleep_us
    view = memoryview(buf)
    if len(view) != 5:
        raise ValueError("DHT zahtijeva zapisivi spremnik od pet bajtova")
    view[0] = 0  # validate writability before changing the GPIO
    pin.init(Pin.IN, Pin.PULL_UP)
    sleep_ms(1)
    pin.init(Pin.OUT, value=0)
    sleep_ms(18)  # valid start for both supported DHT profiles
    state = disable_irq()
    try:
        pin.init(Pin.IN, Pin.PULL_UP)
        sleep_us(30)
        if time_pulse_us(pin, 0, 1000) < 0 or time_pulse_us(pin, 1, 1000) < 0:
            raise OSError(110)
        for i in range(5):
            value = 0
            for bit in range(8):
                low = time_pulse_us(pin, 0, 1000)
                high = time_pulse_us(pin, 1, 1000)
                if low < 0 or high < 0:
                    raise OSError(110)
                value = (value << 1) | (1 if high > low else 0)
            view[i] = value
        # The checksum belongs to dht.py, so an injected corrupt frame reaches it.
    finally:
        enable_irq(state)
