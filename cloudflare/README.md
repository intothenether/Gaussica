# Delad databas på Cloudflare (gratis)

Det här är Gaussicas API som en Cloudflare Worker med en D1-databas (SQLite). När `apiBase` i [`../config.js`](../config.js) pekar på workern använder både GitHub Pages och din egen dator samma konton, framsteg och ritytor.

## Engångsinstallation

Du behöver ett gratis Cloudflare-konto och Node.js. Kör i den här mappen (`cloudflare/`):

```bash
npx wrangler login
npx wrangler d1 create gaussica --jurisdiction eu
```

1. Kopiera `database_id` som skrivs ut till `wrangler.toml`.
2. Kontrollera `ALLOWED_ORIGINS` i `wrangler.toml`. Där ska din GitHub Pages-adress stå (utan avslutande `/`), och `http://localhost:8000` om du kör sidan lokalt.

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
- Databasen innehåller elevers namn och svar. `--jurisdiction eu` håller datan i EU. Ange i en kort integritetstext vad som sparas och vem som kan se det.

## Uppdatera en redan driftsatt databas

När nya tabeller tillkommer (till exempel uppdrag och meddelanden) kör du, i den här mappen:

```bash
npx wrangler d1 execute gaussica --remote --file=schema.sql
npx wrangler deploy
```

`schema.sql` kan köras om utan att något förstörs: tabeller och index skapas bara om de saknas.
