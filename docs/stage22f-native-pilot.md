# ESP32 MicroPython Lab — etapa 22F

**0.12.4-beta.1 · 14. studenoga 2026.** Nastavak izvora `f37939a1b41ea741dfbceac86cce1b7e9499ce05` (0.12.3-beta.1). Izdanje zadržava 16 URS tema, 63 varijante na svakom od četiri cilja i ukupno 252 kombinacije. Postojeći nastavni slijed, školske LV1/LV2, izvori primjera i električni modeli ostaju sačuvani.

## Izvoz za stvarni Espressif core

**Završno: 69/69 točnih aktualnih izvoza.** Početni potpuni prolaz imao je 68/69 uspjeha. Nakon ispravka kalibracije zasebni ponovljeni prijevod ima 1/1, a završni verifier potvrđuje svih 69 trenutačnih izvora i headera. Početni rezultati i pogreška nalaze se u `stage22f-evidence/native/initial/`, ispravljeni u `native/results.json`. Namjerno promijenjen SHA-256 u odvojenoj kopiji dokaza završni verifier odbija (`stale-evidence-guard.json`).

`verification/s3-native.ts` zasebno izvlači Arduino IDE ZIP svakog od 67 S3 C++ primjera i oba radijska programa TX/RX. Arduino CLI 1.3.1 prevodi ih s Espressif coreom 3.3.12 za `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi`. U prijevod ulaze točan `.ino`, svi pripadajući headeri i izričito odabrane, zaključane biblioteke. WASM rezultat ne ulazi u taj postupak.

Svaki zapis sadrži SHA-256 svih izvezenih datoteka, odabir biblioteka, zaseban compiler log te veličine i SHA-256 stvarnih ELF/BIN izlaza. Upozorenja iz corea i zaključanih biblioteka ostaju vidljiva u logovima; uspješan rezultat znači dovršeno prevođenje i oba izlaza, a ne odsutnost svih upozorenja. Zaključane biblioteke nisu mijenjane radi uklanjanja stilskih upozorenja.

Stvarni prijevod otkrio je ranije nevidljivu pogrešku primjera `touchCalibration`: globalne varijable `y0` i `y1` sukobljavaju se s istoimenim funkcijama iz Espressifova `math.h`. S3 izvor sada koristi `calX0`, `calX1`, `calY0` i `calY1`. Formule i upravljački program nisu promijenjeni. Ispravljeni točan izvoz ponovno je preveden uspješno; početni neuspjeh čuva se odvojeno.

Obnovljen je samo zapis S3 artefakta `touchCalibration`: veza s izvorom sada odgovara novim imenima. Njegovi optimizirani WASM bajtovi ostali su potpuno jednaki. Ostalih 66 zapisa S3 artefakata potpuno je jednako prethodnom izdanju. Osobni spremljeni projekti nisu tiho prepisani: za ispravljeni predložak ponovno otvori **URS13 → Kalibracija**; stari fizički izvoz s globalnim `y0/y1` treba isto preimenovanje i novo prevođenje. Podloga: `stage22f-evidence/artifact-changes.json`.

`verification/s3-native-verify.ts` uspoređuje svih 69 zapisa s trenutačno izvezenim datotekama. Promijenjeni izvor ili header, nedostajući/ponovljeni ključ, druga biblioteka ili neuspješan prijevod prekidaju provjeru. Usporedba se radi prema sadržaju datoteka; vremenske oznake samog ZIP-a nisu kriterij. Sažetak nastaje u `public/verification/s3-native-exports.json` tek nakon uspješne provjere cijelog opsega.

To je provjera prevođenja u Linuxu. Nije flashanje, izvršavanje firmwarea, mjerenje fizičkih vremena, kalibracija senzora ili provjera električnog sklopa. CLI-jev ispis globalnih varijabli nije mjerenje vršnog stoga, heapa ili PSRAM-a. Simulator i dalje izvodi svoj deklarirani funkcionalni WASM profil.

Alati su preuzeti prema službenom Espressif indeksu, uz provjeru navedenih veličina i SHA-256. Za ovu provjeru postavljen je izoliran S3 profil s potrebnim Xtensa alatima i S3 bibliotekama. Drugi SoC profili i alati za otklanjanje pogrešaka nisu time proglašeni instaliranima. Podloge: `stage22f-evidence/native/tool-profile.json` i `tool-downloads.json`.

Ponovljivi postupak nakon pripreme zasebnog Arduino CLI profila:

```sh
export LAB_ARDUINO_CLI=/put/do/arduino-cli
export LAB_ESP32_CONFIG=/put/do/arduino-cli.yaml
npm run s3:native
npm run s3:native:verify
```

Konfiguracija mora nuditi CLI 1.3.1 i `esp32:esp32@3.3.12`. Za uži pokus skripta prihvaća ključeve primjera, npr. `npm run s3:native -- irLED radioTX radioRX`; takav zapis nije cijela matrica i završni ga verifier odbija kao nepotpun. Nova cijela provjera ponovno gradi svih 69 primjera.

## Priprema i zapis stvarnog pilota

`/pilot.html` sada sadrži konkretan redoslijed pripreme škole, mobilnog uređaja i dva odvojena načina offline rada. Četiri preporučena pokusa su URS01 Tipkalo, URS12 BMP280 → ST7735, URS14 FAT16 datoteka i URS16 TX/RX par. Svaki uređaj, preglednik, cilj i pokus dobiva vlastiti zapis. Učenik najprije sam čita pojmove i upute; nastavnik bilježi svaku pomoć.

Obrazac razlikuje **stvarni učenički pilot**, **provjeru uređaja bez učenika** i **razvojni pregled**. Početni odabir nije potvrđen. Dovršen zapis traži datum, otvorenu inačicu aplikacije, računalo/OS, preglednik, trajanje i zaključak. Učenički zapis dodatno traži oznaku sudionika; pomoć i blokada imaju vlastita obvezna opažanja. Radio traži cilj drugog čvora.

Označena offline provjera traži način i opisan postupak. Offline paket preglednika na istoj adresi nakon zatvaranja i isključenja mreže zaseban je od lokalnog HTTP paketa s uključenim lokalnim poslužiteljem. Provjera širine prozora nije provjera stvarnog iPhonea ili Androida. Za promijenjeni C++ potreban je lokalni prevoditelj; uređaj bez njega može ispitivati pripremljeni program, ulaze i spojeve.

**Preuzmi nacrt JSON** sprema izričit nepotvrđeni nacrt. **Uvezi zapis / nacrt JSON** vraća opažanja, odabire i potvrdne okvire. Uvoz starijeg formata 2 čuva opažanja, uz nepoznatu vrstu i neprovjereni način offline pokusa koje treba odabrati prema stvarno provedenom radu. Novi zapis koristi format 3. To ne mijenja format URS projekta ni njegovih predaja.

Nevaljan ili prevelik JSON, nepoznata vježba/cilj, pogrešne vrste podataka i prekoračena polja odbijaju se prije zamjene obrasca. Ako postoje nespremljene izmjene, uvoz najprije traži odluku o zamjeni; odbijanje zadržava uneseni tekst. Obrazac ne šalje podatke poslužitelju i ne sprema ih automatski. Pri izlasku upozorava na nespremljene izmjene.

Vrsta i ishod zapisa ostaju ručne korisničke tvrdnje. Validacija ne potvrđuje da je učenik ili fizički uređaj stvarno sudjelovao.

## Vodič i razvojna provjera nastavnog toka

Vodič je imao zastarjelu oznaku 0.12.1 i podatak o 33 S3 C++ varijante. Sada build preuzima inačicu i brojeve iz stvarnog kataloga. Prikazuje 63/63 za svaki cilj i 252 kombinacije. Uklonjena je i zastarjela najava dvaju čvorova kao buduće mogućnosti; sadašnja granica radijskog para ostaje izričita.

U razvojnom Chromeu/Linuxu URS12 program dao je `SPI DASH T=24.00 P=101325 Pa`, zatim pri živim klizačima `SPI DASH T=-40.00 P=30000 Pa`. Uklanjanje BMP280 CS-a dovelo je do `BMP280 SPI ID/SPOJ ERROR`. Vraćanje vodiča i novo pokretanje obnovili su početna očitanja. Stvarno preuzeta predaja uvezena je kao zaustavljena kopija s opažanjima i odgovorima te ponovno pokrenuta u 0.12.4. Vizualno je pregledan početni TFT prikaz.

U stvarnom obrascu potvrđeni su odbijanje nepotpunog dovršenog zapisa, izvoz i uvoz nacrta, odbijanje nepoznatog formata bez zamjene polja te odustajanje i prihvaćanje zamjene nespremljenih opažanja. Stvarni v2 JSON uvezen je uz obavijest o dopuni vrste zapisa. Pregled je otkrio neželjeno vidljiv skriveni file input; izričito skrivanje uklanja dodatni engleski gumb, a hrvatski gumb za uvoz ostaje dostupan.

Sve su to razvojni pokusi. Nije proveden učenički pilot, školsko računalo, ciljni mobilni preglednik, prijavljena produkcijska sesija ili hladni offline preglednički pokus. Preglednički zapis: `stage22f-evidence/browser-review.json`.

## Provjere i granice

Široka regresija: **1.224/1.224 jedinstvena programska testa**, bez preskakanja ili pogreške. To je 1.211 ranijih testova i 13 novih testova zapisa pilota. Ponovljena ciljana izvođenja ne povećavaju broj jedinstvenih testova. Zapisi: `stage22f-evidence/full-regression-final.tap` i `pilot-final.tap`.

Osam zasebnih offline provjera prolazi **8/8**. Četiri pokusa završnih zapakiranih Workera prolaze **4/4**: MicroPython, S3 C++, Uno i Nano izvode stvarni URS regulator, prate promjenu temperature, histerezu, OLED i servo. Prisilni Stop u Node/Linuxu opažen je između 2,48 i 13,65 ms; to nije mjerenje školskog ili mobilnog uređaja. Zapisi: `offline-final.tap`, `packaged-urs.json` i `packaged-urs.txt`.

Lokalni paket **ESP32_MicroPython_Lab_0.12.4_Lokalno.zip** ima **5.158.741 B**, SHA-256 `cafad1da3138181c4693edbe9d22014a035e3f98f64564c1546724731531add3`. Izgradnja **b0e0f058eb1de6be**. Raspakirani ZIP poslužen je stvarnim loopback HTTP-om: **181 resurs / 15.206.774 B**, svi sadržajni hashovi/veličine i oba WASM MIME odgovora prošli su provjeru. U paketu su novi moduli obrasca i zapis 69 fizičkih izvoza. To nije hladni offline preglednički pokus. Podloga: `local-package.json`.

Raspakiraj ZIP u zasebnu mapu. Potreban je Node.js 22+. Windows: **Pokreni.cmd**; Linux/macOS: `node start-local.mjs`. Otvori **http://127.0.0.1:4173/** i ostavi terminal otvoren. Za promijenjeni C++ koristi postojeći lokalni prevoditelj; za ovu lokalnu aplikaciju postavi `LAB_ARDUINO_SITE=http://127.0.0.1:4173`.

MicroPython WASM, AVR i radijski artefakti, funkcionalni S3 core/ABI, protokolni/električni modeli i zaključane biblioteke nisu mijenjani. Od 67 S3 artefakata samo je zapis kalibracije obnovljen za preimenovani izvor; svi WASM bajtovi ostaju jednaki. Izdanje je nastavna beta. Izvoz projekta, opažanja i nastavnički pregled zadržavaju postojeća pravila; hash ne potvrđuje autorstvo.

Otvoreni ostaju samostalan generički pretvornik razina, točna SFM-20B izvedba te potvrđeni zasebni DevKitC V4 i CAM profili. Fizička oprema, Windows/macOS, ciljni iOS/Safari/Android, hladno offline otvaranje i stvarni samostalni rad učenika traže svoje opažene rezultate. Pripremljeni obrazac omogućuje prikupljanje tih rezultata, ali ih razvojni testovi ne proizvode. **Puna stabilna URS v1.0 još nije proglašena.**

## Primarne tehničke podloge

- [Službena instalacija Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html) i njezin službeni indeks paketa.
- [Arduino CLI compile](https://arduino.github.io/arduino-cli/latest/commands/arduino-cli_compile/) — FQBN, zasebni library argumenti i izlazne datoteke.
- [Espressif LEDC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html) — postojeći pin-based API primjera.

Podloge su provjerene 14. studenoga 2026. Rezultati aplikacije i prijevoda temelje se na stvarnim projektnim pokusima, ne na zaključivanju iz svojstava vanjskih biblioteka.
