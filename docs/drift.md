# Drift: säkerhetskopia och att återställa

Gaussica har konton och framsteg som är värda att skydda när andra betalar för dem. Här står hur du tar en kopia på din egen dator och hur du läser tillbaka den.

## Ta en kopia

För databasen hos Cloudflare (D1), från projektmappen:

```
npx wrangler login          # en gång, om du inte är inloggad
npm run backup
```

Det skapar `backups/gaussica-ÅÅÅÅ-MM-DD.sql` (via `wrangler d1 export`) och behåller de åtta nyaste, äldre tas bort (`npm run backup -- --keep 12` ändrar antalet). Skriptet vägrar spara något som inte ser ut som en riktig kopia.

För Node-servern (egen SQLite-fil, till exempel `data/gaussica.db`):

```
npm run backup -- --node-db data/gaussica.db
```

SQLite gör själv kopian, så den är hel även om servern körs. Kopian hamnar i `backups/` som en `.db`-fil. Skriptet läser bara filen och ändrar den inte.

**En kopia en gång i veckan räcker för att börja.** Lägg en återkommande påminnelse i kalendern, eller schemalägg `npm run backup` i Aktivitetsschemaläggaren (Windows) eller cron.

## Förvara den säkert

Kopian innehåller personuppgifter: namn, användarnamn, svar och meddelanden (lösenord finns bara som hash, och e-postadresser står med). Förvara den där bara du kommer åt den, till exempel på en krypterad disk, och radera gamla kopior. Den ligger aldrig i repot (`backups/` är i `.gitignore`).

## Återställa

**Cloudflare, det säkra sättet (en ny databas bredvid):**

```
npx wrangler d1 create gaussica-aterstalld
npx wrangler d1 execute gaussica-aterstalld --remote --file=backups/gaussica-ÅÅÅÅ-MM-DD.sql
```

Kontrollera att kontona finns (`npx wrangler d1 execute gaussica-aterstalld --remote --command "SELECT COUNT(*) FROM users"`). Byt sedan `database_name` och `database_id` i `cloudflare/wrangler.toml` till den nya och driftsätt API:t. Den gamla databasen ligger kvar tills du tar bort den.

**Cloudflares egen återställning** (sju dagar tillbaka, utan din kopia):

```
npx wrangler d1 time-travel info gaussica
npx wrangler d1 time-travel restore gaussica --timestamp=<tid från info>
```

Använd den för ett fel du upptäcker snabbt. Din kopia är till för det som Cloudflare inte kan ge tillbaka.

**Node-servern:** stoppa servern, byt ut `data/gaussica.db` mot kopian (spara den gamla filen först), starta servern.

## Prova att en kopia fungerar

En kopia som aldrig har lästs tillbaka är bara ett hopp. Gör återställningen ovan (den nya databasen) en gång nu, kontrollera antalet konton, och ta sedan bort `gaussica-aterstalld` (`npx wrangler d1 delete gaussica-aterstalld`).
