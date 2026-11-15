# Offline i stabilizacija · 0.3.0-beta.1

Datum: 12. studenoga 2026. Etapa 6 — razvojna isporuka. **Nije proglašena v1.0.** Stvarni učenički pilot, školsko računalo i zasebne provjere ciljnih preglednika ostaju otvoreni uvjeti plana.

## Isporučeno

- Instalacijski manifest i lokalne ikone. Instaliranje ovisi o pregledniku; sam manifest nije dokaz instalacije.
- Cijeli offline paket: početna stranica, lijeno učitani CodeMirror, primjeri, Workeri, MicroPython WASM, Python prilagodba i upravljačke datoteke, vodič, dijagnostika i obrazac pilota. Paket iznosi približno 4 MiB.
- Izgradnja generira popis resursa s veličinom i SHA-256. Install prvo preuzme i provjeri sve odgovore; tek zatim pohranjuje paket i oznaku potpunosti. HTTP pogreška, preusmjeravanje/prijava, zamjenski HTML, neodgovarajući bajtovi i kvota ne postaju uspješan paket.
- Ekran **Status i offline** prikazuje stvarno stanje predmemorije, inačicu paketa, procjenu prostora, zahtjev za trajnu pohranu i zasebnu kratku provjeru MicroPythona. Zapis te provjere može se preuzeti; ne uključuje učenikov projekt/ime niti potvrđuje pilot.
- Nova verzija ostaje u čekanju. Korisnik zaustavlja izvođenje, zatvara druge kartice i odabire ažuriranje. Uspješan `ws.flush()` prethodi zahtjevu za aktivaciju; pogreška/sukob zaustavlja ponovno učitavanje. Worker odbija prisilnu aktivaciju uz više otvorenih prozora istog podrijetla.
- Izvršni resursi koriste `/app/<sadržajna-inačica>/…`. Otvorena stara stranica ne prelazi potajno na novu verziju interpretera. Prethodni paketi ostaju dostupni za njihove izričite URL-ove. Zauzeće predmemorije zato raste po nadogradnji; automatsko uklanjanje starih paketa nije uvedeno.
- Cache služi samo poznate resurse aplikacije te ranije sadržajno označene resurse. Ne presreće prijavu, proizvoljne API rute, POST, URL-ove s upitom ili projektne datoteke. Nema dinamičkog spremanja odgovora. Projekti i povijest ostaju u postojećem IndexedDB-u.
- Ponovljeno preuzimanje može popraviti izbačen/nepotpun paket. Preglednik i dalje može odbiti pohranu ili je kasnije ukloniti.
- Dodan je preskok na radno područje, fokus za odabirne popise i tekstna polja, čitljiviji raspored alatne trake na malim zaslonima te dokumentiran izlazak iz editora tipkama Escape, Tab. Nije formalna WCAG potvrda.
- Pri skrivanju stranice i `pagehide` dodatno se zapisuje oporavak i pokušava dovršiti spremanje. Time se dopunjuje postojeći autosave i zaštita od sukoba kartica; nije jamstvo protiv brisanja podataka preglednika.
- `/guide.html`: rad učenika i nastavnika, offline preuzimanje, ažuriranje, oporavak, tipkovnica, matrica provjera i granice modela.

Format projekta ostaje **schemaVersion 2 / modelVersion 1**, bez promjene baze ili migracije postojećih podataka. MicroPython, C most, firmware/profil i modeli periferije ostaju iz etape 4/5. Inačica funkcionalne provjere vježbi ostaje 0.2.0 jer scenariji nisu mijenjani.

## Stvarno izvedene programske provjere

| Skup | Prolazi |
| --- | ---: |
| Projekt / arhiva / IndexedDB / topologija | 26/26 |
| Osnovni simulator | 12/12 |
| Periferija, uključujući 205 AHT10 pretvorbi | 16/16 |
| Naslijeđena jezgra | 10/10 |
| Projektne datoteke i zaštita internih modula | 3/3 |
| Pet nastavnih vježbi i predaja | 20/20 |
| Offline paket i inačicom označen Worker | 8/8 |
| **Ukupno** | **95/95** |

Brojevi označuju programske skupine, ne broj svih tvrdnji. Izvedeni su TypeScript, produkcijska izgradnja i provjera razlika. Dokazi su u `results-stage6-*` i `stage6-reference-results.json`. Povijesni zapisi prethodnih etapa nisu zamijenjeni rezultatima novog pokretanja.

Offline testovi izvršavaju generirani `sw.js` uz CacheStorage/fetch zamjene i stvarni kriptografski SHA-256. Provjeravaju cijeli paket, krive bajtove, zamjenski HTML/prijavu, kvotu, izbačeni resurs i popravak, čekanje/izričitu aktivaciju, dvije kartice, ranije verzionirane resurse te izuzete zahtjeve. Posljednji test stvarno izvršava MicroPython i framebuf iz produkcijske verzionirane kopije Workera u Node Workeru. Zamjene nisu prijavljene kao preglednički offline test.

## Stvarno opaženo u Chromiumu/Linuxu

1. Projekt spremljen prije ove isporuke otvorio se s postojećim kodom i sklopom.
2. Produkcijska izgradnja preuzela je i potvrdila 65 resursa / oko 4 MiB. Zasebna provjera potvrdila je Worker, MicroPython WASM, GPIO, stanku i framebuf.
3. Cijeli preview poslužitelj zatim je zaustavljen. Ponovno učitavanje stranice vratilo je aplikaciju i lokalni projekt. Editor se učitao iz predmemorije.
4. Uz ugašen poslužitelj otvoren je novi primjer AHT10 → OLED → servo, s trima Python upravljačkim datotekama. Izvršavanje je prepoznalo I2C adrese 0x38/0x3C. Promjena okoliša s 24 °C na 85 °C dala je OLED 85.0 °C i servo 90°.
5. Uz ugašen poslužitelj otvorena je učenička V1, dodana veza breadboard e8 → LED A iz popisa, uređen kôd na 250/750 ms i uneseni jasno označeni probni odgovori. Funkcionalna provjera dala je **4/4**.
6. ZIP za predaju stvarno je preuzet. Pregled arhive potvrdio je projekt, kôd, upute, scenarij, odgovore, rezultat i čitljivi pregled. Kopija istih bajtova s nastavkom `.zip` ponovno je uvezena kroz odabir datoteke: otvorena je zaustavljena zasebna kopija s odgovorima. Nastavnikova nova provjera dala je **4/4**. Prvi pokušaj s internim nazivom preuzimanja bez nastavka nije završio uvoz; ispravljen je testni put datoteke, bez izmjene sadržaja paketa.
7. Poslužitelj je vraćen s novijom izgradnjom. Nova verzija ostala je u čekanju. Otvaranje druge kartice blokiralo je zahtjev za aktivaciju uz jasnu poruku. Nakon zatvaranja druge kartice unesena je nova izmjena imena te odmah odabrano ažuriranje. Nova stranica zadržala je to izmijenjeno ime, kôd, sedam vodiča, odgovore i aktualni rezultat **4/4**; paket i stranica prešli su s `007360ae9b4ed753` na `2dc3bb546a70c96c`.
8. Raspored je vizualno pregledan pri 390 CSS px u iframeu istog Chromiuma: alatna traka, Sastavljanje, Kôd i Vježba. To nije iPhone, dodirni uređaj ni Safari test.

Preglednički tok ranije prekinut u etapi 5 sada je provjeren. Ovo je razvojna provjera autora aplikacije, **nije stvarni učenički pilot**. Ime „Probni učenik” i zapisi QA označavaju isključivo testne podatke. Oni nisu dio ugrađenih vježbi ni objavljenog početnog projekta.

## Granice dokaza i sljedeća točka

Offline je opažen na lokalnoj produkcijskoj izgradnji s ugašenim HTTP poslužiteljem. Nije posebno potvrđeno hladno offline pokretanje na privatnoj produkcijskoj domeni nakon isteka prijave; servis za prijavu, pristupne politike i ponašanje pojedinog preglednika ostaju van paketa. Instaliranje PWA na početni zaslon također nije zasebno izvedeno.

Safari/iOS, iPadOS, Firefox, Edge, Android, fizički ESP32 i referentno školsko računalo nisu zasebno ispitani. Izgled pri 390 px ne pretvara ih u potvrđene platforme. Nije proveden formalni audit pristupačnosti ni mjerenje performansi na školskoj opremi. Test sukoba pohrane prolazi programski; kvar spremanja usred nadogradnje nije posebno izazvan u pregledniku.

**Za v1.0 preostaje:** stvarni učenik na ciljnom školskom računalu mora proći vježbu i predaju; nastavnik treba u drugoj sesiji otvoriti paket i ponoviti provjeru. Treba zapisati vrijeme, potrebnu pomoć, stop/reset, offline ponovno otvaranje, ciljane preglednike i eventualne ispravke. Koristi postojeći obrazac `/pilot.html`. Ne izrađuju se ponovno etape 0–5 niti pet nastavnih vježbi.

## Izvori za offline izvedbu

- [W3C — Service Workers](https://www.w3.org/TR/service-workers/)
- [MDN — Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN — ServiceWorkerRegistration.update](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update)

Izvori su provjereni tijekom rada. Arhitektura paketa, testovi i navedena opažanja pripadaju ovoj aplikaciji.
