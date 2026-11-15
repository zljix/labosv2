# ESP32 MicroPython Lab — etapa 22H

**0.12.6-beta.1 · 14. studenoga 2026.** Nastavak izvora `38bbf9a1469fd984810765e7e8225b5cff2b65d5` (0.12.5). Dodani su zaseban automatski I2C pretvornik i URS18. Prethodne URS01–17, školske LV1/LV2 i pet početnih V vježbi zadržavaju numeraciju.

## Što je dovršeno

Katalog sada ima **I2C · automatski pretvornik 3,3 ↔ 5 V**. To je izričit nastavni Lab carrier prema principu AN10441, a ne potvrda pinouta nekog kupljenog modula. Priključci su LV, HV, zajednički GND i odvojeni parovi SDA_L/SCL_L te SDA_H/SCL_H. LV je fiksno 3,3 V, HV 5 V. Četiri ugrađena pull-up otpornika od 10 kΩ mogu se isključiti radi vanjskih otpornika. Njihova vrijednost i označavanje priključaka projektne su odluke.

Otvoreni odvod aktivno povlači LOW ili otpušta liniju. Otpuštena niža strana doseže 3,3 V, a viša 5 V; LOW prelazi u oba smjera. **Nema DIR-a.** Prethodni SN74LVC2T45 ostaje zaseban push-pull GPIO profil s DIR-om u URS17.

`public/i2c-level-shifter.mjs` rješava funkcionalno stanje pretvornika i upareni SDA/SCL put. Zajednički DC solver dodaje pull-up otpornike i idealni zatvoreni signalni prekidač pri LOW. Numeričkih 0,1 Ω i granica 0,3 × napajanje pripadaju Lab aproksimaciji; nisu izmjeren MOSFET otpor ili tranzistorska karakteristika. HIGH ne spaja naponske izvore, a običan vodič između domena ne zamjenjuje pretvornik.

I2C usmjeravanje traži oba kanala istog pretvornika, odgovarajuću domenu pločice i uređaja, valjana napajanja, zajedničku masu i pull-up na obje strane. Prenosi se stvarni byte-level protokol postojećeg drivera: identitet, registri, kalibracija, mjerenja i OLED pikseli nastaju iz programa. Pretvornik ne mijenja adresu. AHT10 zadržava zasebnu sabirnicu, a adresni sukob ostaje pogreška i preko pretvornika.

Provjera sklopa odbija premoštene domene, spojene SDA/SCL mreže, pogrešno napajanje, izravni spoj signal–napajanje/masa, pogrešnu domenu uređaja/GPIO-a, zamijenjene oznake SDA/SCL, Nano A6/A7 kao digitalne linije, kaskadu i nepodržane protokolne komponente. Tijekom rada prepoznaju se zadržana linija, aktivni HIGH protiv LOW i prenapon kroz pogrešan vanjski pull-up. Prekinuti vodič ne daje ACK samo zato što obje odvojene strane još imaju HIGH.

Posebno je provjeren **povrat napona kroz pull-up otpornike**: odspojeni HV u neopterećenom modelu može još pokazivati približno 5 V. Bez stvarnog priključka na izvor model ga ne prihvaća kao valjano napajanje i odbija I2C prijenos. Poruka to objašnjava. Takvo odbijanje prijenosa nije tvrdnja o fizičkoj izolaciji ili hot-swap zaštiti.

## URS18 i nastavni slijed

**Vježbe → URS zbirka → I2C u dvije naponske domene** najprije uvodi otvoreni odvod, pull-up, dva napona HIGH, zajedničku masu i automatski prijenos. Tek zatim učenik pokreće program, uspoređuje napone i dokazuje komunikaciju zapisom I2C prijenosa i novim rezultatom.

| Cilj | Strana pločice | Udaljeni BMP280 / OLED128×32 |
| --- | --- | --- |
| ESP32-S3 · MicroPython | SDA_L/SCL_L, GPIO8/9, 3,3 V | SDA_H/SCL_H, izričit 5 V carrier s regulatorom i prilagodbom |
| ESP32-S3 · Arduino C++ | SDA_L/SCL_L, GPIO8/9, 3,3 V | SDA_H/SCL_H, izričit 5 V carrier s regulatorom i prilagodbom |
| Uno R3 · Arduino C++ | SDA_H/SCL_H, A4/A5, 5 V | SDA_L/SCL_L, izvorni 3,3 V modul |
| Nano classic · Arduino C++ | SDA_H/SCL_H, A4/A5, 5 V | SDA_L/SCL_L, izvorni 3,3 V modul |

5 V carrier u S3 primjeru nije goli BMP280/SSD1306 ni tvrdnja da svaki fizički modul prihvaća 5 V. Uno/Nano primjer pokazuje zaseban pretvornik ispred 3,3 V modula. Upute i svojstva navode odabranu izvedbu.

Dvije varijante koriste **točne postojeće BMP280 i OLED128×32 programe, drivere i prevedene artefakte**. Mijenja se sklop. Nisu dodani skriveni programski prečaci ni izmišljeni prijevodi. Promijenjeni C++ izvor ili header i dalje traži novo prevođenje.

BMP280 pokus traži promjenu temperature/tlaka i novo kompenzirano očitanje; OLED traži usporedbu uzastopnih prikaza ili izmjenu teksta uz prevođenje. Obje varijante imaju uklanjanje HV vodiča, zapis pogreške i potvrdu oporavka. Radni list, odgovori, nastavnički pregled i ZIP round trip slijede postojeća URS pravila.

Zbirka sada ima **18 tema, 67 varijanti po cilju i ukupno 268 kombinacija**. Matrica podrške ima **40 stavki × četiri cilja**. Vodič, CSV, obrazac pilota i README lokalnog paketa dobivaju aktualne brojeve iz generiranog sažetka kataloga, pa se stari brojevi ne prepisuju ručno u novi paket.

## Provjere i stvarna opažanja

**1.308/1.308 jedinstvenih testova ima uspješan posljednji rezultat**, bez preostalih neuspjeha ili preskakanja. U taj je broj uključeno osam offline testova i 13 testova zapisa pilota; ponovljeni testovi ne povećavaju broj. Novi pretvornik ima 32 zasebna testa, a osam URS putova ulazi u postojeću provjeru izvora, sklopa, artefakta i ZIP-a.

Početna široka regresija dala je 1.259 prolaza, šest neuspjeha i 20 preskakanja u 1.285 TS testova. Šest compiler pokusa nije našlo `clang++-19`; 20 je po postojećim pravilima bilo preskočeno bez postavljenog alatnog lanca. Pronađeni su postojeći Clang 19.1.7, WASM linker, Binaryen 120 i Arduino CLI/core. **Svih 26 odabranih compiler pokusa zatim prolazi.** Njihovih 24 praznih file-wrapper rezultata u filtriranom Node pokretanju nisu ubrojena kao novi testovi. Završni ciljani skup prolazi 342/342, uključujući dva dodatna testa za neizravni prenapon i Nano analogne priključke.

Prvi odvojeni pilot/offline skup otkrio je jedno staro testno očekivanje 260 umjesto 268 kombinacija. Očekivanje sada čita aktualni sažetak kataloga; završnih **21/21** prolazi. Prvi novi unit skup imao je dvije testne pogreške: konflikt se pokušavao postaviti već statički kratko spojenim tipkalom, a adresni test tražio je riječ koje nema u postojećoj poruci. Pokusi su popravljeni bez ublažavanja električnih pravila. Izvorni zapisi i korelacija čuvaju se u `stage22h-evidence`; sažetak je `regression-summary.json`.

**8/8 scenarija završnih zapakiranih Workera**, ukupno **24 pokretanja**, prolazi na izgradnji `90a10acb9b416f14`: oba programa na MicroPythonu, S3 C++, Unu i Nanu. Svaki scenarij uvozi izvezeni URS ZIP, prati oba napona i promjenu temperature/tlaka ili novih OLED piksela, zatim pokreće primjer bez HV napajanja i ponovno s vraćenim vodičem. Programi se stvarno izvršavaju; Worker se prisilno zaustavlja nakon opažanja.

Dodatna **dva završna AVR Worker pokusa** potvrđuju postojeći nepromijenjeni U8g2 software-I2C program na GPIO6/7, preko pretvornika prema OLED128×64. Novi put otkriva se iz stvarne topologije, a ACK i bajtovi slijede GPIO bridove. Početni rok od 20 s bio je prekratak za ovu instrukcijsku/DC provjeru: posljednji okvir Unoa bio je na približno 840 ms virtualnog vremena, tijekom slanja početne prazne slike. Završni pokusi uz dulji rok promatranja prolaze za Uno i Nano. To nije mjerenje fizičke brzine, školskog računala ili ciljnog preglednika. Zapis je `packaged-i2c-software.json`. Ukupan broj završnih Worker pokretanja je **26**, odvojeno od 1.308 testova.

U razvojnom Chromeu/Linuxu S3 C++ primjer pokazao je SDA/SCL **3,30 V ↔ 5,00 V**, `BMP280 T=24.00 P=101325`, zatim nakon promjene temperature `T=32.50`. Uklanjanje HV vodiča dalo je nevaljano napajanje i poruke o nevaljanom mjerenju. Undo, vraćanje vodiča i novo pokretanje vratili su `T=24.00 P=101325`. To je razvojni pregled, bez fizičkog senzora, prijavljene produkcijske provjere ili učenika. Zapis je `browser-review.json`.

**69 točnih S3 izvoza** ponovno je uspoređeno s ranijim izvornim Espressif compiler dokazima iz 22F. Nisu ponovno izvedeni svi native prijevodi. Novi URS primjeri koriste iste izvore; svi postojeći S3/AVR/radio artefakti, MicroPython i zaključane biblioteke ostaju bajtno jednaki polazištu. `retained-artifacts.json` sadrži hashove ključnih datoteka. Povijesni zapisi starijih etapa zadržavaju izvorne bajtove; novo generirana regresijska opažanja smještena su uz ovu etapu.

## Lokalni paket

**ESP32_MicroPython_Lab_0.12.6_Lokalno.zip**, izgradnja **90a10acb9b416f14**, ima **5.183.458 B** i SHA-256:

`4b98771479dfc3a93255c5a06cdbd8efe65c58d7fde7a0e07c605cd1e8f5932b`

Raspakirani ZIP poslužen je stvarnim loopback HTTP-om. Svih **186 resursa / 15.279.774 B** ima očekivanu veličinu i SHA-256; oba WASM MIME odgovora prolaze. Paket sadrži novi model, URS18, aktualnu matricu/vodič/pilot i README s aktualnim brojevima. To nije hladno offline otvaranje privatne produkcijske adrese. Zapis je `local-package.json`.

Raspakiraj u zasebnu mapu i koristi Node.js 22+. Windows: `Pokreni.cmd`; Linux/macOS: `node start-local.mjs`. Otvori `http://127.0.0.1:4173/` i ostavi terminal otvoren. Aplikacija nakon raspakiravanja ne treba npm ili vanjsku mrežu. Za promijenjeni C++ izvor koristi lokalni prevoditelj; njegov `LAB_ARDUINO_SITE` za ovu lokalnu aplikaciju postavi na navedenu adresu.

## Granice i nastavak

Model pokriva funkcionalni DC otvoreni odvod i postojeće I2C transakcije do granice virtualnog adaptera. Nema MOSFET transfer krivulje, RC kapaciteta/vremena porasta, strujne/toplinske simulacije, clock-stretchinga, arbitraže, Hs-mode, kaskade, hot-swap modela ili potvrđene fizičke frekvencije. SPI, DHT i 1-Wire kroz ovu komponentu nisu time omogućeni. Prikaz DC uzoraka ne crta svaki pojedinačni I2C bit.

Automatski I2C pretvornik zatvoren je ovim izričitim Lab profilom. Točna SFM-20B izvedba i zasebni DevKitC V4/CAM profili ostaju otvoreni do potvrde izvedbe. Školsko računalo, fizička oprema, Windows/macOS, ciljni iOS/Safari/Android, hladno offline otvaranje i stvarni samostalni učenički pilot traže vlastita opažanja. Izdanje ostaje **nastavna beta**; stabilna URS v1.0 nije proglašena.

## Primarna podloga

[Nexperia AN10441, rev. 2, Level shifting techniques in I²C-bus design](https://assets.nexperia.com/documents/application-note/AN10441.pdf), slika 1 i odjeljak 2.1.1; provjereno 14. studenoga 2026. Izvor opisuje dva naponska područja, otvoreni odvod i prijenos LOW u oba smjera bez DIR-a. Fiksne domene, priključci, 10 kΩ, numerički prekidač i prihvat napajanja odluke su nastavnog modela; ne predstavljaju fizičku validaciju modula.
