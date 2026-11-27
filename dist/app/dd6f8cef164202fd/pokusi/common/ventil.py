# Zasebna učenička biblioteka. Funkcija pamti stanje preko argumenta prethodno.
PRAG_OTVARANJA = 27.0
PRAG_ZATVARANJA = 26.0


def korekcija(t, pomak=0.0):
    return t + pomak


def odluka(temperatura, prethodno):
    if temperatura >= PRAG_OTVARANJA:
        return True
    if temperatura <= PRAG_ZATVARANJA:
        return False
    return prethodno
