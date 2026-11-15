"""MIT. GPIO TM1637 driver for the four-digit clock-module profile.

No I2C calls. CLK/DIO are open drain; each byte checks the ninth-clock ACK.
Bit 7 of digit 1 drives the central colon. VCC=5 V; ESP32 needs an adapter.
"""
from machine import Pin, disable_irq, enable_irq
from time import sleep_us


class TM1637:
    DIGITS = (0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f)

    def __init__(self, clk, dio):
        self.clk, self.dio = clk, dio
        clk.init(Pin.OPEN_DRAIN, value=1)
        dio.init(Pin.OPEN_DRAIN, value=1)

    def _start(self):
        self.dio(1)
        self.clk(1)
        sleep_us(20)
        self.dio(0)
        sleep_us(20)

    def _stop(self):
        self.clk(0)
        self.dio(0)
        sleep_us(20)
        self.clk(1)
        sleep_us(20)
        self.dio(1)
        sleep_us(20)

    def _byte(self, value):
        for bit in range(8):
            self.clk(0)
            self.dio((value >> bit) & 1)
            sleep_us(20)
            self.clk(1)
            sleep_us(20)
        self.clk(0)
        self.dio(1)  # release, never drive HIGH against the slave ACK
        sleep_us(20)
        self.clk(1)
        sleep_us(20)
        ack = self.dio() == 0
        self.clk(0)
        sleep_us(20)
        if not ack:
            raise OSError("TM1637: nema ACK, provjeri CLK/DIO i napajanje")

    def transaction(self, data):
        if not data:
            raise ValueError("Prazan TM1637 prijenos")
        token = disable_irq()
        try:
            self._start()
            for value in data:
                if not 0 <= value <= 255:
                    raise ValueError("Bajt mora biti 0–255")
                self._byte(value)
        finally:
            self._stop()
            enable_irq(token)

    def brightness(self, value=7, on=True):
        if not isinstance(value, int) or not 0 <= value <= 7:
            raise ValueError("Svjetlina mora biti 0–7; 0 nije iskljuceno")
        self.transaction((0x80 | (8 if on else 0) | value,))

    def segments(self, data, pos=0):
        if not 0 <= pos <= 3 or not 1 <= len(data) <= 4-pos:
            raise ValueError("Prikaz ima cetiri znamenke, polozaji 0–3")
        self.transaction((0x40,))
        self.transaction(bytes((0xc0 | pos,)) + bytes(data))

    def number(self, value, colon=False, leading_zero=False):
        if not isinstance(value, int) or not -999 <= value <= 9999:
            raise ValueError("Broj mora biti -999–9999")
        negative = value < 0
        value = abs(value)
        data = [0, 0, 0, 0]
        for i in range(3, -1, -1):
            if value or i == 3 or leading_zero:
                data[i] = self.DIGITS[value % 10]
                value //= 10
            elif negative:
                data[i] = 0x40
                negative = False
        if leading_zero and negative:
            data[0] = 0x40
        if colon:
            data[1] |= 0x80
        self.segments(data)

    def clear(self):
        self.segments((0, 0, 0, 0))
