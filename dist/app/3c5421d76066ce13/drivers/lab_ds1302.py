# MIT. Visible GPIO driver for DS1302, 1.0.0. No direct simulator API.
from machine import Pin
from time import sleep_us

class DS1302:
    def __init__(self, ce, io, clock):
        self.ce, self.io, self.clock = ce, io, clock
        self.ce.init(Pin.OUT, value=0)
        self.clock.init(Pin.OUT, value=0)
        self.io.init(Pin.IN)

    def _start(self):
        self.ce.value(0)
        self.clock.value(0)
        self.io.init(Pin.OUT, value=0)
        sleep_us(10)
        self.ce.value(1)
        sleep_us(10)

    def _write(self, value, reading=False):
        for bit in range(8):
            self.io.value((value >> bit) & 1)
            sleep_us(10)
            self.clock.value(1)
            sleep_us(10)
            # Bit 0 of the reply appears on THIS falling edge.
            if reading and bit == 7:
                self.io.init(Pin.IN)
            self.clock.value(0)
            sleep_us(10)

    def _read(self):
        value = 0
        for bit in range(8):
            value |= self.io.value() << bit
            self.clock.value(1)
            sleep_us(10)
            self.clock.value(0)
            sleep_us(10)
        return value

    def read(self, command, count=1):
        if not 1 <= count <= 31:
            raise ValueError('DS1302 count')
        self._start()
        try:
            self._write(command | 1, True)
            return bytes(self._read() for _ in range(count))
        finally:
            self.ce.value(0)
            self.io.init(Pin.IN)

    def write(self, command, data):
        self._start()
        try:
            self._write(command & 254)
            for value in data:
                self._write(value)
        finally:
            self.ce.value(0)
            self.io.init(Pin.IN)

    @staticmethod
    def _bcd(n):
        return (n // 10) * 16 + n % 10

    @staticmethod
    def _dec(n):
        if n & 15 > 9 or n >> 4 > 9:
            raise ValueError('DS1302 BCD')
        return (n >> 4) * 10 + (n & 15)

    def datetime(self):
        r = self.read(0xBF, 8)
        s, m = self._dec(r[0] & 127), self._dec(r[1] & 127)
        twelve = bool(r[2] & 128)
        h = self._dec(r[2] & (31 if twelve else 63))
        if twelve:
            if not 1 <= h <= 12:
                raise ValueError('DS1302 hour')
            h = h % 12 + (12 if r[2] & 32 else 0)
        date, month = self._dec(r[3] & 63), self._dec(r[4] & 31)
        year, day = 2000 + self._dec(r[6]), r[5] & 7
        if not 1 <= month <= 12 or not 1 <= day <= 7 or h > 23 or m > 59 or s > 59:
            raise ValueError('DS1302 calendar / connection')
        days = (31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        if not 1 <= date <= days[month - 1]:
            raise ValueError('DS1302 date / connection')
        return (year, month, date, day, h, m, s)

    def set_datetime(self, year, month, date, day, hour, minute, second):
        # Validate before any bus write, including month lengths and leap years.
        days = (31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        if not (2000 <= year <= 2099 and 1 <= month <= 12 and 1 <= date <= days[month-1] and 1 <= day <= 7 and 0 <= hour < 24 and 0 <= minute < 60 and 0 <= second < 60):
            raise ValueError('DS1302 calendar')
        self.write_protect(False)
        self.write(0xBE, bytes((self._bcd(second), self._bcd(minute), self._bcd(hour), self._bcd(date), self._bcd(month), day, self._bcd(year-2000), 0)))

    def write_protect(self, enabled):
        self.write(0x8E, bytes((128 if enabled else 0,)))

    def halted(self, enabled=None):
        value = self.read(0x81)[0]
        if enabled is None:
            return bool(value & 128)
        self.write(0x80, bytes(((value & 127) | (128 if enabled else 0),)))

    def ram(self, index, value=None):
        if not 0 <= index < 31:
            raise ValueError('DS1302 RAM 0..30')
        if value is None:
            return self.read(0xC1 + 2 * index)[0]
        if not 0 <= value <= 255:
            raise ValueError('DS1302 RAM byte')
        self.write(0xC0 + 2 * index, bytes((value,)))
