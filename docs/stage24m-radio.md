# Etapa 24M · NRF24L01+ i bodovanje para

Izdanje **0.14.11-beta.1**, provjeravač `24M.1`, dodaje rubriku `24M-radio@1` za postojeći URS16. Službeno je podržano **252/268 kombinacija**, odnosno 63 od 67 URS varijanti na četiri glavna cilja. Svih 69 ranijih rubrika ostaje sadržajno i identitetski isto. V1–V5 ostaju zasebne lokalne provjere.

Matrica broji četiri glavna cilja. Drugi čvor može biti bilo koji od četiri podržana cilja, pa se zasebno provjerava svih 16 izvršnih parova; nazivnik 268 time se ne povećava. Oba programa, oba sklopa i driveri sastavni su dio iste nepromjenjive školske snimke.

## Uvjeti i kriteriji

| Bodovi | Provjera |
| --- | --- |
| 3 | Napajani SPI i CE putovi obaju čvorova, potvrđeni stvarnim čitanjem registra |
| 5 | Deset osmobajtnih paketa 1–10, stvarni ACK, deset potpunih RX čitanja i odgovarajući ispisi |
| 2 | Gubitak ACK-a/podataka bez duplikata, MAX_RT pri blokadi te uspješan novi pokus nakon obnove |

Nastavnik novu rubriku izričito bira pri objavi zadatka. Učenik prije rada vidi potpune uvjete iz izvršnog ugovora. Konzola, učenički JSON izvještaj i stara binarna datoteka ne mogu zamijeniti prijenos. ACK potvrđuje radijski primitak; tek dovršeno SPI čitanje svih osam bajtova potvrđuje obradu u prijamnom programu.

Predaj oba izvora i oba sklopa. A šalje pakete 1–10, svaki od osam bajtova: prvi je broj, ostali nule. Koristi statički payload, CRC16, auto-ACK i najmanje dva ponavljanja. B stvarno čita svih osam bajtova i za svaki paket jednom ispisuje RX n. A nakon dovršenog pokušaja ispisuje TX n ACK ili TX n MAX_RT. Zadrži početnu stanku 20 ms i razmak slanja oko 100 ms; svih deset paketa dovrši unutar 1600 ms. Svaki scenarij počinje novim izvršavanjem spremljenog para: normalna veza; gubitak prvog jednog ili dvaju ACK-ova; gubitak jednog ili dvaju podatkovnih pokušaja; blokirana veza; obnovljena veza. Broj gubitaka bira poslužiteljsko sjeme. ACK nije dokaz da je program B pročitao podatak. Pri izgubljenom ACK-u ne smije biti dvostrukog RX n. Pri blokadi svih deset pokušaja mora završiti s MAX_RT, bez RX podataka; nakon ponovnog pokretanja na obnovljenoj vezi ponovno prolazi svih deset. Dopušteni su drugi algoritmi, nazivi, rasporedi, valjani GPIO i mješoviti podržani ciljevi. Treba po jedan napajani NRF24L01+ Lab carrier na svakom čvoru. S3 koristi 3,3 V, Uno/Nano izričiti 5 V carrier s prilagodbom logike. Konzolni tekst bez stvarnog prijenosa i dovršenog RX čitanja ne daje bodove.

## Izvršavanje

Svaki od pet scenarija počinje novim izvođenjem iste spremljene snimke. Svaki traje 1600 ms virtualnog vremena; gubici se biraju iz 1 ili 2 prema poslužiteljskom sjemenu. Fizički profil ostaje ograničeni statički NRF24L01+ Lab carrier, bez simulacije dometa ili potvrde stvarne opreme. Pozitivni Python sleep_us u paru zaokružuje se na milisekundu; pošteno preotimanje Python petlje bez ustupanja nije deklarirano.

Telemetrija RX-a bilježi točne bajtove, izvor i identitet paketa tek pri završetku stvarnog CS prijenosa svih bajtova. Nepotpuno čitanje može isprazniti modelni FIFO prema postojećem ponašanju, ali ne dobiva dokaz potpune obrade. Povijest čuva do 64 RX zapisa i 64 značajna SPI prijenosa. C++ izvori oba čvora prevode se zasebno u izolaciji; bez prevoditelja prihvaća se samo točan izvor iz pouzdanog radio kataloga. Učenički HEX/WASM se zamjenjuje provjerenim artefaktom samo u privatnoj izvršnoj kopiji.

Privatno izvršavanje dva MicroPython interpretera zatvara JS proxy pristup globalnom objektu. Oba čvora dijele virtualni sat. Petlja bez ustupanja, prekoračenje memorije/vremena i kvar servisa ostavljaju bodove praznima.

Dva uzastopna C++ prevođenja imaju po 90 s, izvođenje para 65 s zidnog i 58 s CPU vremena. Zato samo poslovi `24M.1` imaju rezervaciju od 300 s; ranije verzije zadržavaju 180 s. Ostaju granice 2048 MiB adresnog prostora i 1 MiB izlaza. Nema nove SQL migracije.

## Provjere i nadogradnja

Provjeravaju se tri ponavljanja svakog glavnog cilja, svi mješoviti parovi, prekidi vodova na oba čvora i popravak s drugim sjemenom, drugačiji raspored i algoritam, neovisno pogrešni kriteriji s 3/10 i 8/10, lažni ispisi, nepotpuni RX, JS pristup, stari peer artefakt, promjena snimke drugog čvora i neustupajuća Python petlja. Referenca, alternativa i oba pogrešna rješenja prevode se za A i B na sva tri C++ cilja: ukupno 24 zasebna prijevoda.

PHP/MySQL prihvat provjerava četiri dodjele, rezervaciju od 300 s, ugovore, pohranu autentičnih bodova, odbijanje tuđeg rezultata, zaključavanje i očuvanje starije zaključane predaje. Regresija uključuje ranije obitelji, račune, spremanje, izvještaje, povrat kopije i 30 simuliranih učenika. Izvedeni dokaz s točnim brojevima i otiscima nastaje u stage24m-evidence/.

Pri nadogradnji sačuvaj bazu, privatnu konfiguraciju, ključ i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. GitHub Pages služi simulator i prikaz podrške; prijava i službeno bodovanje koriste školsku PHP/MySQL instalaciju.

Sljedeća etapa 24N obuhvaća digitalne i I2C pretvornike razina. Preostaju četiri varijante i 16 kombinacija. Stvarni školski pilot, ciljni mobilni preglednici, Windows veza s Linux provjeravačem i skupno cgroup ograničenje memorije ostaju zasebni uvjeti.

## Rezultati prihvata

[Završni prihvat 24M](https://github.com/zljix/labosv2/actions/runs/44037558293) povezuje 60 ciljanih provjera, 24 neovisna C++ prijevoda i četiri zaključane dodjele kroz pravi PHP/MySQL s jednim otiskom isporučenog provjeravača. Potvrđeni su svih 16 mješovitih parova, neovisno pogrešni kriteriji, prekidi i popravci, potpuni RX prijenosi te ograničenje neustupajućeg programa. Ranije obitelji, razredi, računi, pohrana, izvještaji, povrat kopije i pokus s 30 simuliranih učenika prošli su regresiju. [Sažetak dokaza](stage24m-evidence/acceptance-summary.json) i [izvornost instalacijskog paketa](stage24m-evidence/installer-integrity.json).

Zasebno je iz stvarno zapakiranog Workera potvrđeno šest mješovitih i jednakih parova s jednim izgubljenim ACK-om, uz deset jedinstvenih prijema. Prošlo je osam provjera korijenskog offline paketa i osam provjera Pages podputanje; [lokalni zapis](stage24m-evidence/local-package-verification.json).
