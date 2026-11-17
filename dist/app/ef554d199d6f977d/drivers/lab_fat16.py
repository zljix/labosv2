# MIT. Bounded FAT16 VFS 1.0.0: Lab 8 MiB superfloppy, root 8.3, <=64 KiB/file.
# This is a visible Python filesystem, not MicroPython's native VfsFat.
def _u16(b, o):
    return b[o] | b[o+1] << 8

def _u32(b, o):
    return _u16(b, o) | _u16(b, o+2) << 16

def _put16(b, o, n):
    b[o], b[o+1] = n & 255, n >> 8

def _put32(b, o, n):
    _put16(b, o, n & 65535); _put16(b, o+2, n >> 16)

class FAT16:
    def __init__(self, sd):
        self.sd, self.readonly, self.mounted = sd, False, True
        self.cache = {}
        b = self._read(0)
        if b[510:512] != b'\x55\xaa' or _u16(b, 11) != 512 or b[13] != 1 or _u16(b, 14) != 1 or b[16] != 2 or _u16(b, 17) != 64 or _u16(b, 19) != 16384 or _u16(b, 22) != 64:
            raise OSError('Lab FAT16: nepodrzana ili ostecena geometrija')

    def _read(self, sector):
        b = bytearray(512); self.sd.readblocks(sector, b); return b

    def _write(self, sector, b):
        if self.readonly or not self.mounted:
            raise OSError(30)
        self.sd.writeblocks(sector, b)

    def _fat(self, cluster, value=None):
        sector, offset = cluster // 256, (cluster % 256) * 2
        if sector not in self.cache:
            b = self._read(1 + sector)
            if b != self._read(65 + sector):
                raise OSError('FAT kopije se razlikuju')
            self.cache[sector] = b
        b = self.cache[sector]
        if value is not None:
            b = bytearray(b); _put16(b, offset, value)
            try:
                self._write(1 + sector, b); self._write(65 + sector, b)
            except Exception:
                self.cache.pop(sector, None)
                raise
            self.cache[sector] = b
        return _u16(b, offset)

    def _name(self, path):
        p = path.strip('/').upper()
        parts = p.split('.')
        if len(parts) > 2 or not 1 <= len(parts[0]) <= 8 or len(parts) == 2 and not 1 <= len(parts[1]) <= 3 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in ''.join(parts)):
            raise OSError('Koristi ime 8.3 u korijenu, bez mapa')
        return (parts[0] + ' ' * (8-len(parts[0])) + ((parts[1] + ' ' * (3-len(parts[1]))) if len(parts) == 2 else '   ')).encode()

    def _entry(self, name):
        free = None
        for sector in range(129, 133):
            b = self._read(sector)
            for offset in range(0, 512, 32):
                if b[offset] in (0, 229):
                    if free is None:
                        free = (sector, offset)
                    if b[offset] == 0:
                        return None, free
                elif b[offset:offset+11] == name and not b[offset+11] & 24:
                    return (sector, offset, bytes(b[offset:offset+32])), free
        return None, free

    def _chain(self, first):
        out = []
        while first < 65528 and first != 0:
            if first < 2 or first >= 16253 or first in out or len(out) >= 128:
                raise OSError('Nevaljan FAT lanac ili datoteka veca od 64 KiB')
            out.append(first); first = self._fat(first)
        return out

    def _load(self, entry):
        if entry is None:
            return b''
        b = entry[2]; size = _u32(b, 28)
        if size > 65536:
            raise OSError('Lab granica datoteke je 64 KiB')
        chain = self._chain(_u16(b, 26))
        if len(chain)*512 < size:
            raise OSError('Prekratak FAT lanac')
        return b''.join(self._read(133+c-2) for c in chain)[:size]

    def _save(self, name, data):
        if len(data) > 65536:
            raise OSError(28)
        entry, free = self._entry(name)
        if entry and entry[2][11] & 1:
            raise OSError(30)
        if entry is None and free is None:
            raise OSError('Korijen je pun: 64 unosa')
        old = self._chain(_u16(entry[2], 26)) if entry else []
        count = (len(data)+511)//512
        chain = old[:count]
        for c in range(2, 16253):
            if len(chain) == count:
                break
            if c not in old and self._fat(c) == 0:
                chain.append(c)
        if len(chain) != count:
            raise OSError(28)
        for i, c in enumerate(chain):
            block = bytearray(512); chunk = data[i*512:(i+1)*512]; block[:len(chunk)] = chunk
            self._write(133+c-2, block)
        for i, c in enumerate(chain):
            self._fat(c, chain[i+1] if i+1 < count else 65535)
        sector, offset = (entry[0], entry[1]) if entry else free
        block = self._read(sector); b = bytearray(32)
        b[:11] = name; b[11] = 32; _put16(b, 24, (2026-1980)*512+33)
        _put16(b, 26, chain[0] if chain else 0); _put32(b, 28, len(data))
        block[offset:offset+32] = b; self._write(sector, block)
        for c in old[count:]:
            self._fat(c, 0)

    def mount(self, readonly, mkfs):
        if mkfs:
            raise OSError('Formatiranje nije automatsko; vrati praznu Lab karticu')
        self.readonly, self.mounted = readonly, True

    def umount(self):
        self.mounted = False

    def chdir(self, path):
        if path not in ('', '/'):
            raise OSError(95)

    def getcwd(self):
        return '/'

    def ilistdir(self, path='/'):
        self.chdir(path)
        for sector in range(129, 133):
            b = self._read(sector)
            for o in range(0, 512, 32):
                if b[o] == 0:
                    return
                if b[o] == 229 or b[o+11] & 24:
                    continue
                name = bytes(b[o:o+8]).decode().rstrip()
                ext = bytes(b[o+8:o+11]).decode().rstrip()
                yield (name + ('.'+ext if ext else ''), 32768, 0, _u32(b, o+28))

    def stat(self, path):
        if path in ('', '/'):
            return (16384, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        e, _ = self._entry(self._name(path))
        if e is None:
            raise OSError(2)
        return (32768, 0, 0, 1, 0, 0, _u32(e[2], 28), 0, 0, 0)

    def open(self, path, mode='r', *args, **kwargs):
        if mode not in ('r', 'rb', 'rt', 'w', 'wb', 'wt', 'a', 'ab', 'at') or kwargs.get('encoding', 'utf-8') != 'utf-8':
            raise OSError(95)
        if not self.mounted or self.readonly and mode[0] != 'r':
            raise OSError(30)
        name = self._name(path); entry, _ = self._entry(name)
        if entry is None and mode[0] == 'r':
            raise OSError(2)
        data = b'' if mode[0] == 'w' else self._load(entry)
        return _File(self, name, mode, data)

class _File:
    def __init__(self, fs, name, mode, data):
        self.fs, self.name, self.mode, self.data = fs, name, mode, data
        self.pos = len(data) if mode[0] == 'a' else 0
        self.closed, self.dirty = False, mode[0] == 'w' or mode[0] == 'a' and fs._entry(name)[0] is None

    def _check(self):
        if self.closed or not self.fs.mounted:
            raise ValueError('Datoteka je zatvorena ili VFS odspojen')

    def read(self, n=-1):
        self._check()
        if self.mode[0] != 'r':
            raise OSError(9)
        if 'b' not in self.mode:
            text = self.data[self.pos:].decode()
            text = text if n < 0 else text[:n]
            self.pos += len(text.encode()); return text
        end = len(self.data) if n < 0 else min(len(self.data), self.pos+n)
        b = self.data[self.pos:end]; self.pos = end
        return b

    def readline(self):
        self._check(); end = self.data.find(b'\n', self.pos)
        end = len(self.data) if end < 0 else end+1
        b = self.data[self.pos:end]; self.pos = end
        return b if 'b' in self.mode else b.decode()

    def write(self, data):
        self._check()
        if self.mode[0] == 'r':
            raise OSError(9)
        if 'b' in self.mode:
            if isinstance(data, str):
                raise TypeError('Binarna datoteka trazi bytes')
            b = bytes(data)
        else:
            if not isinstance(data, str):
                raise TypeError('Tekstualna datoteka trazi str')
            b = data.encode()
        if self.mode[0] == 'a':
            self.pos = len(self.data)
        if self.pos+len(b) > 65536:
            raise OSError(28)
        self.data = self.data[:self.pos] + b + self.data[self.pos+len(b):]
        self.pos += len(b); self.dirty = True
        return len(data)

    def flush(self):
        self._check()
        if self.dirty:
            self.fs._save(self.name, self.data); self.dirty = False

    def close(self):
        if not self.closed:
            self.flush(); self.closed = True

    def tell(self):
        self._check(); return self.pos

    def seek(self, pos, whence=0):
        self._check(); pos += 0 if whence == 0 else self.pos if whence == 1 else len(self.data) if whence == 2 else -1000000
        if not 0 <= pos <= len(self.data):
            raise ValueError('Seek izvan postojece datoteke')
        self.pos = pos; return pos

    def __enter__(self):
        self._check(); return self

    def __exit__(self, *args):
        self.close()

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line
