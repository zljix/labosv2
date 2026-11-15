"""MIT · ESP32 MicroPython Lab · XPT2046 teaching driver 1.0.0.
12-bit differential X/Y/Z1/Z2, 24 clocks/conversion, mode 0 at <=2 MHz.
Panel endpoints are a Lab calibration example, not universal module constants.
"""
from machine import Pin

class XPT2046:
    def __init__(self, spi, cs, irq=None):
        self.spi, self.cs, self.irq = spi, cs, irq
        cs.init(Pin.OUT, value=1)
        if irq is not None:
            irq.init(Pin.IN)

    def _read(self, command):
        # One leading null bit, 12 data bits, three trailing zero bits.
        tx = bytes((command, 0, 0))
        rx = bytearray(3)
        self.cs(0)
        try:
            self.spi.write_readinto(tx, rx)
        finally:
            self.cs(1)
        return ((rx[1] << 8) | rx[2]) >> 3

    def raw(self):
        # All conversions power down at end, re-enabling active LOW PENIRQ.
        x, y = self._read(0xd0), self._read(0x90)
        z1, z2 = self._read(0xb0), self._read(0xc0)
        return x, y, z1, z2

    @staticmethod
    def valid(raw, threshold=300):
        # 0xFF MISO gives 8191 after unpacking: it is not a valid 12-bit ADC.
        return all(0 <= v <= 4095 for v in raw) and raw[2] > 0 and raw[3] >= raw[2] and raw[2]+4095-raw[3] >= threshold

    def point(self, rotation=0, calibration=(200, 3900, 250, 3850), threshold=300):
        raw = self.raw()
        if not self.valid(raw, threshold):
            return None
        x, y = calibrate(raw[0], raw[1], rotation, calibration)
        return x, y, raw[2] + 4095 - raw[3]

def calibrate(x, y, rotation=0, calibration=(200, 3900, 250, 3850)):
    """Map raw endpoints to physical panel first, then inverse MADCTL rotation.
    Reversed endpoint pairs are allowed; zero spans are an error.
    """
    if rotation not in (0, 1, 2, 3):
        raise ValueError("rotation 0..3")
    x0, x1, y0, y1 = calibration
    if x0 == x1 or y0 == y1:
        raise ValueError("Kalibracijski raspon ne smije biti nula")
    x = max(0, min(239, round((x-x0)*239/(x1-x0))))
    y = max(0, min(319, round((y-y0)*319/(y1-y0))))
    if rotation == 1:
        return y, 239-x
    if rotation == 2:
        return 239-x, 319-y
    if rotation == 3:
        return 319-y, x
    return x, y
