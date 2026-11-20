# Prototip 03 — biblioteke i stvarne vježbe

Datum: 20. studenoga 2026. (Europe/Zagreb).
Razvojna grana: `prototype/arduino-offline-avr` u `zljix/labos`.

## Dovršeno lokalno

- 28 kombinacija stvarne vježbe i pločice (14 vježbi × Uno/Nano) prevedeno
  je novim WASM prevoditeljem i izvršeno na njihovom stvarnom Labos sklopu.
- Provjereni AHT10, servo, OLED 128×64/128×32, regulator, BMP180, BMP280,
  AM2320, LCD1602, BMP280 → LCD, DHT11, DHT22, DS18B20 i BMP280 preko SPI-ja.
- Dodatno su prevedeni Bounce2 i EEPROM programi na obje pločice.
  EEPROM provjera čita početnih 255 i zapisuje/čita 42 te adresu 1023.
- 31 test biblioteka (uključuje roditeljsku cjelinu i 28 potprovjera),
  16 ranijih testova prototipa: svi prolaze, nema preskakanja.
- Regresija projekta, sklopa i Arduino ugovora: 37 prolaza, 4 opcionalna
  Arduino CLI testa preskočena. TypeScript provjera glavne aplikacije prolazi.
- Potvrđeni izvoz/uvoz, promjena biblioteka, nevaljane inačice i sažeci,
  ovisnost DallasTemperature/OneWire i isključivost U8g2 paketa.
- Paket se nadograđuje bez brisanja starih SDK-ova i drugih spremišta;
  test prekinute nadogradnje i ponovnog korištenja postojećih alata prolazi.

Node matrica izričito zabranjuje `fetch`. Zasebna CI provjera u stvarnom
Chromiumu također je uspješno dovršena, kako je opisano ispod.

Nakon korisnikova odobrenja razvojna verzija spremljena je u
`10724688b69cb109fb9406e2e70d41cf428b92b7`. Stablo datoteka identično je
lokalno provjerenoj verziji (`8f08a5bc575a173e726d87d3ac0474386401aa59`).
Provjera: [GitHub Actions 44639936114](https://github.com/zljix/labos/actions/runs/44639936114).
**Rezultat: success**, posao `135968088697`, završeno 20. studenoga 2026.
u 00:52 (Europe/Zagreb). Dokumentacijski commit koji sprema ovaj izvještaj
nije zasebno testirani izvršni kod.

## Potpuna mrežna izolacija — potvrđeno

- Ponovna izgradnja SDK-a, jezgri i svih biblioteka dala je iste manifeste
  i SHA-256 kao lokalna izgradnja; CI provjera razlika prošla je.
- Svih 47 testova prototipa prošlo je i na CI hostu, bez preskakanja.
- Chromium 151.0.7922.34 otvoren je u zasebnom Linux mrežnom prostoru,
  sa samo isključenim sučeljem `lo`, bez HTTP poslužitelja.
- Zabilježeno je 13 uspješnih prevođenja tijekom izolirane faze, uključujući
  nove Uno/Nano izvore, zasebne C/C++ datoteke i uvezene projekte.
- AHT10 + U8g2 OLED + Servo projekt preveden je s novom porukom nastalom
  nakon prekida mreže. Simulator je prikazao T=24,00 °C, RH=50,00 %, kut 0°
  i 287 popunjenih bajtova slike OLED-a.
- Promjena izbora biblioteke odbacila je stari rezultat. Pravila ovisnosti
  DallasTemperature/OneWire i isključivosti U8g2 paketa prošla su kroz sučelje.
- Standardni JSON izvoz očuvao je odabir biblioteka. Puni restart preglednika
  očuvao je projekt i odabir; dodatno izmijenjen izvor ponovno je preveden i
  izvršen bez mreže. Nije bilo pogrešaka stranice.
- Predmemorija i profil nisu brisani između faza i restarta. Nepovezana
  spremišta ostala su očuvana.
- Snimke desktop prikaza i širine 390 px pregledane su; nema vodoravnog
  prelijevanja. To nije test fizičkog mobitela.

Dokazi: [prepare.json](evidence-05/prepare.json),
[isolated.json](evidence-05/isolated.json) i
[libraries-ci.json](evidence-05/libraries-ci.json).
[CI artefakt sa snimkama](https://github.com/zljix/labos/actions/runs/44639936114/artifacts/14586720949)
ima 481047 B i rok čuvanja do 19. prosinca 2026. Preuzet je i potvrđen SHA-256:
`e7c84dc25c9222e0be18fabe3f2f9e7ed1e417ab50e03754b5ebb0371a995525`.

Najveći uzorkovani zbroj RSS-a potomaka bio je 1366916 KiB (oko 1,30 GiB),
266 uzoraka svakih 200 ms. Uključuje višestruko brojanje dijeljenih stranica,
ne uključuje Node host i nije stroga gornja granica ni potrošnja samo Workera.
CI Chromium koristi `--no-sandbox`; potvrđena je zasebna OS mrežna izolacija,
ne Chromiumov vlastiti sandbox.

## Paket

Komprimirani alati i SDK: **15.656.278 B (14,93 MiB)**; shell, arhive
izvora i licence nisu uračunati. Raspakirani SDK: **17.361.433 B**.
Identitet paketa:
`e5ca9eb29a44c68fcbebe6160d339edc12a13b77d013af8c4c5573c9f2315924`.

Biblioteke se grade iz zaključanih izvora odvojeno za obje pločice.
Manifest s naredbama i sažecima: `library-build-manifest.json`.
Izvori s licencama: razvojni izlaz `toolchain/labos-library-sources.tar.gz`.
Stari rezultati prototipa zahtijevaju ponovno prevođenje pod novim paketom.

## Dokazi i granice

Lokalni dokazi su u [evidence-05](evidence-05). Mjerenja ovog računala nisu
mjerenja školskog i5-6600 ili fizičkih mobitela. Nema tvrdnje o podršci
svim vježbama izvan provjerene matrice.

Trajanje simulacije može se odabrati (1,2 / 3 / 5 s) da stane i DHT22
stabilizacija. EEPROM je 1024 B i počinje s 0xFF pri svakoj simulaciji;
njegov sadržaj zasad se ne čuva između pokretanja.

Glavna aplikacija, Arduino CLI format, bodovanje i `labosv2` nisu mijenjani.
Preostaju integracija u glavno sučelje, uvjeti distribucije upstream alata
i pilot na školskom računalu i fizičkim mobitelima.
