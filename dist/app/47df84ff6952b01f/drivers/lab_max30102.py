# MIT. Lab MAX30102 polling driver 1.0.0. Raw I2C/FIFO, no host BPM/SpO2.
from time import sleep_ms, ticks_ms, ticks_diff


class MAX30102:
    ADDRESS = 0x57

    def __init__(self, bus):
        self.bus = bus
        self.channels = 2
        if self.reg(0xff) != 0x15:
            raise OSError('MAX30102 PART_ID: provjeri adresu i spojeve')

    def reg(self, address, value=None):
        if value is None:
            return self.bus.readfrom_mem(self.ADDRESS, address, 1)[0]
        self.bus.writeto_mem(self.ADDRESS, address, bytes((value,)))

    def reset(self):
        self.reg(9, 0x40)
        start = ticks_ms()
        while self.reg(9) & 0x40:
            if ticks_diff(ticks_ms(), start) > 100:
                raise OSError('MAX30102 reset timeout')
            sleep_ms(1)

    def clear_fifo(self):
        # WRITE, overflow and READ pointers start in a known state.
        self.bus.writeto_mem(self.ADDRESS, 4, b'\x00\x00\x00')
        self.reg(0)  # clear latched status flags

    def configure(self, mode=3, average=1):
        choices = (1, 2, 4, 8, 16, 32)
        if mode not in (2, 3) or average not in choices:
            raise ValueError('mode 2/3; average 1/2/4/8/16/32')
        self.reset()
        self.reg(8, choices.index(average) << 5)  # stop on full, 32 samples
        self.reg(10, 0x27)  # 4096 nA range, 100 raw samples/s, 18-bit words
        self.reg(12, 31)
        self.reg(13, 31)
        self.reg(9, mode)
        self.channels = 1 if mode == 2 else 2
        self.clear_fifo()

    def available(self):
        # Equal pointers mean empty OR full. A_FULL at threshold 0 and the
        # overflow counter disambiguate this driver's stop-on-full profile.
        status = self.reg(0)
        p = self.bus.readfrom_mem(self.ADDRESS, 4, 3)
        count = (p[0] - p[2]) & 31
        return 32 if count == 0 and (status & 0x80 or p[1]) else count

    def overflow(self):
        return self.reg(5)

    def read_sample(self):
        if not self.available():
            return None
        b = self.bus.readfrom_mem(self.ADDRESS, 7, self.channels * 3)
        red = ((b[0] << 16) | (b[1] << 8) | b[2]) & 0x3ffff
        ir = None if self.channels == 1 else ((b[3] << 16) | (b[4] << 8) | b[5]) & 0x3ffff
        return red, ir

    def shutdown(self, value=True):
        self.reg(9, (self.reg(9) & 7) | (0x80 if value else 0))
