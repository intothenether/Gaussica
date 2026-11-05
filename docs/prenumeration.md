# Prenumeration för vårdnadshavare: så är det byggt och så startar du

Det här är handboken för att ta betalt av vårdnadshavare utan att tjänsten kostar något att driva. Allt är **avstängt tills du sätter på det**: så länge `BILLING_ENABLED` inte är `1` släpps alla in, och alla konton som fanns när migreringen kördes har gratis åtkomst för alltid.

## Vad som finns

| Del | Var |
| --- | --- |
| E-post för vuxna: bekräfta adressen, glömt lösenord | `server/account.js`, `cloudflare/worker.js`, `auth-view.js`, `subscription.js` |
| Vem som får använda sidan: gratis, prov, betald | `server/billing-core.js` (reglerna), `server/account.js`, `cloudflare/worker.js` |
| Betalning med Paddle: betalsida, kundportal, webhook | samma filer, `/api/billing/...` |
| Gratis åtkomst: av dig (`scripts/admin.js`) och med koder | `/api/admin/...`, `/api/billing/redeem` |
| Villkor, integritetspolicy och ångerrätt | `docs/juridik/`, byggs till `villkor.html`, `integritet.html`, `angerratt.html` |

**Reglerna.** En familj (en vårdnadshavare med barn) har en *entitlement*: `free` (gratis, med orsak och ev. slutdatum), `trial` (provperiod) eller `paid` (Paddle). Barnen använder familjens åtkomst. Lärare (skolor) betalar inte. När åtkomsten är slut kan barnen inte spara svar (servern svarar 402), och sidan visar en skärm för barnet ("be din vårdnadshavare") och en för vårdnadshavaren (välj prenumeration, kod, eller bara läsa). Det går alltid att ladda ner och radera allt. En vecka extra nåd ges om en betalning är sen. Se `tests/billing-core.js`.

**Kostnad.** Cloudflare (Workers, D1, Pages), GitHub Pages och Resend har gratisnivåer som räcker till många familjer. Paddle har ingen månadsavgift: de tar en andel av varje betalning (ungefär 5 % plus en liten fast avgift, kontrollera deras prissida). Du betalar ingen moms själv för försäljningen: Paddle är säljare (merchant of record) och tar hand om momsen mot kunderna. Gränser att hålla koll på: Cloudflares gratisnivå för D1 (läsningar och skrivningar per dygn), Resends 100 mejl per dygn och 3 000 per månad.

## Startordning (varje steg är ofarligt för sig)

1. **Migrera databasen** (en gång, innan du publicerar den nya workern):
   ```
   cd cloudflare
   npx wrangler d1 execute gaussica --remote --file=migrations/008-account-billing.sql
   ```
   Alla konton som finns nu får gratis åtkomst för alltid (`free_reason = founder`). Kontrollera med `node cloudflare/migrate.js`.
2. **Publicera** (`git push`; Pages och workern, se `cloudflare/README.md`). Nu går allt som förut: ingen e-post krävs och ingen betalar.
3. **E-post (Resend på din domän hos Strato).**
   - Skapa ett gratiskonto på resend.com och lägg till din domän (eller en underdomän som `mejl.gaussica.se`; en underdomän är enklast och rör inte din vanliga e-post).
   - Resend visar några DNS-poster (SPF, DKIM och en MX för studsar). Lägg in dem i Stratos DNS-inställningar för domänen (Domäner, DNS/Nameserver, TXT- och CNAME-poster). Vänta tills Resend visar "Verified".
   - Sätt hemligheterna: `npx wrangler secret put RESEND_API_KEY`. Sätt variablerna `MAIL_FROM` (till exempel `Gaussica <no-reply@mejl.gaussica.se>`) och `SITE_URL` (`https://gaussica.se`) i `wrangler.toml`.
   - Prova: skapa ett vårdnadshavarkonto, kolla att bekräftelsemejlet kommer, och att "Glömt lösenord?" fungerar.
4. **Kräv e-post och villkor** när mejlen fungerar: sätt `CAREGIVER_EMAIL_REQUIRED = "1"` i `wrangler.toml`. Befintliga konton uppmanas att lägga till en adress (ett smalt fält högst upp, som de kan stänga).
5. **Villkoren.** Fyll i `docs/juridik/uppgifter.json` (namn, adress, e-post, priser) och läs igenom de tre texterna i `docs/juridik/`. Sätt `"utkast": false`, kör `node scripts/build-legal.js` och checka in sidorna. Testet vägrar publicerade sidor med [hakparentes] kvar. **Låt någon med juridisk kunskap läsa texterna innan du tar betalt**; de är utkast, inte rådgivning.
6. **Paddle (först i sandlådan).**
   - Skapa ett konto på paddle.com. Paddle tar emot privatpersoner och enskilda näringsidkare (identitetskontroll, ingen bolagskontroll). De granskar sajten, och då behöver villkoren (steg 5) vara på plats.
   - Börja i *Sandbox*: skapa en produkt "Gaussica" med två priser (månad och år, återkommande). Kopiera pris-id:na (`pri_...`).
   - Under *Developer tools*: skapa en API-nyckel (`PADDLE_API_KEY`) och en *notification destination* till `https://<din-worker>/api/billing/webhook` med händelserna `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.paused` och `subscription.resumed`. Kopiera hemligheten (`PADDLE_WEBHOOK_SECRET`). Sätt *Default payment link* till `https://gaussica.se`.
   - Hemligheter: `npx wrangler secret put PADDLE_API_KEY` och `PADDLE_WEBHOOK_SECRET`. Variabler: `PADDLE_ENV` (utelämnas för sandlåda, `production` för skarpt) och `PADDLE_PRICES`, till exempel
     `{"manad":{"priceId":"pri_...","label":"Månad","text":"49 kr per månad"},"ar":{"priceId":"pri_...","label":"År","text":"490 kr per år"}}`.
   - Prova med `BILLING_ENABLED = "1"` i en sandlåda: gratis prov, betala med testkort, avsluta, se att åtkomsten följer. Testkort och testsituationer finns i Paddles dokumentation.
7. **Slå på det på riktigt.** Skapa skarpa produkter, priser, nyckel och webhook i Paddles livemiljö, byt hemligheterna och `PADDLE_ENV`, och sätt `BILLING_ENABLED = "1"`. Nya vårdnadshavare får då 14 dagars prov (`TRIAL_DAYS`) och sedan en prenumeration. Befintliga konton är gratis som förut tills du själv ändrar det.

## Gratis åtkomst

```
node scripts/admin.js grant <användarnamn> --reason vän --days 90   # eller utan --days: för alltid
node scripts/admin.js revoke <användarnamn>
node scripts/admin.js show <användarnamn>
node scripts/admin.js code --reason testare --days 30 --uses 10      # en kod att ge bort, löses in under Mitt konto
```

Nyckeln är hemligheten `ADMIN_TOKEN` (minst 16 tecken, sätt den med `wrangler secret put ADMIN_TOKEN`), och sidan anges med `--api https://<din-worker>` och `--token ...` (eller `GAUSSICA_API` och `GAUSSICA_ADMIN_TOKEN`).

## Inställningar (variabler och hemligheter)

| Namn | Vad |
| --- | --- |
| `RESEND_API_KEY` (hemlighet), `MAIL_FROM`, `SITE_URL` | e-post och länkarna i den |
| `CAREGIVER_EMAIL_REQUIRED=1` | en vårdnadshavare måste ange e-post och godkänna villkoren |
| `BILLING_ENABLED=1`, `TRIAL_DAYS` (14) | ta betalt; prov för nya familjer |
| `PADDLE_ENV`, `PADDLE_API_KEY` (hemlighet), `PADDLE_WEBHOOK_SECRET` (hemlighet), `PADDLE_PRICES` | Paddle |
| `ADMIN_TOKEN` (hemlighet) | `scripts/admin.js` |
| `TERMS_VERSION` | versionen som skrivs ner när någon godkänner villkoren (standard `2026-11`, samma som i `uppgifter.json`) |
| `MAIL_DEV=1` | för test: mejlen sparas i minnet i stället för att skickas |

Samma namn gäller för Node-servern (miljövariabler).

## Det här har du ännu inte bestämt eller gjort

- **Skatt.** Hur intäkterna beskattas beror på om verksamheten räknas som näringsverksamhet (löpande och i vinstsyfte). Fråga Skatteverket eller be om ett förhandsbesked. En enskild firma är det vanliga sättet att vara "frilansare" och är inget bolag; F-skatt kan sökas gratis på verksamt.se. Paddle tar hand om momsen på försäljningen, men inkomsten du får utbetald är din att redovisa.
- **Priser.** Sätts i Paddle och i `PADDLE_PRICES` (texten som visas) och i `docs/juridik/uppgifter.json`.
- **Vad som händer med en familj som slutar betala.** Nu: barnen kan inte spara, allt finns kvar, vårdnadshavaren kan ladda ner och radera. Det går att ändra i `server/billing-core.js`.
- **Juridisk granskning** av villkor, integritetspolicy och ångerrätt, och Paddles aktuella köpvillkor (steg 5).
