# P0 - Prvi prijenos i vlastita poruka
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
    import sys
    import os
    from time import sleep_ms
    REPORT_MS = 2000
    MESSAGE = 'ESP32-S3: program radi'
    if not 100 <= REPORT_MS <= 60000:
        raise ValueError('REPORT_MS mora biti 100..60000 ms')
    print('MicroPython:', sys.implementation)
    # Pločica može ispisati podatke o sustavu, a Labos naziv izvršne platforme.
    print('Sustav:', os.uname() if hasattr(os, 'uname') else sys.platform)
    while True:
        print(MESSAGE)
        sleep_ms(REPORT_MS)
    return _DioPrograma({})

_m_main = _pripremi_main()
