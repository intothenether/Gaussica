# Delad databas på Cloudflare (gratis)

Det här är Gaussicas API som en Cloudflare Worker med en D1-databas (SQLite). När `apiBase` i [`../config.js`](../config.js) pekar på workern använder både GitHub Pages och din egen dator samma konton, framsteg och ritytor.

## Engångsinstallation

Du behöver ett gratis Cloudflare-konto och Node.js. Kör i den här mappen (`cloudflare/`):

```bash
npx wrangler login
npx wrangler d1 create gaussica --jurisdiction eu
```

1. Kopiera `database_id` som skrivs ut till `wrangler.toml`.
2. Kontrollera `ALLOWED_ORIGINS` i `wrangler.toml`. Där ska varje adress sidan nås på stå, utan avslutande `/`: egen domän (till exempel `https://gaussica.se` och `https://www.gaussica.se`) och GitHub Pages-adressen. Lägg även dit `http://localhost:8000` om du kör sidan lokalt.

```bash
npx wrangler d1 execute gaussica --remote --file=schema.sql
npx wrangler secret put TEACHER_CODE
npx wrangler deploy
```

`TEACHER_CODE` är koden lärare anger när de skapar konto. Välj något som elever inte gissar.

`deploy` skriver ut adressen, till exempel `https://gaussica-api.<ditt-konto>.workers.dev`. Lägg den i [`../config.js`](../config.js):

```js
window.GAUSSICA_CONFIG = { apiBase: "https://gaussica-api.<ditt-konto>.workers.dev" };
```

Pusha ändringen så publiceras sidan på GitHub Pages. Kör du `npm start` lokalt använder även den sidan databasen i Cloudflare så fort `config.js` är ändrad. Starta om `npm start` efter ändringen så att servern släpper igenom anropen.

## Hur det fungerar

- Inloggning sker med en token som sparas i webbläsaren och skickas i `Authorization`-huvudet. Cookies fungerar inte mellan olika adresser.
- Lösenord hashas med PBKDF2 (100 000 varv). Inloggningsförsök begränsas i databasen.
- Workern svarar bara på anrop från adresserna i `ALLOWED_ORIGINS`.
- Den lokala Node-servern (`server.js`, SQLite-filen i `data/`) används inte när `apiBase` är satt. Befintliga konton där följer inte med, eftersom lösenordshasharna har ett annat format.

## Prova lokalt utan att deploya

```bash
npx wrangler d1 execute gaussica --local --file=schema.sql
npx wrangler dev --local --port 8787 --var TEACHER_CODE:LARARE1
```

Sätt `apiBase: "http://localhost:8787"` och lägg sidans adress i `ALLOWED_ORIGINS` (`--var ALLOWED_ORIGINS:http://localhost:8000`).

## Gränser och integritet

- Cloudflares gratisplan har dagliga gränser för läsningar och skrivningar i D1. Går ni över dem ger API:t fel tills nästa dygn börjar (klockan 00 UTC). Datan finns kvar.
- Kontrollera Cloudflares aktuella villkor om du tänker använda sidan kommersiellt.
- Databasen innehåller elevers namn och svar. `--jurisdiction eu` håller datan i EU. Ange i en kort integritetstext vad som sparas och vem som kan se det. Jurisdiktionen kan inte ändras efteråt: en databas som skapats utan den måste flyttas till en ny. Hur, och allt annat en skola brukar fråga efter (avtal, konsekvensbedömning, var data ligger, radering), står i [`../docs/skola/`](../docs/skola/README.md).

## Uppdatera en redan driftsatt databas

När nya tabeller tillkommer (till exempel uppdrag och meddelanden) kör du, i den här mappen:

```bash
npx wrangler d1 execute gaussica --remote --file=schema.sql
npx wrangler deploy
```

`schema.sql` kan köras om utan att något förstörs: tabeller och index skapas bara om de saknas.

### Version med Öva mer-uppdrag och stjärnor

Uppdragen har fått en kolumn `kind` (lektion eller Öva mer) och klasserna en inställning för stjärnor (`class_settings`). Eftersom `CREATE TABLE IF NOT EXISTS` inte lägger till kolumner i en tabell som redan finns, körs en liten ändring en gång, och bara om databasen skapades före den här versionen:

```bash
npx wrangler d1 execute gaussica --remote --file=schema.sql
npx wrangler d1 execute gaussica --remote --file=migrations/002-assignment-kind.sql
npx wrangler deploy
```

Ny databas: det räcker med `schema.sql`. Kör inte `002-assignment-kind.sql` en andra gång, då ger den felet "duplicate column name".

### Version med feedback till din e-post

Knappen "Skicka feedback" skickar meddelanden till dig med e-posttjänsten Resend. Skapa ett gratiskonto på resend.com med den e-postadress du vill ha feedbacken på, skapa en API-nyckel (API Keys) och kör sedan:

```bash
npx wrangler d1 execute gaussica --remote --file=migrations/004-site-feedback.sql
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FEEDBACK_TO
npx wrangler deploy
```

`RESEND_API_KEY` är nyckeln du skapade och `FEEDBACK_TO` är din e-postadress. Utan egen domän skickas mejlet från onboarding@resend.dev, och då måste `FEEDBACK_TO` vara samma adress som du registrerade Resend med. Meddelandena sparas också i databasen. Vill du läsa dem där: `npx wrangler d1 execute gaussica --remote --command "SELECT created_at, kind, text, sender FROM site_feedback ORDER BY id DESC LIMIT 20"`.

### Vilka migreringar saknas? (`npm run db:status`)

Migreringarna i `migrations/` har körts för hand, så databasen själv vet inte vilka den har fått. `npm run db:status` (från projektets rot, och efter `npx wrangler login`) tittar i databasen efter det varje migrering lägger till (en kolumn eller en tabell) och skriver vilka som saknas. `npm run db:migrate -- --yes` kör de som saknas, i ordning, och kontrollerar efteråt. Tillägg `--local` gäller den lokala testdatabasen för `wrangler dev`, och `--db namn` en databas med ett annat namn än i `wrangler.toml`. Kör det alltid före `npx wrangler deploy`: migreringarna lägger bara till saker, så den gamla versionen av API:t fortsätter att fungera. Svaret på `/health` har ett fält `schema` som säger `ok` eller vilken migrering databasen behöver, så en övervakning kan larma. En ny migrering måste läggas in i `cloudflare/migrate-lib.js` (ett test påminner om det). Detta är inte provat mot en riktig Cloudflare-databas, bara mot SQLite-filer gjorda på det gamla sättet (`tests/migrate.js`), så titta på utskriften första gången.

### Version med flera vuxna och flera klasser (kör FÖRE `deploy`)

En klass kan ha flera vuxna (de två vårdnadshavarna i en familj, två lärare) och en elev kan vara med i flera klasser (en skolklass och en familj). Det kräver nya tabeller, `class_members` och `class_guides`, och kolumnerna `guide_code` (klasser) och `class_id` (chat och feedback). **Till skillnad från de tidigare migreringarna går inget att göra utan dem:** utan tabellerna svarar API:t överallt att databasen behöver uppdateras. Den gamla versionen av API:t fortsätter att fungera på den uppdaterade databasen, så kör migreringen först och driftsätt sedan:

```bash
npx wrangler d1 execute gaussica --remote --file=migrations/007-multi.sql
npx wrangler deploy
```

Migreringen gör varje elev till medlem i sin klass och varje lärare eller vårdnadshavare till vuxen i sin klass, ger varje klass en kod för vuxna och sätter klass på alla gamla meddelanden och kommentarer. Ny databas: det räcker med `schema.sql`. Kör inte `007-multi.sql` en andra gång, då ger den felet "duplicate column name".

### Version med vårdnadshavare

Ett konto som vårdnadshavare är ett lärarkonto med en markering, kolumnen `caregiver` i tabellen `users`. Kör migreringen en gång före `deploy`:

```bash
npx wrangler d1 execute gaussica --remote --file=migrations/006-caregiver.sql
npx wrangler deploy
```

Ny databas: det räcker med `schema.sql`. Kör inte `006-caregiver.sql` en andra gång, då ger den felet "duplicate column name". Hinner du inte köra migreringen före `deploy` fungerar allt annat som vanligt, men den som försöker skapa konto som vårdnadshavare får veta att databasen behöver uppdateras. Konton som vårdnadshavare går att stänga av med variabeln `CAREGIVER_SIGNUP` satt till `off` (`npx wrangler secret put CAREGIVER_SIGNUP` eller `[vars]` i `wrangler.toml`).

### Version med prov

Prov (genererade prov som läraren skapar i lärarvyn) sparar sina inställningar i en ny kolumn, `config`, i tabellen `assignments`. Kör migreringen en gång före `deploy`:

```bash
npx wrangler d1 execute gaussica --remote --file=migrations/005-prov.sql
npx wrangler deploy
```

Ny databas: det räcker med `schema.sql`. Kör inte `005-prov.sql` en andra gång, då ger den felet "duplicate column name". Hinner du inte köra migreringen före `deploy` fungerar uppdrag som vanligt, men att skapa ett prov svarar att databasen behöver uppdateras. Elevernas svar på ett prov sparas i den vanliga tabellen `progress`, så där behövs ingen ändring.

### Version med chatt mellan elev och lärare

Chatten använder en ny tabell, `chat`. Eftersom den bara läggs till (ingen befintlig tabell ändras) räcker det att köra schemat eller migreringen, och den kan köras flera gånger:

```bash
npx wrangler d1 execute gaussica --remote --file=migrations/003-chat.sql
npx wrangler deploy
```

Hinner du inte köra migreringen före `deploy` fungerar resten av sidan som vanligt. Chatten svarar då att den inte är påslagen.

## E-post, prenumeration och betalning

Migreringen `migrations/008-account-billing.sql` (e-post för vuxna, villkorsgodkännande, åtkomst och Paddle) körs en gång på en befintlig databas, innan den nya workern publiceras: `npx wrangler d1 execute gaussica --remote --file=migrations/008-account-billing.sql`. Alla konton som finns får då gratis åtkomst för alltid. Allt annat (Resend, Paddle, krav på e-post, att ta betalt) är avstängt tills du sätter variablerna och hemligheterna i [../docs/prenumeration.md](../docs/prenumeration.md).
