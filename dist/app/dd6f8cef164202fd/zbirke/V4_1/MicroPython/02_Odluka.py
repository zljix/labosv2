# V4.1 - Napiši korekciju i odluku otvora
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# Ucenicke funkcije odmah su ispod ovih uputa; okvir je vec pripremljen.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
# UCENIK - vlastite kratke funkcije ove vjezbe
PRAG_OTVARANJA_C = 27.0
PRAG_ZATVARANJA_C = 26.0
def moja_korekcija(sirovo, korekcija):
    # Vrati zbroj dvaju ulaza.
    return float("nan")  # DOPUNI
def moj_uvjet(temperatura):
    # Vrati je li temperatura <= 26.0.
    return False  # DOPUNI
def moj_otvor(temperatura, prethodni):
    # True znaci OPEN; False znaci CLOSED. Izmedju pragova pamti prethodni.
    return False  # DOPUNI
def moj_alarm(temperatura, prethodni):
    # 30 i vise: True; 28 i manje: False; izmedju pamti.
    if temperatura >= 30.0:
        return True
    if temperatura <= 28.0:
        return False
    return prethodni
def moja_naredba(tekst):
    # Dopustene su tocno OPEN, CLOSE i AUTO.
    return tekst in ("OPEN", "CLOSE", "AUTO")
# KRAJ UCENICKIH FUNKCIJA
# Koraci: 01_Funkcije, 02_Odluka, 03_Model; dokaze lijepi u isti Word.

import math
from time import sleep_ms


# Pripremljena provjera: nevaljano ocitanje zaobilazi ucenicku funkciju.
while True:
    cilj = False
    for t in (27.0, 26.5, 26.0, None):
        valjano = type(t) in (int, float) and math.isfinite(t)
        cilj = moj_otvor(t, cilj) if valjano else False
        print('PROVJERA OTVOR', t if valjano else 'NEVALJANO', 'OPEN' if cilj else 'CLOSED')
        sleep_ms(2000)
