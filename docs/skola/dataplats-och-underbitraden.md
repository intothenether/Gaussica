# Var uppgifterna lagras och vilka underbiträden som finns

Sammanställning för IT-ansvariga och dataskyddsombud. Texten är skriven efter hur tjänsten är byggd. Den som driver tjänsten fyller i det som står inom [hakparentes] och kontrollerar uppgifterna mot leverantörernas aktuella villkor, som ändras över tid.

## 1. Kort svar

| Fråga | Svar |
| --- | --- |
| Var ligger elevernas uppgifter? | I en databas hos Cloudflare (D1) som skapats med EU-jurisdiktion. Det betyder att databasen bara körs och lagrar data i EU. [Bekräfta i Cloudflares panel att databasen har jurisdiktionen EU, se punkt 3.] |
| Lämnar elevuppgifter EU? | Inte för lagringen. Se punkt 2 om hur anropen hanteras och punkt 5 om underbiträdena. |
| Går det att köra helt på skolans egen server? | Ja. Tjänsten kan köras som en enda Node-process med en SQLite-fil på skolans eget system. Då lämnar inga uppgifter skolans nät. |
| Finns ett demoläge? | Ja. Utan server sparas allt bara i den egna webbläsaren och skickas aldrig någonstans. Det används för att prova, inte i skolan. |

## 2. Hur tjänsten är uppbyggd

Det finns tre delar:

1. **Sidorna** (HTML, JavaScript, lektioner). Statiska filer som hämtas från GitHub Pages på gaussica.se. Inga elevuppgifter finns här.
2. **API:et** (Cloudflare Workers). Tar emot inloggning, svar och framsteg och kontrollerar vem som får se vad.
3. **Databasen** (Cloudflare D1). Här ligger alla elevuppgifter.

Databasens jurisdiktion styr var databasen körs och lagrar data. API-koden (Workers) körs på det Cloudflare-datacenter som ligger närmast användaren. För elever i Sverige är det normalt ett datacenter i Europa, men Cloudflare garanterar det inte, och anrop kan i undantagsfall hanteras utanför EU innan de når databasen. Om skolan kräver att även anropen stannar i EU kan Cloudflare erbjuda regional behandling (Regional Services), som kan kräva ett särskilt avtal. [Ange om det används.] Det som passerar API:et är samma uppgifter som lagras, krypterade under överföringen.

Cloudflare kan som alla nätverksleverantörer logga tekniska uppgifter om anrop (till exempel IP-adress) enligt sina villkor.

## 3. Kontrollera och sätta EU-jurisdiktion

I Cloudflares panel: Storage och databaser, D1, databasen gaussica, Inställningar. Där syns jurisdiktionen. Om den är EU är lagringen klar.

Jurisdiktionen kan bara sättas när databasen skapas och kan inte ändras efteråt. Följer du `cloudflare/README.md` skapas databasen med `npx wrangler d1 create gaussica --jurisdiction eu`. Om en databas skapades utan det flyttar man data till en ny så här:

```bash
npx wrangler d1 export gaussica --remote --output=gaussica-backup.sql
npx wrangler d1 create gaussica-eu --jurisdiction eu
npx wrangler d1 execute gaussica-eu --remote --file=gaussica-backup.sql
```

Byt sedan `database_id` i `cloudflare/wrangler.toml` till den nya databasens id, kör `npx wrangler deploy` och radera den gamla databasen och säkerhetskopian. Filen innehåller alla uppgifter och ska hanteras och raderas därefter. Flytta när ingen använder tjänsten, annars försvinner det som sparats under tiden.

## 4. Säkerhetskopior

D1 har återställning till valfri minut de senaste 30 dagarna (Time Travel). Det betyder att uppgifter som raderas finns kvar i databasens historik hos Cloudflare i upp till 30 dagar och sedan förfaller. Operatören återställer inte raderade uppgifter. Några egna kopior tas inte, förutom vid flytt enligt punkt 3.

## 5. Underbiträden och tredje land

| Leverantör | Vad | Vilka uppgifter | Var | Kommentar |
| --- | --- | --- | --- | --- |
| **Cloudflare, Inc.** | Databas (D1) och API (Workers) | Alla elev- och lärareuppgifter | Databas: EU-jurisdiktion. API: datacenter nära användaren | Amerikanskt bolag med europeiska enheter. Standardavtalsklausuler ingår i Cloudflares dataskyddsavtal. Bolaget uppger att det är anslutet till EU-US Data Privacy Framework [kontrollera aktuell status] |
| **GitHub, Inc. (Microsoft)** | Hämtning av sidorna (GitHub Pages) | Inga elevuppgifter. IP-adress vid hämtning | USA och global | Kan avvecklas genom att sidorna läggs på skolans egen server eller hos en europeisk leverantör |
| **Resend, Inc.** | Skickar e-post med feedback till operatören | Feedbackmeddelandet, och elevens namn och klass om eleven är inloggad, och en valfri svarsadress | USA | Används bara om operatören ställt in e-post [ja/nej]. Utan det sparas feedback bara i databasen |

**Typsnitt.** Typsnitten Nunito och Lexend ligger som filer på tjänstens egen server (mappen `fonts/`, licens SIL Open Font License) och hämtas därifrån. Google Fonts används inte, så ingen IP-adress går till Google. Uppläsningsfunktionen använder enhetens egen röst, och en del enheter hämtar röster från sin tillverkare (se integritetstexten).

**Inga andra tredje parter.** Tjänsten har ingen analys, ingen annonsering, inga sociala insticksmoduler och inga andra externa skript.

## 6. Om skolan vill ha allt på egen server

README.md beskriver hur man kör tjänsten med `npm start`. Då:

- ligger databasen som en fil (`data/gaussica.db`) på skolans server;
- behövs ingen Cloudflare, GitHub eller Resend ;
- ansvarar skolan själv för säkerhetskopior, uppdateringar och HTTPS (till exempel bakom en omvänd proxy).

Då är skolan själv både personuppgiftsansvarig och driftansvarig och behöver inget biträdesavtal för driften.
