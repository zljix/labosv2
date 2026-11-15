# MIT. LabLCD1602 1.0.0. HD44780 16x2 + PCF8574, 100 kHz.
# Backpack map P0=RS, P1=RW, P2=E, P3=backlight HIGH, P4..7=D4..7.
# Physical ESP32 needs 5 V LCD supply and a bidirectional I2C level converter.
from time import sleep_ms, sleep_us


class LCD1602:
    def __init__(self, bus, address=0x27):
        if not 0x20 <= address <= 0x27:
            raise ValueError('PCF8574 address must be 0x20..0x27')
        self.bus = bus
        self.address = address
        self.light = 8
        self.control = 12
        sleep_ms(50)
        self.bus.writeto(self.address, bytes((self.light,)))
        sleep_ms(1)
        for nibble, wait in ((3, 5), (3, 1), (3, 1), (2, 1)):
            self._nibble(nibble << 4)
            sleep_ms(wait)
        self.command(0x28)  # 4 bits, 2 lines, 5x8 dots
        self.command(0x0c)  # Display on, cursor off
        self.command(0x06)  # Increment cursor, no shift
        self.clear()

    def _nibble(self, value):
        value |= self.light
        self.bus.writeto(self.address, bytes((value, value | 4, value)))
        sleep_us(1)

    def _send(self, value, rs=0):
        self._nibble((value & 0xf0) | rs)
        self._nibble(((value << 4) & 0xf0) | rs)
        sleep_us(50)

    def command(self, value):
        self._send(value)
        if value in (1, 2, 3):
            sleep_ms(2)

    def clear(self):
        self.command(1)

    def home(self):
        self.command(2)

    def move_to(self, column, row):
        if not 0 <= column < 16 or row not in (0, 1):
            raise ValueError('LCD position: column 0..15, row 0..1')
        self.command(0x80 | (column + 0x40 * row))

    def putstr(self, text):
        for char in text:
            value = ord(char)
            if not (value < 16 or 32 <= value <= 126 or value == 255):
                raise ValueError('LCD text: ASCII 32..126 or custom glyph 0..7')
            self._send(value, 1)

    def custom_char(self, index, rows):
        if not 0 <= index < 8 or len(rows) != 8:
            raise ValueError('CGRAM: index 0..7 and 8 rows')
        self.command(0x40 | (index * 8))
        for row in rows:
            self._send(row & 31, 1)
        self.home()  # Return to DDRAM after glyph upload

    def backlight(self, enabled=True):
        self.light = 8 if enabled else 0
        self.bus.writeto(self.address, bytes((self.light,)))

    def display(self, enabled=True, cursor=False, blink=False):
        self.control = 8 | (4 if enabled else 0) | (2 if cursor else 0) | (1 if blink else 0)
        self.command(self.control)

    def shift_left(self):
        self.command(0x18)

    def shift_right(self):
        self.command(0x1c)
