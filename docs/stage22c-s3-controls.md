# Etapa 22C — S3 Arduino C++: enkoder i pogoni

**0.12.2-beta.1 · 14. studenoga 2026.** Nastavak iz 0.12.1-beta.1, commit `565d685b96df7b7b7d1708ada5e449db6f769c8c`. Dodano je 13 izvršivih S3 C++ primjera na postojećim električnim i vremenskim modelima. Izdanje ostaje nastavna beta; razvojni testovi nisu potvrda fizičkih modula ili stvarnog učeničkog pilota.

## Otvaranje i novi primjeri

Odaberi **Vježbe → URS zbirka → S3 · Arduino C++**. URS08 sada nudi **3/3**, URS10 **7/7**, a URS11 **3/3** varijanti. Svaki otvara zaseban projekt s početnim programom, sklopom, radnim listom i točno vezanim WASM prijevodom. Svih 13 novih programa dostupno je i u izborniku **ESP32-S3 · ARDUINO C++**.

| Pokusi | Izvodi i opažanje |
| --- | --- |
| KY-040: sirovi kontakti, smjer/reset, poskakivanje, PWM LED | CLK/DT/SW=GPIO4/5/6, VCC=3V3 i GND. Četiri Gray brida daju korak; SW je aktivno LOW. PWM LED preko 680 Ω koristi GPIO7. |
| Relej COM/NO/NC | IN=GPIO6, VCC=5 V, LV=3V3, upravljačka masa zajednička. Kontakti stvarno preklapaju zaseban 5 V krug s dvije LED-ice i otpornicima 680 Ω. |
| Aktivna zujalica | SIG=GPIO7, VCC=5 V i GND. DC HIGH uključuje vlastiti modelni oscilator 2300 Hz, LOW gasi. To je generički modul s pogonom, ne potvrđeni SFM-20B. |
| Pasivni piezo | SIG=GPIO7, VCC=5 V i GND. LEDC daje 440/880/1320 Hz, 400 ms tona i 100 ms stanke; DC ostaje tih. |
| L298N: jedan motor, dva motora | ENA/ENB=GPIO4/5; IN1/2=GPIO8/9, IN3/4=GPIO10/11. VS=6 V, VSS=5 V, zajednički GND; EN i 5V-EN jumperi uklonjeni. Smjer, radni omjer, slobodno zaustavljanje i kočenje nastaju iz izlaza programa. |
| SG90 + motor + ton | GPIO6: LEDC 50 Hz/14 bita i 1000–2000 µs; GPIO7: 880 Hz/8 bita. ENA/ENB imaju zasebne LEDC izlaze 1 kHz/8 bita. SG90 ima zasebnih 5 V i zajedničku masu. |
| A4988: koraci/smjer, pet mikrostep načina, ENABLE/RESET/SLEEP | STEP/DIR/ENABLE/RESET/SLEEP/MS1/MS2/MS3=GPIO2/3/4/5/6/7/8/9. VDD=3V3, VMOT=12 V. Stvarni STEP impulsi pomiču translator i idealizirani motor s 200 punih koraka/okret. |

Novi vidljivi MIT **lab_encoder.h** čita GPIO kontakte. Ne čita mehanički položaj iz sučelja. CW slijed je 11→01→00→10→11; četiri brida čine korak. Nevaljan skok obaju bitova odbacuje nepotpuni korak. SW prihvaća novo stanje nakon 20 ms. Sintetsko poskakivanje vraća kontakt tijekom 800 µs; dekoder nije opće rješenje za propuštene bridove. Primjer sa sporim pollingom namjerno pokazuje izgubljene korake. Brojač počinje od 0 i kad model počinje na položaju 42.

Izmjena sketcha ili headera poništava priloženi prijevod do novog prevođenja. Promjena sklopa koristi isti prevedeni program kroz nove električne mreže. Projektni ZIP i fizički Arduino sketch izvoz čuvaju točne izvore i header. Pomoć za komponente sada dobiva stvarno odabrani jezik i pločicu, umjesto prvog jezika profila pločice.

## Opažanje i granice modela

Relej najprije zadaje neaktivni HIGH prije OUTPUT. LV je izričiti idealni prilagodnik Lab profila; nije univerzalni izvod kupljenog releja. Odspojeni IN ostaje neaktivan preko deklariranog pull otpornika. Odspojeni LV ne omogućuje aktivaciju zavojnice; zbog idealnog otpornika IN–LV, neopterećeni LV pri HIGH na IN može imati napon bez zasebnog izvora. To nije dokaz raspoložive snage.

LEDC upravlja tonom, svjetlinom i servo impulsom. Ovi S3 primjeri ne uvode AVR Servo, Timer1/Timer2 ili tone() podršku. Kombinirani primjer koristi četiri neovisna LEDC izlaza. Servo radni omjer zaokružuje se na najbliži 14-bitni broj; prikaz zato može biti približno 45,0°/135,1°. Nakon odvajanja LEDC tona program ponovno postavlja GPIO izlaz prije završnog LOW.

Pad mosta L298N izričiti je stalni parametar 2 V. Pri VS=6 V i duty 128/255 srednji napon motora iznosi oko 2,008 V; relativni pokazatelj 33,46 % nije RPM. Trenutačni izlazi mosta tijekom LOW dijela PWM-a mogu biti Hi-Z dok srednji napon i dalje pokazuje prethodni vremenski prosjek.

A4988 HIGH impuls traje 10 µs, LOW 4 ms. Mikrostep 1, 1/2, 1/4, 1/8 i 1/16 u primjeru svaki daju 18° i povratak na zajednički položaj. ENABLE gasi pobudu, ali translator i dalje broji. RESET postavlja električni Home; ne vraća osovinu. Nakon gubitka sinkronizacije prikazuje se nepoznat kut osovine uz odvojeni idealni zbroj. Nema strujne, mehaničke ni toplinske simulacije.

## Zbirka i matrica

| Cilj | URS varijante | Razvojno provjerene stavke | Eksperimentalne | Otvorene |
| --- | ---: | ---: | ---: | ---: |
| S3 MicroPython | 63 | 16 | 21 | 2 |
| S3 Arduino C++ | 45 | 0 | 34 | 5 |
| Uno R3 | 63 | 0 | 37 | 2 |
| Nano classic | 63 | 0 | 37 | 2 |

Zbirka i dalje ima **16 tema / 63 jedinstvene varijante**. Sva četiri cilja nude **234 puta varijanta × cilj**; dodatni ciljevi čvora B nisu pribrojeni. S3 izbornik ima **48 programa**, trinaest više nego prethodno. Matrica ostaje 39 stavki × četiri cilja = 156 polja; CSV i sučelje koriste iste podatke. Školske LV1/LV2 nisu mijenjane.

## Provjere i dokazi

**573/573 različita programska testa prošla su bez preskakanja ili preostale pogreške.** Skup uključuje 61 novi kontrolni slučaj, postojeće S3 core/biblioteke/analogne primjere, URS izvore/predaje, encoder/actuator/stepper modele i njihove stvarne MicroPython/AVR programe, projekt/sklop/pločice i offline slučajeve. AVR provjere prevođenja izvedene su s dostupnim zaključanim CLI/core/GCC alatima, nisu preskočene.

Novi testovi provjeravaju žive CW/CCW ulaze, reset i PWM granice; otvorene signale, napajanje i 5 V zabranu; oba relejna kontakta i kratki spoj; DC aktivni i izmjenični pasivni zvuk; frekvencije i trajanja; neovisne motore, Hi-Z i kočenje; četiri istodobna LEDC izlaza te STEP/mikrostep i kontrolu translatora. Stvarni compiler izvršio je izmijenjeni učenički polling i odbio nedostajući header. Uvoz/izvoz čuva točan izvor; izmijenjeni header odbija stari artefakt.

Zasebnih **16 završnih Worker pokusa** izvršava zapakirane programe: svih 13 novih primjera, otvoreni CLK, kratki spoj relejnog kontakta i odbijanje izmijenjenog headera bez novog prijevoda. Prisilni prekid mjeri se u razvojnom Node/Linuxu, s opaženim rasponom 1.69–3.28 ms i granicom 500 ms; pojedinačni rezultati i točan build nalaze se u `docs/stage22c-evidence/packaged-s3-controls.json`. Console i simulation poruke mogu stići odvojeno pa provjera živog enkodera čeka oba opažanja.

Prvi pokusi otkrili su završni GPIO nakon LEDC odvajanja i potrebu za zaokruživanjem servo impulsa. Ispravljeni su programi i ponovno prevedeni. Nekoliko početnih očekivanja testova usklađeno je sa stvarnim pull-upom otvorenog SW-a, idealnom LV mrežom i rasporedom poruka. Početni neuspjesi i završni uspjesi čuvaju se odvojeno. Ponovljeni pokusi ne povećavaju broj jedinstvenih testova.

Svih **35 ranijih S3 artefakata** ostalo je nepromijenjeno. MicroPython WASM, S3 core/ABI, električni/protokolni modeli i zaključane biblioteke nisu mijenjani. Starije datoteke regresijskih dokaza vraćene su na povijesno stanje; nova opažanja čuvaju se u mapi ove etape.

## Stvarno opaženo u pregledniku

U razvojnom Chromeu/Linuxu potvrđeni su URS08 3/3, URS10 7/7, URS11 3/3 te otvaranje radnog lista s točnim programom i lab_encoder.h. Žive tri CW i dvije CCW radnje dale su programski niz 1→2→3→2→1 uz ERR=0. Pritisak SW zatim je ispisao RESET P=0, bez promjene mehaničkog položaja. Stop je zadržao konzolu.

Kombinirani program ispisivao je 45° i 135°. U Mjerenjima su opaženi SG90 **135,1° / 1750,5 µs**, motor **+2,008 V / 33,46 %**, pasivni piezo **880,00 Hz** i zasebni PWM izlazi. Stop je sačuvao rezultate. Slušanje nije uključeno i nije uvjet provjere. Ovo nije fizički ili učenički pilot ni zasebna produkcijska preglednička potvrda.

## Lokalni paket

Raspakiraj **ESP32_MicroPython_Lab_0.12.2_Lokalno.zip** u zasebnu mapu. Potreban je Node.js 22+. Windows: **Pokreni.cmd**; Linux/macOS: `node start-local.mjs`. Otvori **http://127.0.0.1:4173/** i ostavi terminal otvoren. Promijenjeni C++ koristi postojeći lokalni prevoditelj; za ovu lokalnu aplikaciju postavi `LAB_ARDUINO_SITE=http://127.0.0.1:4173`.

Izgradnja **b68da38196da28f7**. Raspakirani ZIP poslužen je stvarnim loopback HTTP-om: **174 resursa / 14 242 060 B**, svi hashovi/veličine i dva WASM MIME odgovora potvrđeni. ZIP ima **4 851 929 B**, SHA-256 `b3d4ec4ac66a34248d02154ea63ed67b5167ac5ffbb6ac0a1b61bd5d4ffad945`. To nije hladni offline preglednički pokus.

## Nastavak

Za S3 C++ ostaju tri komponentna proširenja: **IR NEC, BMP280 SPI i ST7735**. Sljedeći paket 22D zatvara te putove, zatim slijedi dopuna preostalih S3 URS varijanti koje još nemaju zaseban primjer. Zasebni generički pretvornik razina i točna SFM-20B izvedba ostaju otvoreni na svim ciljevima. DevKitC V4 i CAM trebaju potvrđene zasebne profile.

Fizičko prevođenje novih izvoza na stvarnom Espressif coreu, fizička kalibracija/oprema, Windows/macOS, ciljni iOS/Safari/Android, hladni offline pokus i samostalan učenički pilot nisu potvrđeni ovom etapom. Stabilni puni URS v1.0 čeka zatvaranje dogovorenog opsega i stvarni pilot.

Izvori: `src/runtime/s3ControlExamples.ts`, `s3Examples.ts`, `src/lessons/ursCatalog.ts`, `src/boards/support.ts`, `supportReport.ts` i pomoć za komponente. Provjere: `verification/s3-controls.test.ts`, `verification/s3-controls-package.ts`, `verification/urs.test.ts` i `docs/stage22c-evidence/`.
