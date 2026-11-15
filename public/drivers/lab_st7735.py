# MIT · ESP32 MicroPython Lab · original bounded ST7735 driver 1.0.0.
# 128x128 green-tab; direct RGB565 writes, no full-screen framebuffer.
from time import sleep_ms, ticks_us, ticks_diff
_FONT = {'0': [62, 81, 73, 69, 62], '1': [0, 66, 127, 64, 0], '2': [66, 97, 81, 73, 70], '3': [65, 73, 73, 73, 54], '4': [24, 20, 18, 127, 16], '5': [79, 73, 73, 73, 49], '6': [62, 73, 73, 73, 48], '7': [1, 113, 9, 5, 3], '8': [54, 73, 73, 73, 54], '9': [6, 73, 73, 73, 62], 'A': [126, 9, 9, 9, 126], 'B': [127, 73, 73, 73, 54], 'C': [62, 65, 65, 65, 65], 'D': [127, 65, 65, 65, 62], 'E': [127, 73, 73, 73, 65], 'F': [127, 9, 9, 9, 1], 'G': [62, 65, 73, 73, 121], 'H': [127, 8, 8, 8, 127], 'I': [0, 65, 127, 65, 0], 'J': [48, 64, 65, 63, 1], 'K': [127, 8, 20, 34, 65], 'L': [127, 64, 64, 64, 64], 'M': [127, 2, 12, 2, 127], 'N': [127, 2, 4, 8, 127], 'O': [62, 65, 65, 65, 62], 'P': [127, 9, 9, 9, 6], 'Q': [62, 65, 81, 33, 94], 'R': [127, 9, 25, 41, 70], 'S': [70, 73, 73, 73, 49], 'T': [1, 1, 127, 1, 1], 'U': [63, 64, 64, 64, 63], 'V': [31, 32, 64, 32, 31], 'W': [127, 32, 24, 32, 127], 'X': [99, 20, 8, 20, 99], 'Y': [3, 4, 120, 4, 3], 'Z': [97, 81, 73, 69, 67], '.': [0, 0, 96, 96, 0], ':': [0, 0, 54, 54, 0], '-': [8, 8, 8, 8, 8], '/': [64, 48, 8, 6, 1], '%': [67, 51, 8, 102, 97], '?': [2, 1, 81, 9, 6], ' ': [0, 0, 0, 0, 0]}

class ST7735:
    def __init__(self, spi, cs, dc, reset):
        self.spi, self.cs, self.dc, self.reset_pin = spi, cs, dc, reset
        cs.init(cs.OUT, value=1)
        dc.init(dc.OUT, value=0)
        reset.init(reset.OUT, value=1)
        reset.value(0)
        sleep_ms(10)
        reset.value(1)
        self._wait(150)
        self.command(0x01)
        self._wait(150)
        self.command(0x11)
        self._wait(150)
        self.command(0x3a, b'\x05')
        self.rotation(0)
        self.command(0x13)
        self.command(0x29)

    def _wait(self, ms):
        start = ticks_us()
        sleep_ms(ms)
        while ticks_diff(ticks_us(), start) < ms * 1000:
            sleep_ms(1)

    def command(self, cmd, data=None):
        self.dc.value(0)
        self.cs.value(0)
        try:
            self.spi.write(bytes([cmd]))
            if data is not None:
                self.dc.value(1)
                self.spi.write(data)
        finally:
            self.cs.value(1)

    def rotation(self, value):
        if value not in (0, 1, 2, 3):
            raise ValueError('rotation 0-3')
        self.rot = value
        row = 3 if value < 2 else 1
        self.ox, self.oy = (row, 2) if value & 1 else (2, row)
        self.command(0x36, bytes([0xc8, 0xa8, 0x08, 0x68][value:value+1]))

    def window(self, x, y, w, h):
        x += self.ox
        y += self.oy
        self.command(0x2a, bytes([0, x, 0, x+w-1]))
        self.command(0x2b, bytes([0, y, 0, y+h-1]))
        self.command(0x2c)

    def fill_rect(self, x, y, w, h, color):
        x1, y1 = min(128, x+w), min(128, y+h)
        x, y = max(0, x), max(0, y)
        if x1 <= x or y1 <= y:
            return
        self.window(x, y, x1-x, y1-y)
        row = bytes([color >> 8, color & 255]) * (x1-x)
        self.dc.value(1)
        self.cs.value(0)
        try:
            for i in range(y1-y):
                self.spi.write(row)
                if i % 16 == 15:
                    sleep_ms(0)
        finally:
            self.cs.value(1)

    def fill(self, color):
        self.fill_rect(0, 0, 128, 128, color)

    def pixel(self, x, y, color):
        self.fill_rect(x, y, 1, 1, color)

    def rect(self, x, y, w, h, color):
        self.fill_rect(x, y, w, 1, color)
        self.fill_rect(x, y+h-1, w, 1, color)
        self.fill_rect(x, y, 1, h, color)
        self.fill_rect(x+w-1, y, 1, h, color)

    def line(self, x0, y0, x1, y1, color):
        dx, dy = abs(x1-x0), -abs(y1-y0)
        sx, sy = 1 if x0 < x1 else -1, 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.pixel(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            e = 2 * err
            if e >= dy:
                err += dy
                x0 += sx
            if e <= dx:
                err += dx
                y0 += sy

    def text(self, text, x, y, color=65535, scale=1):
        if scale not in (1, 2, 3, 4):
            raise ValueError('scale 1-4')
        for char in str(text).upper():
            glyph = _FONT.get(char, _FONT['?'])
            for col in range(5):
                for row in range(7):
                    if glyph[col] & (1 << row):
                        self.fill_rect(x+col*scale, y+row*scale, scale, scale, color)
            x += 6*scale
