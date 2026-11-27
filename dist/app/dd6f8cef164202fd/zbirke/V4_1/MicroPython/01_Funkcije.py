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

from time import sleep_ms
while True:
    print("PROVJERA KOREKCIJA", moja_korekcija(24.8,0.5), moja_korekcija(26.0,0.0))
    print("PROVJERA UVJET", moj_uvjet(25.9), moj_uvjet(26.1))
    sleep_ms(2000)
