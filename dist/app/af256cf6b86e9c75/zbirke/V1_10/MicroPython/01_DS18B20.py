# V1.10 - Usporedi dva temperaturna senzora
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.

class _DioPrograma:
    def __init__(self, vrijednosti):
        for naziv, vrijednost in vrijednosti.items():
            setattr(self, naziv, vrijednost)


# Dio: main
def _pripremi_main():
    from machine import Pin
    from time import ticks_ms, ticks_diff, sleep_ms
    import onewire
    import ds18x20
    import math
    OFFSET_C = 0.0
    REQUEST_MS = 3000
    REPORT_MS = 1000

    def korigiraj(sirovo):
        return sirovo + OFFSET_C
    if not math.isfinite(OFFSET_C) or not 1000 <= REQUEST_MS <= 60000:
        raise ValueError('Nevaljana korekcija ili interval mjerenja')
    if not 100 <= REPORT_MS <= 60000:
        raise ValueError('Nevaljan interval ispisa')
    senzor = ds18x20.DS18X20(onewire.OneWire(Pin(4)))
    sirovo = korigirano = None
    status = 'NEMA_UZORKA'
    rom = None
    u_tijeku = False
    prvi_pokus = True
    pocetak = zadnji_pokus = zadnji_ispis = ticks_ms()
    zadnji_uzorak = None
    broj_uzorka = 0
    while True:
        sada = ticks_ms()
        if u_tijeku and ticks_diff(sada, pocetak) >= 750:
            u_tijeku = False
            try:
                vrijednost = senzor.read_temp(rom)
                if not math.isfinite(vrijednost) or not -55 <= vrijednost <= 125:
                    raise ValueError('Nevaljano ocitanje')
                sirovo = vrijednost
                korigirano = korigiraj(sirovo)
                status = 'VALJANO'
                zadnji_uzorak = sada
                broj_uzorka += 1
            except (OSError, ValueError) as err:
                sirovo = korigirano = None
                status = 'NEVALJANO'
                print('Senzor:', err)
        if not u_tijeku and (prvi_pokus or ticks_diff(sada, zadnji_pokus) >= REQUEST_MS):
            prvi_pokus = False
            zadnji_pokus = sada
            try:
                roms = [r for r in senzor.scan() if r[0] == 40]
                if len(roms) != 1:
                    raise ValueError('Potreban je tocno jedan DS18B20')
                rom = roms[0]
                senzor.convert_temp()
                pocetak = ticks_ms()
                u_tijeku = True
            except (OSError, ValueError) as err:
                sirovo = korigirano = None
                status = 'NEVALJANO'
                print('Senzor:', err)
        if ticks_diff(sada, zadnji_ispis) >= REPORT_MS:
            zadnji_ispis = sada
            age = None if zadnji_uzorak is None else ticks_diff(sada, zadnji_uzorak)
            print('seq:', broj_uzorka, 't_ms:', zadnji_uzorak, 'SIROVO_C:', sirovo, 'KOREKCIJA_C:', OFFSET_C, 'KORIGIRANO_C:', korigirano, 'STATUS:', status, 'age_ms:', age)
        sleep_ms(10)
    return _DioPrograma({})

_m_main = _pripremi_main()
