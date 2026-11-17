# 24O — pet uvodnih MicroPython školskih zadataka

Izdanje 0.14.13-beta.1 dodaje zasebne školske dodjele i rubrike V1–V5. Ostaje 268/268 URS kombinacija; uvodnih 5/5 vodi se zasebno. Svi prethodni 74 profili i njihovi ugovori ostaju sačuvani. Nema nove SQL migracije.

## Opseg i upute

| Zadatak | Provjeravano ponašanje | Bodovi |
|---|---|---|
| V1 LED i vrijeme | Popravljen LED put, ≥3 puna ciklusa, 250/750 ms ±24 ms | 3 + 5 + 2 |
| V2 Tipkalo | Valjan ulaz, prvi pritisak/otpuštanje, ponavljanja; odaziv 300 ms +24 ms | 3 + 5 + 2 |
| V3 ADC/PWM | ADC put, puni proporcionalni PWM, 0/25/50/100 %, dvije dodatne pobude i povrat | 3 + 5 + 2 |
| V4 AHT10/OLED | Napajani putovi, nova T/RH očitanja, stvarni osvježeni OLED pikseli | 3 + 5 + 2 |
| V5 Regulator | AHT10/OLED/servo putovi, osnovna histereza, oba smjera i granični dekodirani uzorci | 3 + 5 + 2 |

Svaki profil ima vlastiti `intro/...` ključ i `24O-v...@1` identitet, objavljeni ugovor, samo cilj MicroPython i najviše 10 bodova. S3 ADC koristi 12-bitnu kvantizaciju, 11 dB i zasićenje 3,1 V; sredina klizača nije točno 50 % PWM-a. V3 zadržava smjer početne upute: pri 0 % klizača LED je ugašena, pri 100 % uključena, a međupoložaji daju rastući PWM. Obrnuti krajevi potenciometra koji obrću taj odziv ne dobivaju funkcionalne bodove; zasebni URS ADC ugovor ostaje sačuvan. V3 odaziv je do 400 ms uz 24 ms tolerancije, odstupanje radnog omjera do 0,04.

V4/V5 koriste OLED 128×64, standardni framebuf text() 8×8 i jednu decimalu. Položaji brojki slobodni su na različitim redcima, uz razmak početaka najmanje 8 px i potpuno vidljive brojke. Prvo novo očitanje/prikaz do 2 s uz 100 ms tolerancije; razmaci očitanja i poslanih slika do 2100 ms. Najmanje dva nova očitanja i dva osvježavanja po etapi od 6000 ms. Slika mora biti stabilna najmanje 100 ms. Konzola, neodaslana memorija slike, samo dio broja ili zajednički redak nisu dovoljan dokaz.

V5 osnovni slijed 24→29→27→25→27→29 daje 0→90→90→0→0→90°. Granice se primjenjuju na dekodirano AHT10 očitanje prije zaokruživanja, uz pragove ≥28 i ≤26, 50±2 Hz i kut ±2°. Cijeli nastavak i tolerancije objavljeni su u zamrznutoj rubrici.

## Početni projekti i školski rad

Školski katalog zamrzava izvorne uvodne projekte: V1 nedostaje vodič, V2 ažuriranje LED-a, V3 prijenos ADC-a u PWM, V4 prikaz RH, V5 zaseban donji prag. Ne uključuje nastavničko rješenje. Upute, pitanja, radni zapis `vjezba.json` i driveri ostaju iz uvodnog niza; ne pretvaraju se u URS projekt. Ime i razred preuzimaju se iz školskog računa pri novom pokušaju.

Službeni rezultat dolazi samo iz izoliranog izvođenja spremljene snimke. `provjera.json`, `scenarij.json`, uvezeni bodovi i odgovori ne prenose bodove u bazu. Svaka vježba ima vlastiti pokušaj, neovisne nepromjenjive revizije i zaključanu predaju. Otvoreni odgovori ostaju za nastavnički pregled. Ekvivalentan algoritam, nazivi, GPIO uz usklađen kod i električno ekvivalentan raspored dopušteni su.

[Završni prihvat 24O](https://github.com/zljix/labosv2/actions/runs/44068540213) prošao je svih 53 koraka, uključujući 56 ciljanih izvedbi i pet zasebnih zaključanih uvodnih dodjela. Provjereni ZIP sadrži 938 datoteka inventure i isti provjeravač kao dokazi.

## Nadogradnja i provjere

Nakon sigurnosne kopije sačuvaj privatnu konfiguraciju, ključ i sesije. Zamijeni kompletan školski paket, pokreni postojeći `migrate` i ponovno pokreni Linux provjeravače. Nastavnik objavljuje novu inačicu V zadatka s njegovom rubrikom i dodjeljuje je razredu. Postojeće dodjele, zaključani rezultati i stare rubrike ostaju uz svoju inačicu.

Ciljani izvršni testovi: `npm run test:school-introductory`. PHP/MySQL prihvat: `npm run test:school-introductory-api`. Dokazi su u [stage24o-evidence](stage24o-evidence/README.md). Dokazi prihvata moraju odgovarati hash-u isporučenog provjeravača.

Slijedi 24P: potpuna regresija i stvarni školski pilot prema dogovorenom planu. CI i sintetski razred ne potvrđuju stvarni rad s učenicima, fizičko sklopovlje ili školski HTTPS/LAN.
