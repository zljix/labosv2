# MIT. Lab SDSC v2 block driver 1.0.0. Real SPI command/data transfers.
from time import sleep_ms

def _crc(data):
    c = 0
    for b in data:
        c ^= b << 8
        for _ in range(8):
            c = ((c << 1) ^ (0x1021 if c & 0x8000 else 0)) & 65535
    return c

class SDCard:
    def __init__(self, spi, cs, baudrate=1000000):
        self.spi, self.cs = spi, cs
        cs.init(cs.OUT, value=1)
        spi.init(baudrate=100000, polarity=0, phase=0)
        sleep_ms(2)
        spi.write(b'\xff' * 10)
        try:
            if self._cmd(0, 0, 0x95) != 1:
                raise OSError('SD CMD0: provjeri spojeve i karticu')
            self._end()
            if self._cmd(8, 0x1aa, 0x87) != 1 or spi.read(4) != b'\x00\x00\x01\xaa':
                raise OSError('SD CMD8: nepodrzan profil')
            self._end()
            for _ in range(100):
                self._cmd(55, 0); self._end()
                r = self._cmd(41, 0); self._end()
                if r == 0:
                    break
                sleep_ms(1)
            else:
                raise OSError('SD ACMD41 timeout')
            if self._cmd(58, 0) != 0:
                raise OSError('SD OCR')
            ocr = spi.read(4); self._end()
            if not ocr[0] & 128 or ocr[0] & 64:
                raise OSError('Lab driver zahtijeva SDSC bajtovne adrese')
            if self._cmd(16, 512) != 0:
                raise OSError('SD blok nije 512 B')
            self._end()
            if self._cmd(9, 0) != 0:
                raise OSError('SD CSD')
            csd = self._data(16); self._end()
            size = ((csd[6] & 3) << 10) | (csd[7] << 2) | (csd[8] >> 6)
            mult = ((csd[9] & 3) << 1) | (csd[10] >> 7)
            self.sectors = ((size + 1) << (mult + 2)) * (1 << (csd[5] & 15)) // 512
            if csd[0] >> 6 or self.sectors != 16384:
                raise OSError('Lab profil zahtijeva SDSC 8 MiB')
        finally:
            self._end()
        spi.init(baudrate=baudrate, polarity=0, phase=0)

    def _end(self):
        self.cs(1)
        self.spi.write(b'\xff')

    def _cmd(self, n, arg, crc=1):
        self.cs(0)
        for _ in range(1000):
            if self.spi.read(1)[0] == 255:
                break
        else:
            raise OSError('SD busy timeout')
        self.spi.write(bytes([64 | n, arg >> 24, (arg >> 16) & 255, (arg >> 8) & 255, arg & 255, crc]))
        for _ in range(64):
            r = self.spi.read(1)[0]
            if r < 128:
                return r
        raise OSError('SD naredba bez odgovora')

    def _data(self, n):
        for _ in range(1000):
            t = self.spi.read(1)[0]
            if t == 254:
                break
            if t != 255:
                raise OSError('SD token podataka')
        else:
            raise OSError('SD token timeout')
        b = self.spi.read(n)
        crc = self.spi.read(2)
        if _crc(b) != (crc[0] << 8 | crc[1]):
            raise OSError('SD CRC16 citanja')
        return b

    def readblocks(self, block, buf):
        if block < 0 or len(buf) % 512 or block + len(buf) // 512 > self.sectors:
            raise ValueError('SD granica ili duljina bloka')
        try:
            for pos in range(0, len(buf), 512):
                if self._cmd(17, (block + pos // 512) * 512) != 0:
                    raise OSError('SD CMD17')
                buf[pos:pos+512] = self._data(512)
                self._end()
        finally:
            self._end()
        return 0

    def writeblocks(self, block, buf):
        if block < 0 or len(buf) % 512 or block + len(buf) // 512 > self.sectors:
            raise ValueError('SD granica ili duljina bloka')
        try:
            for pos in range(0, len(buf), 512):
                if self._cmd(24, (block + pos // 512) * 512) != 0:
                    raise OSError('SD CMD24')
                b = buf[pos:pos+512]
                c = _crc(b)
                self.spi.write(b'\xfe')
                self.spi.write(b)
                self.spi.write(bytes([c >> 8, c & 255]))
                if self.spi.read(1)[0] & 31 != 5:
                    raise OSError('SD zapis odbijen: zastita, CRC ili budzet sektora')
                for _ in range(1000):
                    if self.spi.read(1)[0] == 255:
                        break
                else:
                    raise OSError('SD busy timeout')
                self._end()
        finally:
            self._end()
        return 0

    def ioctl(self, op, arg):
        if op in (1, 2, 3):
            return 0
        if op == 4:
            return self.sectors
        if op == 5:
            return 512
        return -1
