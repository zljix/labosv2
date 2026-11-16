# Dokazi etape 24E

Izvršne provjere spremaju `events-<cilj>.json` s točnim ugovorom, hashom snimke, privatnom testnom pobudom i rezultatom. `mysql-events.json` bilježi stvarni PHP/MySQL tijek objave, bodovanja i zaključavanja. GitHub Actions dodaje `sourceCommit`; izostanak tog polja znači lokalnu razvojnu provjeru.

Zapis s namjerno pogrešnim programom smije imati 0, 3 ili 8 bodova. Uspješnost određuju tvrdnje testova i završni status CI posla, a ne broj bodova svakog pojedinog negativnog primjera. Lokalno nedostupan prevoditelj daje preskočen test, koji nije dokaz prevođenja.
