# Labos 0.15.7-beta.1 · 25H — preglednije datoteke i kartice

Polazište: `9023993f0fa3bad501cbd5521a2a3079c4f52a61`, 0.15.6-beta.1. Izmjene pripadaju repozitoriju `zljix/labos`.

## Dorada

- Pretraga svih datoteka po nazivu ili dijelu putanje, neovisno o velikim slovima. Obuhvaća i sklopljene pomoćne datoteke. Enter otvara jedini rezultat, Esc čisti pretragu; prazan rezultat ima jasan povratak na sve datoteke.
- Program i upute ostaju neposredno dostupni, a pomoćni zapisi imaju objašnjenu namjenu. Aktivni pomoćni zapis otvara svoju grupu. Glavna datoteka jasno je označena; prepoznaju se i velika slova nastavaka.
- Kartice se mogu zatvarati bez brisanja datoteka. Zatvaranje aktivne kartice bira susjednu i vraća fokus. Zatvaranje druge kartice čuva trenutačni odabir; posljednja kartica ostaje otvorena. Datoteka se ponovno otvara iz popisa sa sačuvanim sadržajem.
- Strelice i Home/End zadržavaju navigaciju po karticama. Delete na nazivu kartice zatvara samo karticu; u editoru zadržava svoje uobičajeno značenje. Aktivna kartica pomiče se u vidljivi dio trake.
- Traka ima odvojenu stalno dostupnu radnju za novu datoteku, čitljivije oznake i veće dodirne kontrole. Popis više nije ograničen zasebnim malim područjem od 225 px; pomiče se cijeli bočni panel.
- Komponente i stilovi datoteka izdvojeni su iz glavnog prikaza. Format projekata, sadržaj vježbi, kriteriji bodovanja i školske ovlasti ostaju isti.
- Upute i README usklađeni su s izdanjem. Nova UI regresija uključena je u Pages postupak prije objave.

## Provjere

Prošle su TypeScript provjera i konačne produkcijske izgradnje za korijen i `/labos/`.

| Skup provjera | Prošlo |
| --- | ---: |
| Radni prostor, datoteke, kartice i sažeti školski statusi | 3 |
| Nastavne i UI provjere | 6 |
| Projekti, spojevi, školska sinkronizacija i vodiči | 57 |
| Offline paket i zaštite prostora | 19 |
| Pages paket i provjere pilotnih evidencija | 18 |
| Offline sučelje | 1 |
| **Ukupno** | **104** |

Nova UI provjera pokriva pretragu pomoćnih zapisa, Enter/Esc, zatvaranje aktivne i neaktivne kartice, povrat fokusa, očuvanje teksta, ponovno otvaranje, preimenovanje i promjenu projekta. U početnom testnom okruženju React DOM bio je učitan prije postavljanja DOM-a; testna priprema ispravljena je kako bi se događaji tipkovnice provjeravali u valjanom DOM okruženju. Završne provjere prolaze bez te pogreške.

Offline provjere koriste zasebne testne predmemorije i simulirane odgovore, uz zasebno stvarno izvođenje MicroPython WASM-a. Nisu preglednički dokaz rada bez mreže.

## Granice i nastavak

Preglednik je odbio pristup čišćenju predmemorije zbog sigurnosnog pravila koje zabranjuje `chrome://` adresu. Nije korišten zaobilazni pristup niti je pokrenut prihvat nad neočišćenom predmemorijom. Vizualni prihvat ove dorade u obje teme, na malom zaslonu i pri povećanju te hladno offline otvaranje ostaju otvoreni. Stvarni školski uređaji i učenički pilot također ostaju otvoreni. Izdanje zadržava tehnički beta status.

Prethodna opsežna [školska regresija izdanja 25G](https://github.com/zljix/labos/actions/runs/44410804800) sada je potvrđena kao uspješna. To ne predstavlja prihvat školskog paketa 25H.

Rezultat javne objave i provjera posluženih datoteka bit će dopunjeni nakon završetka Pages postupka.

## Pripremljeno izdanje i blokada objave

Provjereni izvor i izgrađeni paket pohranjeni su u GitHub commitu `2929513df24fa85e75d346e949858e40d0e48c29`, stablu `155101afd0ac4ca6d2ecfc45e26c4a7b7d60b489`. Stablo je jednako lokalno provjerenom izdanju. Rad se čuva na grani `codex/25h-project-files`.

Automatska provjera odobrenja odbila je ažuriranje zadane grane `main`: smatra da zahtjev za objavu nije dovoljno izričito odobrenje promjene zadane grane koja pokreće javnu objavu. Odbijanje nije zaobiđeno. Novo izdanje nije objavljeno.

Nakon izričitog odobrenja ažuriranja `zljix/labos:main`: provjeriti trenutačne vrhove grana, objaviti pripremljeno izdanje, pratiti Pages postupak i provjeriti javni manifest te SHA-256 glavnih resursa. Ne ponavljati uspješne lokalne provjere bez promjene izvora ili novog nalaza. Browser prihvat i pilot ostaju zasebno otvoreni.

## Potvrđena javna objava

Nakon izričitog korisnikova odobrenja PR #2 spojen je u main commitom `89a569c0694290948e9445dca7cfcf8e8718a65c`. [Pages postupak](https://github.com/zljix/labos/actions/runs/44591878491) uspješno je dovršio provjere, izgradnju i objavu.

Javni manifest potvrđuje `0.15.7-beta.1`, paket `9fededc02f940879` i putanju `/labos/`. HTTP dohvat bez predmemorije potvrdio je duljinu i SHA-256 glavnog HTML-a, JavaScripta i CSS-a prema manifestu. To nije preglednički offline test; ranije navedena ograničenja ostaju otvorena. Opsežna školska regresija pokrenuta je zasebno i njezin završetak ovdje nije potvrđen. Repozitorij labosv2 nije mijenjan.
