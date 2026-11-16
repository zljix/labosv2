# Etapa 24J · ILI9341 i dodir XPT2046

Izdanje **0.14.8-beta.1**, provjeravač `24J.1`, dodaje šest rubrika i 24 kombinacije: **208 od 268**, odnosno 52 URS varijante na MicroPythonu S3, S3 C++, Unu i Nanu. Svih 53 ranijih rubrika ostaje neizmijenjeno. Uvodne V1–V5 ostaju zasebne lokalne provjere.

## Uvjeti su objavljeni prije rada

Svaka rubrika ima 10 bodova: 3 za stvarne napajane putove, 5 za osnovnu funkciju i 2 za nastavak. Provjerava se točna spremljena snimka i nepromjenjivi objavljeni ugovor. Drugi algoritmi, valjani GPIO i električno ekvivalentan raspored dopušteni su. Bodovani dijelovi slike zadržavaju objavljeni font i položaje; slobodni dijelovi ostaju slobodni.

| Rubrika | 5 bodova | 2 boda |
| --- | --- | --- |
| `24J-iliGraphics@1` | Trake i naslov u primljenim RGB565 pikselima | Geometrija i krajnji piksel (239,319) |
| `24J-iliRotation@1` | Prve dvije rotacije i fizički kutovi | Četiri rotacije i povrat na početnu |
| `24J-touchRaw@1` | Nova sirova očitanja kroz pritisak i povlačenje | Otpuštanje, kut i promjena relativnog pritiska |
| `24J-touchCalibration@1` | Dva križića, izmjereni krajevi i prva nova točka | Povlačenje, rubovi, otpuštanja i primljeni pikseli |
| `24J-touchButton@1` | Novi dodir, držanje i povlačenje uz stvarnu LED | Ponovljeni pritisci i položaji uz rubove tipkala |
| `24J-touchRotation@1` | Dvije rotacije, koordinate i odvajanje držanja od pritiska | Sve četiri rotacije, fizički kutovi i povrat |

## Primljeni pikseli i dovršena očitanja

ILI9341 se promatra preko fizičke RAM memorije 240×320 nakon stvarnih SPI RGB565 upisa. Provjeravaju se i uključeni i pozadinski pikseli, BL=3V3, izlazak iz sleep načina, COLMOD=0x55 i pripadna MADCTL rotacija. Ispis i lokalni framebuffer ne mogu nacrtati rezultat. Grafika provjerava i piksel (239,319), za koji trebaju oba bajta adrese.

XPT2046 telemetrija bilježi kanal tek kad su oba povratna podatkovna bajta doista prenesena preko spojenog MISO ulaza. Djelomičan prijenos, pogrešan CS i samo pokrenuta pretvorba nisu očitanje. Zapisi su ograničeni na posljednjih 128 kanala; TFT upisi ih ne prepisuju. Podržani su zasebni i preklopljeni 16/24-taktni prijenosi. Broj pretvorbi ili prikaz fizičke pobude sami ne donose bodove.

Kalibracijska provjera koristi dva deklarirana virtualna panela: (320,3720,400,3650) ili (450,3500,180,3880). Postojeći program iz dva stvarno izmjerena križića računa krajeve. Fiksne standardne konstante zato ne mogu riješiti taj pokus. Zadani panel simulatora ostaje 200–3900 / 250–3850. Privatna provjera mijenja samo svoju izvršnu kopiju konfiguracije, ne spremljeni učenički projekt.

C++ cjelobrojno preslikavanje i Python zaokruživanje smiju se razlikovati do jednoga piksela. Kalibracijski krajevi imaju toleranciju ±3 ADC koraka. Z1/Z2 su bezdimenzijski ADC podaci, a ne sila ili tlak u Pa. Dodirno tipkalo provjerava struju LED-ice i stvarne piksele, uključujući držanje, povlačenje i ulazak u polje bez novoga pritiska.

## Točne pojedinačne specifikacije

### ILI9341: boje, tekst i geometrija

Prikaži trake (0,0,80,48) crveno, (80,0,80,48) zeleno i (160,0,80,48) plavo; bijelo ILI9341 u (25,70), skala 4. Dodaj žuti okvir (10,125,220,180), cijan dijagonalu (11,126)–(228,303), magenta (228,126)–(11,303) i magenta piksel (239,319). Pokaži rezultat do 3500 ms, stabilno najmanje 100 ms. 3 boda stvarni spoj i upis, 5 trake/tekst, 2 okvir, dijagonale i 16-bitno adresirani krajnji piksel.

### ILI9341: četiri rotacije i povrat

Ponavljaj rotacije 0,1,2,3. Svaka: crvena oznaka 24×24 logički gore lijevo, bijeli vanjski okvir i zeleni ROT n u (36,visina/2), skala 3. Početak do 3500 ms, najmanje 100 ms stabilnog prikaza, razmak početaka 800–6000 ms. Provjera traje 30000 ms. 3 boda stvarni upis; 5 slijed 0,1; 2 nastavak 2,3,0 uz ispravne fizičke kutove i dimenzije.

### XPT2046: novi sirovi X/Y/Z1/Z2 i IRQ

Šest etapa po 2500 ms: otpušteno, pritisak, povlačenje/promjena Z, otpuštanje, kut, otpuštanje. Sjeme bira A=(61,83) ili (73,97), B=(177,263) ili (163,247), kut (239,0) ili (0,319). Pritisak je 50, 80 i 25 %. U svakoj etapi čitaj sva četiri 12-bitna kanala i ispisuj TOUCH RAW X=n Y=n Z1=n Z2=n IRQ=n. Standardni krajevi 200–3900/250–3850; Z1=round(20p), Z2=4095−round(15p). Bez dodira X=Y=Z1=0, Z2=4095, IRQ=1; s dodirom IRQ=0. Nakon početnih 500 ms barem dva valjana ispisa, prvi do 2300 ms, daljnji razmak najviše 600 ms. Z nije sila ni tlak u Pa. Zadrži početni naslov SIROVI DODIR/PRATI KONZOLU. 3 boda oba napajana puta i stvarno primljena četiri ADC kanala, 5 prve tri etape, 2 preostale tri.

### XPT2046: izmjerena kalibracija i pikseli

Trinaest etapa po 2500 ms: prvi križić bez dodira, pritisak (20,20), držanje, otpuštanje/drugi križić, pritisak (219,299), otpuštanje/izračun, A, povlačenje B, otpuštanje, (237,317), otpuštanje, (2,2), otpuštanje. A/B ovise o sjemenu kao kod sirovog dodira. Privatna kopija panela ima krajeve (320,3720,400,3650) ili (450,3500,180,3880); izračunaj ih iz stvarnih očitanja dvaju križića i ispiši CAL READY x0 x1 y0 y1, tolerancija ±3 ADC koraka. Ne koristi fiksnu kalibraciju. Nakon kalibracije ispisuj CAL POINT x y (±1 piksel), bijelo X x Y y u (12,115), skala 2 i žutu oznaku 5×5 sa središtem u točki. Pokaži KALIBRIRANO u (20,30), zeleno, skala 2. Otpušten dodir ne daje CAL POINT. Svaka točka nakon 500 ms ima barem dva valjana ispisa i odgovarajuće primljene piksele. 3 boda oba puta, 5 križići/otpuštanja/izmjereni krajevi i prva točka, 2 povlačenje, rubne točke i svi pripadni pikseli.

### XPT2046: rub novog dodira, hit-test i LED

Šesnaest etapa po 2500 ms: otpušteno; novi (120,160); držanje/pomak (170,170); povlačenje izvan (220,80); otpusti; novi izvan (220,80); uvuci zadržani dodir (120,160); otpusti; novi (32,122); otpusti; novi izvan (212,160); otpusti; novi (208,198); otpusti; novi izvan (120,202); otpusti. Preklopi LED samo na početku novog valjanog dodira unutar x≥30,x<210,y≥120,y<200. Držanje i ulazak izvan→unutra bez otpuštanja ne preklapaju LED. Kalibracija je standardna 200–3900/250–3850, rotacija 0; položaji su najmanje 2 piksela od ruba zbog kvantizacije. Početna LED ugašena. Do 2300 ms svake etape LED i tipkalo moraju biti ispravni i ostati takvi do kraja. Pravokutnik (30,120,180,80) je plav kad je LED ugašena, zelen kad svijetli, bijelo LED OFF/LED ON u (48,150), skala 3. 3 boda oba SPI puta i stvarna struja LED-ice, 5 prvih osam etapa, 2 svi rubni i ponovljeni pritisci. Konzolni ispis LED nije dokaz izlaza.

### XPT2046: koordinate u četiri rotacije

Dvanaest etapa po 2500 ms: otpušteno; novi A (rotacija 0→1); povlačenje B bez novog pritiska; otpusti; novi A (1→2); otpusti; novi A (2→3); otpusti; novi A (3→0); otpusti; novi B (0→1); otpusti. A/B ovise o sjemenu kao kod sirovog dodira. Svaki novi pritisak ispisuje točno jedan TOUCH ROT=r X=x Y=y za prethodnu rotaciju, pa nacrta sljedeću. Preslikavanje: r0=(x,y), r1=(y,239−x), r2=(239−x,319−y), r3=(319−y,x), tolerancija ±1 piksel. Zadrži standardne krajeve 200–3900/250–3850. Držanje/povlačenje/otpuštanje ne daju novu poruku. Novi zaslon: bijeli okvir, crveni kut 24×24 i cijan ROT r u (35,90), skala 3; odgovarajući fizički pikseli moraju biti stabilni barem 100 ms u svakoj etapi. 3 boda oba stvarna puta i četiri ADC kanala; 5 prve dvije nove rotacije s držanjem/otpuštanjem, 2 ostale rotacije i povrat.

## Provjere i nadogradnja

`verification/school-touch.test.ts` provjerava tri izvršna ponavljanja svih 24 kombinacije, prekide oba komunikacijska puta, popravak, drugo sjeme, alternativne algoritme i preuređene sklopove. Svaka rubrika ima neovisno pogrešno osnovno i napredno rješenje: očekuje se 3/10 odnosno 8/10. C++ reference, alternative i oba pogrešna rješenja zasebno se prevode za S3 C++, Uno i Nano: ukupno 72 prijevoda.

`verification/school-touch-api.test.mjs` provjerava svih 24 dodjele kroz pravi PHP/MySQL: objavu ugovora, stvarne bodove, odbijanje stranog ugovora, zaključavanje i čuvanje ranije zaključane predaje. Zaseban prihvat uključuje ranije obitelji, račune, razrede, spremanje, izvještaje, povrat kopije i sintetski razred od 30 učenika. Izvršni zapisi nastaju provjerama, a potvrđeni opseg bilježi završni sažetak.

Nema nove SQL migracije. Prije zamjene sačuvaj bazu i privatnu konfiguraciju. Zamijeni kompletan paket, sačuvaj ključ i sesije, pokreni postojeći `migrate` i ponovno pokreni Linux provjeravače. Novu rubriku izričito odaberi pri objavi novog zadatka. Stare dodjele, upute i zaključane predaje ostaju vezane uz stare ugovore.

Izolacija ostaje 65 s zidnog i 58 s CPU vremena, 90 s prevođenja, 2048 MiB adresnog prostora i 1 MiB izlaza. Tehnički kvar i nepodržan izvor ostaju bez bodova. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i ukupno cgroup ograničenje memorije ostaju zasebni završni uvjeti. Slijedi 24K: RTC i SD po postojećem katalogu; optičke i preostale sabirničke provjere također ostaju u nepodržanom dijelu matrice.

## Završni prihvat

[Potpuni školski prihvat](https://github.com/zljix/labosv2/actions/runs/43959526722) uspješno je dovršen. Objedinjuje [neovisne izvedbe svih četiriju ciljeva](https://github.com/zljix/labosv2/actions/runs/43957177747): ukupno 234 ciljane izvedbe, 72 prijevoda, 24 nove zaključane dodjele i regresije ranijih obitelji. Školski API dodatno je potvrdio račune, razrede, istodobno spremanje, izvještaje, korekcije, arhivu, povrat kopije i sintetski razred od 30 učenika.

[Sažetak](stage24j-evidence/acceptance-summary.json) i [podrijetlo bajtova](stage24j-evidence/program-provenance.json) potvrđuju isti SHA-256 provjeravača u nativnim pokusima, PHP/MySQL dodjelama i isporučenom paketu. Dokumentacijska dorada nakon prihvata ne mijenja programske datoteke. Otisci svih 896 početnih datoteka CI isporuke zasebno su provjereni.
