# Etapa 13A — KY-040, kvadraturni kontakti i programski dekoder

Izdanje **0.5.3-beta.1** dodaje isti funkcionalni model za ESP32-S3/MicroPython i Uno R3/Nano classic/Arduino C/C++. Format projekta ostaje 3, model sklopa 1. Privatni pristup se čuva; stabilna v1.0 nije proglašena.

## Električni i vremenski ugovor

KY-040 je ovdje izričit pasivni profil s pet izvoda: GND, VCC (+), SW, DT (B), CLK (A). CLK/DT imaju svaki 10 kΩ prema VCC; SW nema ugrađeni pull-up. Kontakti se zatvaraju na GND. VCC primjera je 3,3 V za ESP32 i 5 V za Uno/Nano. Drukčije fizičke izvedbe treba zasebno provjeriti; naziv KY-040 ne jamči jednak raspored otpornika ili zadržnih položaja.

| Svojstvo | Ugovor ove inačice |
| --- | --- |
| Mirovanje A/B | 11 |
| CW, jedan zadržni korak | 11 → 01 → 00 → 10 → 11 |
| CCW | Obrnuti slijed |
| Četiri promjene | Jedan puni korak, bez pretpostavke o broju koraka po okretaju |
| Razmak bridova | 5–100 ms, početno 20 ms; primjer sirovih signala 100 ms |
| Opcionalno poskakivanje | Novi/stari/novi/stari/novi kontakt na 0/200/400/600/800 µs |
| Tipkalo | Aktivno LOW; programski pull-up, u primjerima 20 ms obrade stabilnog stanja |
| Početni mehanički položaj | Cijeli broj −10000…10000, ne šalje se programu kao očitanje |
| Red vrtnje | Do 32 nova koraka u zahtjevu i najviše 1280 kontaktnih događaja na čekanju |
| Trag kontakata | Posljednjih 128 promjena po komponenti, s vremenom i CSV izvozom |

Promjene smjera dodaju se redom, nakon ranije zadanih punih koraka. Živa promjena položaja ne preskače izravno na novo A/B stanje. Postavka poskakivanja vrijedi za novo zadanu vrtnju, ne prepravlja već zakazane bridove. Pokus poskakivanja dodaje 0,8 ms svakoj zakazanoj promjeni; cijeli korak pri zadanih 20 ms zato traje 83,2 ms umjesto 80 ms. Promjena brzine uređuje se u zaustavljenom stanju. Upravljački ulazi privremeni su; početni parametri projekta ostaju sačuvani. Run/Reset stvara novu instancu.

Model kontakata radi i bez VCC ako postoji druga električna putanja za pull-up: SW uz unutarnji pull-up i zajedničku masu i dalje može dati LOW. Istodobno je nedostatak napajanja vidljiv u dijagnostici. Floating ulaz nije skriveno HIGH/LOW stanje. Zatvaranje kontakta protiv aktivnog GPIO HIGH-a prijavljuje sukob. Spajanje A/B na isti čvor blokira pokretanje; 5 V pull-up na ESP32 je pogreška. Nano A6/A7 nisu digitalni ulazi.

`public/quadrature-inputs.mjs` priključuje otpornike i kontakte na zajednički električni model. MicroPython čita napone kroz `Pin.value()`; AVR čita stvarne registre emuliranog ATmega328P. Zakazani bridovi ulaze u postojeći AVR ciklusni raspored i mogu izazvati INT0/INT1. Mehanički položaj, planirani cilj i kontaktni trag dijagnostika su modela, a ne potvrđena programska mjerenja. MicroPython objavljuje dovršenu vrtnju i kada program spava bez čitanja pinova.

## Vidljiv programski dekoder

Vlastiti MIT `lab_encoder.py` dio je projekta i ZIP-a. Tablica 16 mogućih prijelaza prihvaća promjenu jednog bita, povratnim prijelazom poništava dio pomaka i broji tek cijeli ciklus do 11. Promjena obaju bitova odbacuje nepotpun korak i traži novu referentnu fazu. C++ inačica nalazi se izravno u sketchu; ne uvodi novu vanjsku biblioteku niti mijenja zaključane ranije biblioteke.

Oba glavna primjera koriste polling i početni programski brojač 0. To nije apsolutni enkoder. Promjena fizičkog početnog položaja na 20 zato ne uzrokuje programski ispis 20; sljedeći CW korak daje programski 1. SW resetira programski brojač, a ne mehanički položaj. Predugo čekanje ili ispis mogu izgubiti bridove; Gray provjera ne rekonstruira neopaženi pomak. MicroPython IRQ API nije dodan ovom etapom.

## Četiri nastavna primjera

1. **CLK, DT i tipkalo** — prvo uvodi digitalne signale i njihov slijed; ispisuje opažene razine. Razmak 100 ms smanjuje gubitak zbog serijskog ispisa, bez obećanja hvatanja svakog brida.
2. **Smjer, koraci i reset** — vidljiv dekoder, pozitivni/negativni broj koraka i SW reset.
3. **Poskakivanje i Gray dekoder** — isti dekoder uz unaprijed uključen deterministički pokus kontakta.
4. **PWM svjetlina LED-ice** — 5 % po koraku, raspon 0–100 %, tipkalo vraća 50 %. LED preko 680 Ω; GPIO7 na S3 / D9 na Arduinu.

Postojeća numeracija pet nastavnih vježbi nije mijenjana. Katalog Arduino programa ima 34 primjera po pločici, ukupno 68 artefakata. Ranijih 60 provjerava se prema početnom commitu etape 12B. Osam novih artefakata stvarno je prevedeno zaključanim CLI/core/GCC-om; izrađeni izvor i HEX povezani su postojećim hash ugovorom. Vlastiti izmijenjeni Arduino izvor i dalje traži lokalni prevoditelj.

## Provjere i granice

`npm run test:encoders` sadrži 23 jedinstvene provjere. One obuhvaćaju profil i ZIP, oba električna napona, oba smjera, red promjena, poskakivanje, pasivni SW, otpor pull-upa pod opterećenjem, nepriključene izvode, naponske domene, sukob aktivnog izvora, više neovisnih instanci, ograničenja reda, stvarne Python programe, programski reset, fizički početni pomak, gubitak pri sporom pollingu, nevaljane Gray prijelaze, stvarne Uno/Nano programe, INT0/INT1 s poskakivanjem pri razmaku 5 ms te produkcijski Nano Worker i Stop. Compiler slučaj nije zamjena za UI ili fizičku potvrdu.

Dokazi ove isporuke nalaze se u `docs/stage13a-evidence`; konačni sažetak navodi točan paket i ishod regresije. Ponavljanja nisu dodatne jedinstvene provjere. Provjere prethodnih etapa koje zapisuju svoje povijesne datoteke prenose se u mapu dokaza ove etape, a povijesni zapisi ostaju očuvani.

Model nema fizičko nasumično poskakivanje, RC mrežu, elektromagnetski šum, mehaničku dinamiku, apsolutni kut ili opterećenje osi. Brzina virtualnog vremena na AVR-u ne jamči istu brzinu izvođenja u stvarnom vremenu na mobilnom uređaju. Safari/iOS, Android, školsko računalo, fizički KY-040 i učenički pilot ostaju zasebne nepotvrđene provjere.

## Izvori

- [Joy-IT SensorKit — KY-040](https://sensorkit.joy-it.net/en/sensors/ky-040): oznake CLK/DT/SW, određivanje smjera redoslijedom stanja i primjer brojanja od početka. Stranica prikazuje više načina brojanja; ovaj profil izričito definira četiri brida po punom koraku. Vrijednost otpornika, poskakivanje i ograničenja reda projektni su ugovor, ne univerzalna tvrdnja proizvođača.
- Vlastiti MIT izvori električnog modela i dekodera u ovom repozitoriju.

Sljedeće prema planu: **13B — IR prijamnik i daljinski, prvo NEC**, s vremenskim nizom te kratkim/dugim pritiskom i ponavljanjem. To nije implementirano u ovoj isporuci.
