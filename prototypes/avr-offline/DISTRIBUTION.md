# Distribucija offline AVR paketa

Provjereno 20. studenoga 2026. Ovo je evidencija podrijetla i primijenjenog
načina distribucije, a ne tvrdnja o isključivom vlasništvu ili promjeni licenci.

## Primijenjeni model

GCC i binutils objavljeni su pod GPL-3.0-or-later. Njihovi WebAssembly alati
ostaju neizmijenjeni; komprimirani su za prijenos, uz provjeru izvornog SHA-256.
GPLv3 §6(d) izričito dopušta da pripadajući izvorni kod bude na drugom
poslužitelju, uključujući poslužitelj treće strane, uz jednak pristup,
jasne upute uz binarni kod i odgovornost distributera za dostupnost.
Primjenjujemo taj model za zaključane upstream alate i njihov recept.

Na stranici `compiler-sources.html`, dostupnoj uz gumb za pripremu prevoditelja,
objavljene su točne poveznice na arhive izvora i recept za izdanje
`avr-gcc-15.2.0-pcbkit-4`, commit
`58a15c764b5f0b3b8ac9134ec040a552c35b59ce`.
Upstream autor u README-u, opisu izdanja i članku izričito predstavlja taj
repozitorij kao pripadajuće izvore i recept izgradnje svojih GPL alata.

Nismo utvrdili zasebnu licencu za kopiranje upstream `build.sh` i `Dockerfile`.
Te datoteke zato ne prepakiravamo niti im pripisujemo MIT/GPL licencu.
Korisnici im pristupaju kod izvornog izdavača preko točnog commita.
Ranija tvrdnja da sam nedostatak korijenske LICENSE datoteke nužno blokira
svaku distribuciju licenciranih binarnih alata bila je preširoka: GPLv3
predviđa opisani način mrežnog pristupa izvorima. To ne predstavlja dozvolu
za proizvoljno kopiranje drugih datoteka iz tog repozitorija.

## Vlastite izmjene i obavijesti

Labos gradi vlastite zasebne Uno/Nano jezgre i zaključane biblioteke te novi
ograničeni SDK. Na istom poslužitelju uz binarni paket dostupni su:

- puni Arduino AVR 1.8.8 izvor;
- puni zaključani izvori Labos biblioteka s izvornim obavijestima;
- `labos-corresponding-source.tar.gz`: izvor Labosa, recepti izgradnje SDK-a,
  konfiguracija, manifesti i ostale praćene datoteke bez starih buildova;
- izvorni upstream `NOTICE.json` i `licenses.tar.gz`;
- dodatne izvorne obavijesti Emscriptena 4.0.22, musl, compiler-rt, libc++ i
  libc++abi koje pokrivaju pridruženi JavaScript/WASM runtime;
- `DISTRIBUTION.json`: točne verzije, poveznice, sažeci i inventar.

Licenca Labosa ne zamjenjuje licence komponenti. Biblioteke zadržavaju
GPL/LGPL/BSD/MIT i ostale izvorne uvjete. Izvori Emscripten runtimea i njegovih
obavijesti dolaze iz taga 4.0.22, odnosno istog alata iz upstream recepta.
Nije preuzet izvorni kod PCBKitove aplikacije.

Korisnik ne mora preuzeti izvore za uporabu prevoditelja. Pristup izvorima
je besplatan i ne zahtijeva račun. Za otvaranje vanjskih izvora potrebna
je mreža; prevođenje nakon pripreme ostaje potpuno lokalno.

## Održavanje dostupnosti

Prije objave CI provjerava preuzimanje svih 19 zaključanih arhiva i dvaju
recepata te njihove SHA-256 vrijednosti. Privatna razvojna kopija recepta
ne ulazi u javni paket. Ako vanjski izvori poslije postanu nedostupni,
distributer mora obnoviti odgovarajući pristup izvorima ili povući binarne
datoteke; poveznice ne prenose tu odgovornost na upstream autora.

Ne tvrdimo da je cijeli GCC/binutils ponovno izgrađen u Labosu; preuzima
se provjereno upstream izdanje. Vlastiti SDK, jezgre i biblioteke izgrađeni
su iz izvora. Tvrdnje o uređajima ograničene su na zabilježene provjere.

## Izvori za ovu odluku

- GNU GPLv3, definicija Corresponding Source i §6(d): https://www.gnu.org/licenses/gpl-3.0.html
- GNU FAQ, SourceAndBinaryOnDifferentSites: https://www.gnu.org/licenses/gpl-faq.html#SourceAndBinaryOnDifferentSites
- Upstream objašnjenje: https://pcbkit.io/blog/an-open-toolchain-repository
- Zaključani upstream README: https://github.com/pcbkit-io/toolchain/blob/58a15c764b5f0b3b8ac9134ec040a552c35b59ce/README.md
- Točno izdanje: https://github.com/pcbkit-io/toolchain/releases/tag/avr-gcc-15.2.0-pcbkit-4
- Emscripten obavijesti: https://github.com/emscripten-core/emscripten/blob/4.0.22/LICENSE
