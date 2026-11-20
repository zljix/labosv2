# Labos 0.15.3-beta.1 · 25D — offline ažuriranje

Polazište: `c5119c9893df23a726bbb02ae27e035a54714246`. Opseg: samo zljix/labos.

## Nalaz

Nastavljena je otvorena provjera iz 25C. Provjereno je svih 205 javnih datoteka paketa `63813ed0e00f4247` (0.15.2-beta.1): dostupnost, konačni URL, veličina i SHA-256 odgovaraju manifestu. Javni `sw.js` sadržava isti manifest. [Zapis provjere](stage25d-evidence/public-audit-25c.json).

U postojećoj kartici s 0.15.1-beta.1 ponovljena instalacija 25C ponovno je završila općom porukom da novi paket nije pripremljen. Ta poruka ne otkriva konkretnu datoteku ni razlog. Provjera javnih datoteka iz drugog mrežnog okruženja nije dokaz da je preglednik dobio iste odgovore. Uzrok tog konkretnog neuspjeha prije dorade nije potvrđen.

## Dorada

- Najviše četiri istodobna preuzimanja, umjesto 205 uzastopnih zahtjeva.
- Jedan ponovni pokušaj samo za neuspjeli zahtjev. Ponovni URL sadrži očekivani SHA-256 radi izbjegavanja zastarjelog odgovora posredne predmemorije. Sažetak i duljina svakog odgovora i dalje moraju odgovarati manifestu; preusmjerenja i pogrešni sadržaji odbijaju se.
- Paket postaje spreman tek nakon provjere i spremanja svih datoteka. Kanonski offline URL-ovi ostaju isti. Prijašnji paketi, IndexedDB i učenički projekti ne brišu se pri neuspjeloj nadogradnji.
- Status prikazuje broj provjerenih datoteka i konkretnu pogrešku preuzimanja ili spremanja. Ponovna provjera starog paketa ne skriva pogrešku novoga.
- Instalacija čeka izričitu aktivaciju; spremanje projekta i provjera drugih otvorenih kartica ostaju obvezni.
- Nova provjera sučelja uključena je u Pages CI.

## Lokalne provjere

Prošlo je 78 ciljanih provjera: 8 za samostalni offline paket (uključujući stvarni MicroPython Worker), 10 za Pages paket, 1 za offline sučelje, 42 za projekte/spojeve/usmjeravanje, 15 za školsku sinkronizaciju te 2 za radni prostor. Školskih 15 isprva nije moglo raditi bez generiranog kataloga; nakon pripreme kataloga svih 15 prolazi.

Nove regresije pokrivaju zastarjele bajtove i uspješan ponovni pokušaj, trajno neispravan paket, očuvanje prethodnog paketa, ograničenje paralelizma, poruke samo karticama ovog laboratorija te napredak/pogrešku/ponovni pokušaj u sučelju.

Prošle su TypeScript provjera, samostalna i Pages izgradnja. Lokalni Pages paket: `fc2cffcb6ec750b8`. Produkcijska izgradnja i dalje upozorava na velike JavaScript blokove; ovo izdanje ne mijenja razdvajanje aplikacijskih modula.

## Javna objava i provjera

Korisnik je izričito odobrio objavu. Commit `474a0c9158cb1e6c620cf375d428c231a122e8b2` prenesen je u main. [Pages izgradnja i objava](https://github.com/zljix/labos/actions/runs/44368386664) završile su uspješno. Javni manifest i service worker potvrđuju verziju `0.15.3-beta.1`, paket `fc2cffcb6ec750b8`, provjereno ponavljanje zahtjeva i izvještavanje o napretku.

Postojeća kartica s 0.15.1-beta.1 ostala je sačuvana. Nova mrežna kartica (`?verify=25d`) otvorila je 0.15.3-beta.1 i isti projekt „Tipkalo upravlja LED-icom”; tekst editora prije i poslije identičan je (366 znakova). Pokretanje programa je započeto, ali konačni ishod izvođenja nije potvrđen prije zatvaranja privremene kartice pri novoj korisničkoj poruci.

Offline instalacija nije uspjela. Nova dijagnostika prikazala je: „Paket nije spremljen u preglednik: Quota exceeded.” Pogreška je iz faze upisa u CacheStorage, u udaljenom testnom pregledniku. Nije riječ o GitHub kvoti niti postoji dokaz da korisnikov uređaj ima isti problem. Prikazana procjena bila je 55,3 MiB zauzeto od približno 10295 MiB; zato nije dokazano da je dosegnuta baš prikazana kvota origin-a. Nedostupan prostor ili ograničenje testnog okruženja ostaju mogući razlozi. Dosadašnji kod zadržava sve prethodne aplikacijske pakete, što povećava potrošnju, ali samo po sebi ne dokazuje uzrok ovog konkretnog odbijanja.

Sljedeći zahvat: pregled prostora i sigurno uklanjanje samo zastarjelih aplikacijskih paketa uz zaštitu aktivne verzije, otvorenih kartica, IndexedDB projekata i drugih aplikacija istog origin-a; zasebna poruka i postupak za pogrešku kvote. Ne koristiti opće brisanje podataka stranice. Potom ponoviti nadogradnju i stvarno izvođenje projekta.

[Školska regresija 25D](https://github.com/zljix/labos/actions/runs/44368386742) još traje pri završnoj provjeri. Javna objava nije potvrda te regresije ni uspješne offline instalacije. Stvarni iOS/Android dodir, projektor i učenički pilot ostaju otvoreni.
