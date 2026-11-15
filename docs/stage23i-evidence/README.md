# Dokazi pripreme pilota 23I

load.json nastaje tek nakon uspješnog pokusa npm run test:school-load nad stvarnim PHP-om i zasebnom praznom MySQL bazom. Opisuje razvojni loopback, 30 sintetskih sesija, četiri PHP radnika, dva privatna provjeravača i jednu MicroPython rubriku. Nije dokaz školskog Apache/HTTPS/LAN profila ni rada stvarnih učenika.

https-host.json nastaje zasebnom naredbom LAB_SCHOOL_URL=https://... npm run school:host. Provjerava točnu izgradnju, bajtove, MIME, javni PHP liveness i izolaciju privatnih putanja. Ne potvrđuje prijave ni stanje baze.

Svaki pokus mora navesti izdanje i okruženje. Nepostojeći rezultat znači da provjera nije izvedena; ne preuzima se uspjeh ranije etape. Ciljni Windows, Safari/iOS, Android, stvarni učenički pilot i ukupna cgroup memorija ostaju odvojeni dokazi.
