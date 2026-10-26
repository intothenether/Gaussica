# Gaussica

Ett svenskspråkigt, webbaserat matematikkursprojekt som bygger förståelse från
grunden och framåt. Målet är att täcka matematik från grundskolans årskurs 3
till gymnasiets årskurs 3 utan att göra årskursindelningen till kursens ryggrad.

## Produktidé

Eleven följer en begriplig väg genom matematiska idéer. Varje nytt moment
bygger på förkunskaper som eleven redan har tränat på. Årskurser används som
ungefärliga hållpunkter, inte som låsta kursgränser. Kurser ska gå att lägga
till och förbättra utan att behöva bygga om webbplatsen.

Webbplatsen:

- förklara matematiska idéer och regler med tydliga exempel,
- låta elever experimentera i interaktiva problem,
- ge återkoppling som förklarar varför en lösning inte fungerar och hur
  elevens resonemang kan förbättras,
- visa ett nätverk av lektioner och vilka idéer de bygger på,
- låta eleven välja vilken nod som helst eller följa pilarna i en föreslagen ordning,
- fungera utan AI som kärnfunktion,
- ha riktiga konton: elever och lärare loggar in och allt sparas i en databas på servern.

## Pedagogisk struktur

Innehållet organiseras efter sammanhängande matematiska områden och
förkunskaper, inte som en lista med årskurser:

1. **Tal och räkning** – antal, positionssystem, de fyra räknesätten,
   delbarhet, bråk, negativa tal, potenser och talmönster.
2. **Samband och algebra** – likhetstecknet, obekanta tal, uttryck, ekvationer,
   funktioner, förändring och modeller.
3. **Form och rum** – geometriska former, mätning, skala, koordinater,
   trigonometri och vektorer.
4. **Data och slump** – läsa och beskriva data, medelvärden, sannolikhet,
   kombinatorik och statistisk tolkning.

Områdena får flera nivåer från grundläggande förståelse till gymnasiets mer
avancerade innehåll. Ett moment kan ha flera förkunskaper och kan därför
kopplas till flera delar av lärstigarna. Åk 3–9 och gymnasiet åk 1–3 används
som ungefärliga referenser för lärare, elever och vårdnadshavare, inte som
krav på ordningsföljden.

## Så ska problemlösningen fungera

En uppgift ska hjälpa eleven att förstå, inte bara rätta ett svar. Vid ett
felaktigt svar ska återkopplingen vara kopplad till ett definierat
missuppfattningsmönster eller ett tydligt steg i resonemanget. Den bör:

1. visa vilket steg som behöver ses över,
2. förklara varför det inte fungerar,
3. ge en ledtråd eller ett konkret exempel,
4. låta eleven försöka igen innan lösningen visas.

Interaktiva uppgifter låter eleven ändra värden, undersöka exempel och se hur
matematiska samband förändras. En interaktiv modell ska komplettera
förklaringen och erbjuda ett sätt att resonera, inte bara avslöja rätt svar.

## Webbplatsens första prototyp

Webbplatsen är en responsiv, statisk webbplats med en graf av representativa
lektioner:

- en graf där varje nod är en fristående lektion och pilar visar förkunskaper,
- en graf som går uppifrån och ned; lektioner på samma nivå läggs bredvid
  varandra och radbryts vid behov för att undvika sidscrollning,
- fri start på vilken nod som helst; grafen rekommenderar ordning men låser inte lektioner,
- förklarande moment om positionssystem, bråk och ekvationer,
- grundläggande lektioner om addition, subtraktion, multiplikation, division,
  tid, enhetsomvandling, cirkelns omkrets, area, vinklar och diagram,
- uppgifter med förklarande återkoppling på vanliga missuppfattningar,
- textuppgifter i varje lektion,
- svar, återkoppling och interaktiva inställningar som sparas på elevens konto, så
  eleven kan byta enhet och fortsätta där den slutade,
- en interaktiv bråkmodell där eleven själv ändrar täljare och nämnare,
- separata, redigerbara JSON-filer för varje lektion.

Prototypens innehåll är exempel, inte en komplett kursplan. Att fylla
lärstigen med en heltäckande, kvalitetssäkrad kurs från åk 3 till gymnasiet åk
3 kräver fortsatt innehållsarbete och pedagogisk granskning.

## Skapa och utveckla lektioner

Allt innehåll ligger under `lessons/`. Varje nod har en egen JSON-fil, till
exempel `lessons/brak.json`, med id, område, titel, ungefärlig nivå,
förkunskaps-id:n, förklaringar, regler, exempel, uppgifter, återkoppling och
eventuella interaktiva inställningar. Gränssnittet läser och ritar grafen från
filerna; nytt lektionsinnehåll kräver inga ändringar i webbplatsens kod.

Grafens layoutregler ligger separat i `graph-layout.js`. Där kan du ändra
nodernas minsta/största bredd och höjd, avstånd mellan rader och nivåer,
grafens marginaler samt nivåetiketter. Funktionen `calculate` beräknar
nodernas positioner för den tillgängliga bredden; `edgePath` bestämmer formen
på pilarna. På så sätt kan grafens utseende ändras utan att röra lektionernas
innehåll eller sidans renderingskod.

Så lägger du till en nod:

1. Skapa `lessons/min-nyckel.json` genom att kopiera en befintlig lektion och
   redigera dess innehåll. `id` ska vara unikt och användas som filens
   förkunskapsreferens.
2. Lägg till filnamnet i listan `lessons` i `lessons/index.json`.
3. Lägg till ett eller flera id:n i `prerequisites` för att rita pilar från
   förkunskaperna. Använd `[]` om eleven kan börja direkt med lektionen.
4. Kontrollera att id:n i listan verkligen finns, att inga beroendecykler har
   skapats och att JSON-filerna är giltiga.

Grafens nivåer beräknas automatiskt från förkunskapslänkarna. En lektion med
flera förkunskaper får pilar från varje relevant nod. Om eleven filtrerar på
ämnesområde kan pilar till lektioner utanför filtret döljas, men alla noder är
öppna att välja när filtreringen är avstängd.

Interaktiva modeller definieras med `interactive`, till exempel
`{"type":"fraction-model","numerator":3,"denominator":4}`. När en ny
interaktionstyp behövs läggs dess presentation och beteende till i `app.js`;
vanliga nya lektioner och uppgifter behöver inga kodändringar.

Diagram och tabeller kan läggas till via `visual` eller `visuals` direkt i en lektion,
i lektionens `exercise` eller i enskilda `wordProblems`. Följande format stöds:
- **Stapeldiagram (`type: "stapeldiagram"` eller `"bar"`):** visar jämförelser med skalor, rutnät och exakta värden.
- **Cirkeldiagram (`type: "cirkeldiagram"` eller `"pie"`):** visar andelar av en helhet med procentsatser, cirkelsegment och interaktiv teckenförklaring (stöd för munk-/donut-layout).
- **Linjediagram (`type: "linjediagram"` eller `"line"`):** visar förändring över tid eller mönster med sammanhängande linjer, tonad area och datamarkörer.
- **Tabeller (`type: "tabell"` eller `"table"`):** visar frekvenstabeller och värdetabeller med kolumnrubriker, summeringsrader och automatisk taljustering.
- **Flikar (`type: "tabs"`):** låter eleven växla mellan olika representationer (t.ex. stapeldiagram, cirkeldiagram och tabell) för samma dataset.

Varje lektion kan också innehålla en `wordProblems`-lista med uppgifter i
vardagliga sammanhang. Svar, återkoppling, klar-status och interaktiva värden
sparas per lektions-id på elevens konto på servern. Det gör att
lektionen kan återupptas efter att eleven öppnar en annan nod, laddar om
sidan eller loggar in från en annan enhet.

Skriv feedback för begripliga matematiska felsvar uttryckligen. Undvik att
automatiskt anta vad eleven tänkte utifrån enbart fel svar; om en orsak inte
kan avgöras ska webbplatsen säga vad som blev fel och ställa en hjälpande
fråga i stället för att påstå sig veta hur eleven resonerade.

## Figurer i lektioner

Utöver diagram och tabeller kan en lektion (eller en enskild uppgift) ha en
figur som `visual`, ritad av `figures.js`. Typerna är:

| `type` | Visar | Viktiga fält |
| --- | --- | --- |
| `tallinje` | Tallinje med punkter, hopp och markerat intervall | `min`, `max`, `step`, `labelEvery`, `points`, `jumps`, `range` |
| `rektangel` / `kvadrat` | Rektangel med måttangivelser, valfritt rutnät | `w`, `h`, `unit`, `grid`, `outline`, `sides` (`"all"` märker alla sidor) |
| `triangel` | Triangel med sidor, höjd och inritad rektangel | `base`, `height`, `apex`, `labels`, `showHeight`, `showRect` |
| `figurer` | Galleri av former med namn | `items: [{ shape, label }]` |
| `symmetri` | Former med symmetrilinjer | `items: [{ shape, axes, label }]` |
| `monster` | Växande mönster och rutnät av prickar | `steps: [{ label, rows, cols }]` eller `cells` |
| `talrutnat` | Talen från–till, med markerade tal (t.ex. primtal) | `from`, `to`, `columns`, `highlight` |

Exempel: `{ "type": "tallinje", "min": 0, "max": 20, "step": 1, "points": [{ "value": 13, "label": "?" }] }`.
Figurerna kan redigeras som JSON i lektionseditorn. Svar med enheter, till exempel
`24 cm`, `24cm` eller `25 cm²`, godkänns som talet.

## Utseende

Färgerna bygger på paletten #425B9A (djupblå), #76C0EC (himmelsblå), #FFF6DC
(kräm) och #FF95A5 (korall), något justerade för kontrast. Grundfärgerna är
variabler i `:root` överst i `styles.css` (`--brand`, `--cream`, `--accent`
m.fl.); "klar" är grönt och "behöver rättas" är korall. Temalagret längst ned i
filen styr former, knappar, grafens färger och läsbarhet. Typsnittet är Nunito.
Varje ämnesområde har en egen accentfärg (`--area-tal`, `--area-algebra` …).

## Konton, lagring och körning

Projektet består av en liten Node-server (`server.js`) som både levererar
webbplatsen och sköter konton och lagring. Den har inga beroenden: databasen är
SQLite via Nodes inbyggda `node:sqlite` (Node 22.13 eller nyare), så det finns
inget att installera.

```
npm start            (eller: node server.js)
```

Öppna sedan <http://localhost:8000/>. Första gången servern startar skapas
databasen i `data/gaussica.db` och en **lärarkod** skrivs ut. Visa den igen med
`node server.js --teacher-code`. **Säkerhetskopiera genom att kopiera `data/`.**

**Konton**

- Lärare skapar konto med lärarkoden, skapar klasser och får en *klasskod* per klass.
- Elever skapar konto med klasskoden och hamnar i den klassen. En lärare ser bara
  elever i sina egna klasser.
- Lösenord lagras som scrypt-hash; inloggningen är en HttpOnly-cookie. Inloggnings-
  och registreringsförsök begränsas. Glömt elevlösenord återställer läraren i
  lärarvyn (tillfälligt lösenord). Det finns ingen e-post, så lärarens eget
  lösenord kan inte återställas av någon annan; byt det i kontomenyn.

**Vad som sparas på servern:** elevernas framsteg per lektion, varje inskickat
svar (med försöksnummer, rätt svar, tid och diagnos) och lektioner som lärare
redigerat eller skapat i editorn (de ersätter filerna i `lessons/` för alla).
Lektionsfilerna i `lessons/` är fortfarande grundinnehållet.

**Inställningar (miljövariabler):** `PORT` (8000), `HOST` (standard
`127.0.0.1`; sätt `0.0.0.0` för att nå servern från andra enheter i nätverket),
`DATA_DIR` (`./data`), `TEACHER_CODE` (egen lärarkod),
`COOKIE_SECURE=1` (sätt när sidan serveras över https).

**Publicering:** eftersom inloggning och lagring kräver servern räcker det inte
längre att publicera som statisk webbplats på GitHub Pages. Kör servern på en
dator eller värd med Node och lägg den bakom https (till exempel via en
omvänd proxy) innan den används med riktiga elever, eftersom lösenord annars
skickas okrypterat. Den gamla Pages-arbetsflödet i `.github/` publicerar bara
den statiska delen och visar därför ett meddelande om att servern saknas.

Webbplatsen använder i övrigt vanliga HTML-, CSS-, JavaScript- och JSON-filer
och kräver ingen byggkedja.

## Fortsatt väg framåt

1. Bygg ut innehållsmodellen och lärstigen med fler grundläggande moment och
   tydligare förkunskapskopplingar.
2. Lägg till fler felsvarsmönster och metoder för att uttrycka och testa
   matematiska regler.
3. Skapa fler interaktiva modeller inom tal, algebra, geometri, data och
   sannolikhet.
4. Utöka innehållet stegvis mot samtliga mål från grundskolans åk 3 till
   gymnasiets åk 3 och kvalitetsgranska förklaringar och uppgifter.
5. Förbättra tillgänglighet, mobilstöd och elevens möjlighet att återuppta
   lärandet; behåll en statisk publicering så länge den uppfyller behoven.

## Pyssla (interaktiva noder)

- Varje lektion har `"grade"` (årskurs 3–10). Grafen ordnas efter årskurs; en lektion hamnar aldrig tidigare än sina förkunskaper. Årskursen kan ändras i redigeraren (fältet "Årskurs").
- `"kind": "pyssel"` gör lektionen till en pyssla-nod (rundad ruta med glitter i grafen).
- Nya komponenttyper i `components`:
  - `pyssel`: `params` (reglage med name/min/max/step/value), `vars` (name/expr), `view`/`views` (figurer), `readouts` (text med `{uttryck}`, valfri `when`) och `goals` (id/text/conditions).
  - `ritrutnat`: spegelritning på rutnät (`cols`, `rows`, `preset`, `goal.minCells`, `autoMirror`).
  - `primtalssil`: Eratosthenes såll (`to`, `goal`).
  - `tarning`: tärning/mynt (`goal.minRolls`).
  - `robot`: bygg ett program av kommandona framåt, höger och vänster (`cols`, `rows`, `start` med `dir` 0 upp, 1 höger, 2 ner, 3 vänster, `target`, `walls`, `goal.maxCommands`). Klicka på ett kommando i programmet för att upprepa det (1 till 5 gånger).
- Uttryck: `"=expr"` ger ett tal, `"{expr}"` fylls i i text. Funktioner: abs, sqrt, round, floor, ceil, min, max, pow, mod, divcount, isprime, sgd samt `pi`.
- Villkor i mål: `{expr, equals|min|max, tol}` eller `{all:[...]}`.
- Utmaningar räknas som uppgifter i framsteg och lärarvyn.
- Nya figurtyper: staplar, vinkel, graf, hundrarutor, klocka (och fler lägen för tallinje, monster, talrutnat).

## Publicera på GitHub Pages (demoläge)

GitHub Pages kan bara visa statiska filer, så där finns ingen Node-server. Då startar Gaussica automatiskt i **demoläge**: `local-backend.js` svarar på samma `/api`-anrop men sparar konton, klasser, framsteg och redigerade lektioner i webbläsarens `localStorage`.

- Allt är bundet till en webbläsare på en enhet. Elever och lärare delar alltså bara data om de använder samma dator och webbläsare, och rensas webbläsardata försvinner kontona.
- Lärarkoden i demoläget är `GAUSSICA` (visas på registreringssidan).
- Vill ni ha konton som fungerar mellan enheter: kör `npm start` på en server (se ovan) eller lägg till en riktig backend.
- Workflowen `.github/workflows/deploy-pages.yml` publicerar bara de statiska filerna (inte `server/`, `data/` eller testskript).

## Rityta på varje uppgift

Varje fråga (Din tur, textuppgifter och uppgiftskomponenter) har en rityta (`canvas-pad.js`) ovanför svarsfältet. Eleven kan rita med penna, skriva text, dra linjer och pilar, sudda, ångra och lägga ut och flytta saker: tal- och operatorbrickor, prickar, ental/tiotal/hundratal, geometriska former och tallinjer (dubbelklicka för att ändra tal och tallinjens start/slut). Svaret skrivs fortfarande i svarsfältet och rättas automatiskt.

- Ritytan är rutat papper. Text, tal, figurer och linjer fastnar på rutorna (knappen "Fäst i rutor" stänger av det). Figurer ritas genom att dra i rutan, eller klicka för en vanlig storlek, och får runda punkter att dra i för att ändra storleken. Kvadrat och cirkel förblir kvadratiska, rektangel och triangel kan ändras i bredd och höjd, och linjer kan dras ut i ena änden. Under ritytan finns knappar för att kopiera och ta bort markerad sak och, för text, göra den större eller mindre. Piltangenterna flyttar markerad sak en ruta.
- **Skriv på rutorna.** Verktyget "Skriv" skriver ett tecken per ruta, som på rutat papper: klicka på en ruta och skriv, Enter går till nästa rad och piltangenterna flyttar markören. Det passar för uppställning, eftersom siffrorna hamnar i rätt kolumner. Knappen "Sträck" under pappret drar ett streck under talen du har skrivit (lika brett som raderna ovanför) och flyttar markören till raden under, redo för svaret. På surfplattor visas sifferknappar under pappret (knappen "Abc" tar fram tangentbordet för bokstäver, och "Sifferknappar" under "Mer" slår på dem på dator). I "Skriv" och "Textruta" flyttar du det som redan finns genom att dra i det, och ett vanligt klick skriver eller ändrar, så eleven behöver inte byta verktyg.
- **Oändligt papper.** Dra på tomt papper (verktygen Flytta och Skriv), håll ned mellanslag och dra, eller dra med två fingrar för att flytta pappret. Nyp eller använd knapparna +, − och ⤢ för att zooma. Rullhjulet flyttar pappret när man har klickat på det, och Ctrl + hjul zoomar. Visar vyn inget av det eleven ritat kommer knappen "Visa mitt arbete". Vyn sparas med ritningen, och läraren ser hela ritningen.
- Ritytan sparas som liten JSON (`canvas`) i elevens framsteg (`progress.answers[uppgift].canvas`) och följer med inskickade försök när den ändrats sedan förra försöket.
- I lärarvyn visas den under varje försök ("Rityta vid detta försök") och som "Elevens rityta" för påbörjade uppgifter.
- Gamla kladdtexter (`scratchpad`) visas fortfarande i lärarvyn, men det finns inget kladdfält längre.

## Delad databas (Cloudflare D1)

För att använda samma konton och data på både GitHub Pages och din egen dator, följ [cloudflare/README.md](cloudflare/README.md). Sätt sedan `apiBase` i [config.js](config.js). Ordningen är: `apiBase` satt → Cloudflare-API:t, annars Node-servern på samma adress, annars demoläge i webbläsaren.

## Nästa steg, Öva mer och Repetera

- **Nästa steg.** `coach.js` föreslår vad eleven ska göra härnäst: lektionen eleven senast arbetade i, annars nästa lektion vars förkunskaper är klara (lägst årskurs först). Förslaget visas som ett kort ovanför lärstigen, i knappen i hero-sektionen och som en glödande nod i grafen.
- **Öva mer.** En lektion kan ha `practice`, en lista med mallar som skapar nya frågor med nya tal. Knappen finns på lektionssidan och efter en klar lektion. Frågorna rättas som vanliga frågor, loggas i lärarvyn ("Övning och repetition") men påverkar inte lektionens framsteg.
- **Repetera.** Räknas ut från elevens svarslogg: varje fel svar ger ett poäng, varje svar som är rätt på första försöket tar bort ett. Ligger en lektion på två poäng eller mer (senaste 30 dagarna) föreslås repetition, och mallarna som eleven haft svårast med väljs oftare.

### Övningsmallar: så skriver du dem

**I lektionsredigeraren.** Öppna lektionen, välj "Övningsmallar (Öva mer)" överst i listan till vänster och gör så här:

1. Öppna **Galleri** längst ned och tryck "Lägg till" på den färdiga mall som liknar det du vill ha (heltal, decimaltal, namn och saker, procent, bråk, ekvation, uttryck, figurer och så vidare).
2. Ändra mallen i formuläret: **Slumptal** (namn, lägst, högst och eventuellt steg), **Slumpord**, **Uträknade värden**, **Villkor**, **Frågan**, **Rätt svar** och **Vanliga fel**. Texten i frågan fylls i av namnen: `{a}` blir talet a, `{$namn}` ett slumpord och `{a+b}` en uträkning.
3. Titta på **Exempel och kontroll** under mallen. Där ser du fyra nya frågor med rätt svar, figurer och vanliga fel, och en kontroll som provar 200 frågor. Den varnar för namn som saknas, frågor som blir för lika, villkor som aldrig går att uppfylla och felsvar som egentligen är rätta. Det går inte att spara en lektion med en mall som har fel.
4. Under "Liknar uppgiften" bockar du för vilka av lektionens uppgifter mallen motsvarar. Då får en elev som svarat fel på uppgiften fler frågor av just den typen.

Under varje mall finns "Svarsform, extra tangenter och figur" och "Avancerat: mallens JSON". JSON-rutan kan ändra allt, även det formuläret inte har.

**Så ser en mall ut** (samma sak som formuläret skriver, se `practice.js`):

```json
{ "id": "summa", "for": ["exercise"],
  "pick": { "namn": ["Mira", "Omar"] },
  "vars": { "a": [120, 899], "b": [120, 899] },
  "derive": [ { "name": "s", "expr": "a+b" } ],
  "where": [ { "expr": "a-b", "min": 1 } ],
  "prompt": "Räkna ut {a} + {b}.",
  "answer": ["=s"],
  "correct": "Rätt! {a} + {b} = {s}.",
  "feedback": [ { "answers": ["=a-b"], "message": "Du har tagit bort i stället för att lägga till." } ] }
```

- `vars`: `[lägst, högst]` eller `[lägst, högst, steg]`. `[100, 900, 50]` ger 100, 150, 200 och så vidare.
- `derive`: räknas ut i ordning, så ett värde kan använda de före det.
- `where`: talen slumpas om tills alla villkor stämmer. `{ "expr": "a-b", "min": 1 }` betyder att a ska vara större än b. `min` och `max` kan kombineras.
- `answer`: `"=s"` ger talet s (med decimalkomma av sig självt), vanlig text får innehålla `{uttryck}`. Skriv flera svar om flera skrivsätt ska godtas: `["=r", "{r} kr"]`.
- `feedback`: felsvar och ett meddelande. Felsvaret kan också vara ett uttryck (`"=a+b"`).
- Uttryck: `+ - * / ^` och `abs sqrt round floor ceil min max pow mod sgd divcount isprime primecount nextprime`, samt `sin cos tan asin acos atan` (i grader) och `pi`. `{h|2}` ger två siffror, `{x|+}` visar tecken. Mycket små tal (0,0042) skrivs ut med alla decimaler.
- Frågan får aldrig vara lika varje gång: kontrollen varnar om det bara blir färre än fem olika frågor. Lägg då till `pick` eller bredare talintervall.

**Specialfall.** Allt nedan finns som färdiga mallar i galleriet. Så här fungerar de:

| Vill du ha | Gör så |
|---|---|
| Ett svar som ord eller text | Skriv orden som rätt svar: `"answer": ["mindre"]`. Texten måste stämma tecken för tecken (stor och liten bokstav spelar ingen roll). Lägg slumpord i `pick` så att frågorna skiljer sig åt. |
| Svar med rest | Skriv båda varianterna: `"answer": ["{q} r {r}", "{q} rest {r}"]`. |
| Bråk eller förhållande som måste vara förkortat | `"form": "forenklat"` och svaret som `"{a}/{b}"`. Ett rätt men ofullständigt förkortat svar får tipset att förkorta mer. Lägg inte det oförkortade bråket som felsvar, det är ju också rätt. |
| Blandad form eller bråk | `"form": "blandad"` (1 3/4) eller `"form": "brak"` (7/4). |
| Ett uttryck med x som svar | Svaret jämförs som algebra, så `3x+12` och `12+3x` räknas lika. Skriv potenser som `x^2` och lägg till `"keys": ["^"]` så att eleven får en tangent för tecknet. Be eleven skriva "x² som x^2" i frågan. |
| Uttryck där parentesen ska multipliceras ut | `"form": "utanparentes"`. Annars godtas `(x+3)^2` som svar på "utveckla (x+3)²". |
| Grundpotensform | `"form": "grundpotens"`, och svaret som `["{a/10}·10^{e}", "{a/10}*10^{e}"]`. Tala om i frågan att eleven skriver `*` och `^`. |
| Roten ur | Skriv svaret i alla former som ska godtas: `["{k}√{m}", "{k}*√{m}", "{k}sqrt({m})", "{k}*sqrt({m})"]`, och lägg till `"keys": ["√"]`. |
| En figur | `"visual"` med en figur från tabellen över figurer ovan, där `"=a"` hämtar slumptalet a och `"{a} cm"` blir text med talet. Exempel: `{ "type": "staplar", "data": [{ "label": "Äpple", "value": "=a" }] }`. Prova figuren med menyn "Sätt in en figur" i formuläret. Siffrorna i figuren och i svaret måste komma från samma slumptal. |
| Trigonometri | Använd `sin`, `cos`, `tan` (grader) och runda svaret: `"=round(h*sin(v)*10)/10"`. Lägg ett villkor som undviker avrundningsgränser: `{ "expr": "abs(mod(h*sin(v)*100,10)-5)", "min": 0.5 }`. |
| Positiva heltalssvar i en ekvation | Slumpa svaret x först och bygg ekvationen baklänges med `derive` (`c = a*x+b`), så blir x alltid ett heltal. |
| Begreppsmatchning | Använd knappen "Skapa av begreppskorten", som bygger en matchningsmall och en "vilket begrepp är det här"-mall av lektionens begreppskort. Mallen har `pool` i stället för `vars` och redigeras som JSON. |
| Att svar med en uträkning får godtas | `"allowExpression": true` i mallen, eller inställningen "Uträkning som svar" på lektionen. |
| Ett löst exempel när eleven kört fast | `"steps": ["Lägg ihop entalen och tiotalen.", "{a} + {b} = {s}"]`, ett lösningssteg per rad (i redigeraren: "Lösningssteg"). Efter två fel i rad erbjuder spelaren "Se ett löst exempel" med en liknande fråga med andra tal, och stegen visas med talen ifyllda. Utan `steps` visas mallens rättmeddelande (`correct`) som lösning. |

**Tips.** Håll slumptalen så att svaret blir rimligt (inga negativa tal om eleven inte kan det, inga för stora tal). Skriv gärna ett vanligt fel per vanlig missuppfattning, med ett meddelande som säger vad eleven gjorde och hur det ska vara. Provkör alltid några exempel i redigeraren innan du sparar, och kör `npm test` om du redigerar JSON-filerna direkt.

## Hitta din nivå (nivåtest)

Knappen "Hitta din nivå" överst i "Din väg" (och `#nivatest`) startar ett kort test som hittar var i lärstigen eleven ska börja (`placement.js`, `test-mode.js`). Eleven väljer årskurs och svarar på ungefär 15 till 25 genererade frågor, en i taget och utan tips. Testet går i lärstigens förkunskapsgraf som en binärsökning: en lektion prövas med två eller tre frågor. Kan eleven den räknas allt den bygger på som känt. Kan eleven den inte räknas allt som bygger på den som inte känt än. Nästa lektion som prövas är den som avgör flest av de lektioner som återstår, och högst 12 lektioner prövas. "Vet inte" avgör en lektion direkt. Frågorna kommer från lektionernas övningsmallar, så bara lektioner med mallar prövas direkt. Svaren loggas inte som försök, så nivåtestet påverkar varken "Repetera" eller lärarens statistik.

- **Resultat.** Sparas i elevens framsteg under nyckeln `placement` (`{ at, grade, level, known, unknown, start }`), alltså utan ändring i databasen. Eleven ser hur många lektioner som verkar kända och vilka tre som är bästa start.
- **Vad det ändrar.** Kända lektioner får en grön markering ("Verkar kunna") i kartan och räknas som klara när "Din väg" avgör vad som är redo, och förslagen börjar vid kanten av det eleven kan i stället för längst ned. Inget låses: eleven kan alltid öppna och göra lektionerna ändå. "Gör om testet" ersätter resultatet.
- **Läraren** ser resultatet i elevens detaljvy och som ljusgröna rutor i klassöversikten.
- Logiken (`GaussicaPlacement.create`) går att köra utan sida och testas i `tests/placement.js` med simulerade elever.

## Prov

I lärarvyn, avsnittet "📝 Prov" (`prov.js`): välj lektioner, antal frågor per lektion, tidsgräns, klass (eller en elev), sista dag och om eleven ska se resultatet direkt. Varje elev får sin egen variant (andra tal, samma varje gång för samma elev), och lektioner utan övningsmallar ger sina egna frågor till alla. Provet visas hos eleven som ett uppdrag med knappen "Starta provet".

- **Under provet** (`test-mode.js`): en fråga i taget, ett svar per fråga, ingen väg tillbaka, inga tips och ingen återkoppling om det blev rätt. "Hoppa över" finns. En klocka visar tiden, och när den tar slut lämnas provet in. Eleven kan stänga fliken och fortsätta, men tiden går. Svaren rättas direkt med samma regler som i lektionerna (uträkning i stället för tal och fel skrivsätt räknas som fel).
- **Resultat.** Läraren ser per prov hur många som lämnat in, snittet, hur varje lektion gick och per elev varje fråga med elevens svar, rätt svar och tid. Eleven ser resultatet med rätt svar om läraren valt det. Nedtaget prov försvinner från lärarens lista.
- **Lagring.** Ett prov är ett uppdrag av typen `prov` vars inställningar ligger i den nya kolumnen `assignments.config` (Node: schemaversion 6, Cloudflare: kör `migrations/005-prov.sql` en gång, se cloudflare/README.md). Elevens svar sparas i elevens framsteg under nyckeln `prov-<uppdragets id>`, så de följer med exporten.
- Provfrågorna loggas inte som vanliga försök och påverkar därför inte "Repetera".

## Klassöversikt

Överst i lärarvyn, under siffrorna: "🗺 Klassöversikt" (`heatmap.js`). Eleverna ligger längs sidan och lektionerna på tvären, i årskursordning. Varje ruta är en färg: **klar**, **klar men osäker** (nyligen fel), **pågår**, **kört fast** (fel som inte lösts eller många fel nyligen), **verkar kunna** (nivåtestet) och **inte påbörjad**. Håll musen över en ruta för detaljerna, klicka på rutan eller elevens namn för att öppna eleven, och klicka på en lektion för att se vilka som är var.

- **Vem behöver dig idag?** Elever som kört fast den senaste veckan, ställt en fråga som inte besvarats, har försenade uppdrag eller inte varit aktiva på över två veckor. Med knappar för att öppna eleven eller ge Öva mer direkt.
- **Nästa steg.** Grupper med en knapp för varje: elever som har problem med samma lektion ("Ge dessa Öva mer"), elever som är redo för nästa lektion ("Ge lektionen") och elever som inte kommit igång. Knapparna skickar vanliga uppdrag, så de syns som vanligt hos eleverna.
- Du väljer om kartan visar lektionerna klassen arbetat med eller alla, och kan begränsa den till ett område. Klassfiltret följer med.

## Ditt djur och mynt

Mest tänkt för åk 3 till 5. Eleven väljer en mops, en katt eller en pingvin (fyra färger var), ger den ett namn och tjänar **mynt** genom att lära sig. Mynten används i butiken ("Mitt djur och butiken") till hattar, ansikte (glasögon, mustasch, clownnäsa), halsband och bakgrunder, 23 saker för 15 till 60 mynt. Djuret ritas som SVG (`pet-art.js`, inga bildfiler), rör sig lite (andas, blinkar, viftar, hoppar av glädje när man klappar det eller köper något) och rörelsen stängs av för den som bett om mindre rörelse. Logiken och skärmarna finns i `pet.js`.

- **Mynt för att lära sig, inte för att klicka.** En klar lektion ger 10 mynt (2 till 4 till för två eller tre stjärnor). Löser eleven en fråga efter ett fel ger det 1 mynt, högst 3 per lektion, så att den som kämpar också tjänar. Öva mer och Repetera ger 1 mynt per ny fråga, högst 10 om dagen, så det lönar sig inte att spamma lätta frågor. Nivåtestet ger 5 och djuret ger 20 i present. Läraren kan ge **presentmynt**: dekalerna "5, 10 eller 25 mynt till ditt djur" bland dekalerna i meddelandena.
- **Inget går förlorat.** Djuret är aldrig ledset eller hungrigt, det finns inga serier och inga dagliga mål, och ingen jämförelse mellan elever. Djuret säger uppmuntrande saker, och står med i lektionens nederkant ("Bra att du fortsatte!").
- **Mynten visas där de hör hemma:** på sammanfattningen när en lektion eller en runda är klar (djuret hoppar, "Du fick 14 nya mynt") och på startsidan, aldrig mitt i en fråga och aldrig i nivåtest eller prov.
- **Ingen ändring i databasen.** Djuret (art, färg, namn, vad som köpts och har på sig) sparas i elevens framsteg under nyckeln `pet`. Mynten räknas ut från elevens egna data (klara lektioner, svarsloggen, presentdekaler) minus det som köpts, så de är de samma på alla enheter och går inte att ändra i webbläsaren. Ändras ett pris senare påverkas inte det som redan köpts, för priset som betalades sparas.
- **Läraren** slår av djuret för en klass med samma ruta som stjärnor och märken ("Stjärnor, märken och djur" i klasslistan).
- Nya saker läggs till i listan `ITEMS` i `pet-art.js` (id, plats, namn, pris och ritning). `tests/pet.js` ritar alla kombinationer av djur, färg och sak och kontrollerar hur mynt tjänas.

## Läsning och uppläsning

Knappen "Aa Läsning" (i toppmenyn och i lektionsläget, `reading.js`) öppnar inställningar som sparas i webbläsaren (`localStorage`, nyckeln `gaussica-reading`): **textstorlek** (vanlig, större, störst), **typsnitt** (Lexend, ett typsnitt som många med lässvårigheter tycker är lätt att läsa), **luftig text** (större radavstånd och ordavstånd) och **talhastighet**. Knappen "🔊 Lyssna" vid förklaringar och frågor läser texten med webbläsarens svenska röst (`speechSynthesis`). Matematiken görs om till ord: ett bråk blir "tre fjärdedelar", `2^3` blir "2 upphöjt till 3", `·` blir "gånger" och så vidare (`GaussicaSpeech.toSpeech`, testad i `tests/speech.js`). Vilka röster som finns beror på enheten. Utan svensk röst visas en rad om det.

## Arbetsblad

Läraren väljer "🖨 Arbetsblad" i lärarvyn (`worksheet.js`): en eller flera lektioner, antal uppgifter per lektion och om bladet är **ett till alla**, **ett per elev i en klass** (varje elev får andra tal, namnet står på bladet) eller **flera varianter**. Uppgifterna skapas av lektionernas övningsmallar, och lektioner utan mallar ger sina egna uppgifter. Bladet har figurer, plats för uträkning (rutor eller linjer), sant eller falskt som rutor att kryssa i och matchning som numrerade begrepp mot bokstäver. **Facit** hamnar på sista sidan med alla blads svar. Tryck "Skriv ut" och välj "Spara som PDF" om du vill ha en fil. Samma alternativ ger alltid samma blad.

## Offline och snabbare start

- **En fil för kursen.** Vid publicering samlar `npm run build` (`scripts/build-bundle.js`) index och alla lektioner i `lessons/bundle.json`, så sidan hämtar kursen i en förfrågan i stället för över hundra. Filen skapas av GitHub-workflowen och checkas inte in (den står i `.gitignore`). Finns den inte, som när du kör `npm start` lokalt, läser sidan lektionsfilerna en och en. Den lokala servern delar medvetet inte ut bundlen, så dina ändringar syns direkt.
- **Fungerar utan uppkoppling.** `sw.js` (registreras av `offline.js`) sparar sidans egna filer och typsnitten efter första besöket. Filerna hämtas alltid från nätet först, så en ny version används direkt när det finns uppkoppling. Allt under `/api/` och allt från databasen sparas aldrig av tjänstearbetaren.
- **Konto och framsteg utan nät.** De tre läsningar som sidan behöver vid start (`/api/me`, `/api/me/data`, `/api/lessons`) sparas i webbläsaren och används bara när servern inte går att nå. De tas bort när eleven loggar ut.
- **Svar utan nät.** Svar och framsteg som inte kan skickas sparas i webbläsaren (`gaussica.outbox.<användare>`) och skickas automatiskt när uppkopplingen är tillbaka, även efter att fliken stängts. En liten ruta överst visar att du är offline.
- **Installera som app.** `manifest.webmanifest` och ikonerna `icon-192.png` och `icon-512.png` gör att sidan kan läggas på hemskärmen eller installeras från webbläsaren. Ikonerna ritas av samma former som `favicon.svg`.

## Integritetstext

Texten "Så hanteras dina uppgifter" (`privacy.js`) visas från sidfoten och inloggningsrutan. Lägg gärna in en kontaktadress i `config.js` (`contact`), så visas den i texten. Om skolan eller huvudmannen använder sidan bör de också kontrollera texten mot sina egna regler för personuppgifter.

## Uppdrag och återkoppling

- **Uppdrag.** I lärarvyn (rutan "Uppdrag") ger du en klass, eller en enskild elev, en lektion att göra, med datum och en hälsning. Du kan också trycka "Ge som uppdrag" på en lektion när du är inloggad som lärare. Uppdraget räknas som klart när eleven klarat alla uppgifter i lektionen, och du ser per elev om den är klar, påbörjad eller inte påbörjad.
- **Återkoppling.** Under varje elev kan du skriva ett meddelande, och under varje fråga i elevens svarslogg kan du skriva om just den frågan. Lägg gärna till en dekal (⭐ 👍 💪 🚀 💡 🎉 ❤️). Du ser om meddelandet är läst.
- **Elevens vy.** Uppdrag och nya meddelanden visas i en stor rosa ruta överst på sidan, med en knapp i toppmenyn ("📬 Uppdrag" med antal), en rosa "UPPDRAG"-flagga på lektionen i grafen, en remsa på lektionssidan och hälsningen ovanför just den fråga den gäller. Knappen i hero-rutan blir "Gör uppdraget →". Sidan hämtar nytt var andra minut och när fliken blir synlig igen.
- **Databas.** Två nya tabeller, `assignments` och `feedback`. Node-servern uppgraderar sig själv. För Cloudflare: kör `npx wrangler d1 execute gaussica --remote --file=schema.sql` en gång och sedan `npx wrangler deploy` (se `cloudflare/README.md`).

## Fråga läraren (chatt)

- **Eleven.** Knappen "💬 Fråga läraren" finns i toppmenyn och uppe i varje lektion och övning. Skriver eleven därifrån följer uppgiften med: lektionen, frågan, det eleven hunnit svara och om det blev rätt eller fel. Eleven kan bocka ur "Visa läraren vilken uppgift jag tittar på". Svaret syns i samma ruta, med en gul remsa överst på sidan och en prick på knappen. En elev kan skicka sex meddelanden i rad innan läraren hunnit svara.
- **Läraren.** Rutan "💬 Frågor från elever" högst upp i lärarvyn visar varje samtal, med de olästa först, och uppgiften eleven tittade på under varje fråga. Svara direkt där, markera som läst eller tryck "Visa elevens svar". Ett svar räknas också som läst. Knappen "Lärarvy" visar antalet obesvarade frågor, och sidan hämtar nytt varje minut (utan att skriva över ett svar som du håller på att skriva).
- **Databas.** Tabellen `chat`. Node-servern uppgraderar sig själv (schemaversion 4). För Cloudflare: kör `migrations/003-chat.sql` en gång (se cloudflare/README.md). Tills dess fungerar resten av sidan som förut, och chatten svarar att den inte är påslagen.
- **API.** `POST /api/me/chat`, `POST /api/me/chat/read`, `POST /api/teacher/chat`, `POST /api/teacher/chat/read`, `GET /api/teacher/chat/unread`. Samtalen följer med i `/api/me/data` (elev) och `/api/teacher/students` (lärare).

## Feedback (e-post till dig)

- **Knappen.** "Skicka feedback 📣" finns i sidfoten och uppe i varje lektion och övning. Besökaren väljer Något är fel, Ett förslag eller Något annat, skriver och kan lämna sin e-post för att få svar. Från en lektion följer frågan med (om besökaren låter den göra det), och är besökaren inloggad följer namn och klass med.
- **E-post.** Servern skickar varje meddelande till dig via Resend (gratis för några hundra mejl i månaden). Skapa ett konto på resend.com med den adress du vill ha feedback på, skapa en API-nyckel och sätt `RESEND_API_KEY` och `FEEDBACK_TO` (din adress). Med Node-servern är det miljövariabler (`RESEND_API_KEY=… FEEDBACK_TO=… node server.js`), med Cloudflare är det secrets, se cloudflare/README.md. Utan en egen domän skickas mejlet från onboarding@resend.dev och kan bara gå till adressen du registrerade kontot med. Vill du ha en egen avsändare, sätt `FEEDBACK_FROM`.
- **Sparas även.** Varje meddelande sparas i tabellen `site_feedback` (Node: schemaversion 5, Cloudflare: kör `migrations/004-site-feedback.sql` en gång), så inget går förlorat om mejlet inte går fram.
- **Skydd.** Fem meddelanden per timme och adress, en dold ruta som robotar fyller i och längdgränser.
- **Demoläge.** Utan server öppnas besökarens e-postprogram med ett färdigt meddelande till `contact` i config.js.
- **API.** `POST /api/feedback`, öppet för alla.

## Introduktionssidor och regler i lektionen

- **Introduktionen delas upp.** En lång förklaring läses på flera sidor ("Del 1 av 3"). Texten delas mellan meningar (`explanationParts` i `lesson-model.js`, förkortningar som t.ex. och decimaler som 3,5 räknas inte som meningsslut) i sidor på ungefär 380 tecken, och varje sida visas i korta stycken. En text under ca 560 tecken är en enda sida. Figur och regelruta kommer på sista sidan. Texten är större än förut (19 px, 18 px på mobil).
- **"Problemet:".** Börjar förklaringen med "Problemet:" tas ordet bort ur texten och visas som en gul etikett, 🧩 Problemet, ovanför problemtexten.
- **Regler när som helst.** Knappen 💡 Regler uppe till höger i lektionen och övningen öppnar en ruta med regelrutan, figuren och en hopfälld "Läs förklaringen igen" (öppen direkt om lektionen saknar regel). Rutan stänger man med Tillbaka till uppgiften, ✕, Esc eller ett tryck utanför, och uppgiften och svaret är kvar. I en övningsrunda visas regeln för just den frågans lektion.

## Sant eller falskt

En frågetyp där eleven tar ställning till påståenden. Den passar särskilt bra i begreppslektioner, men fungerar överallt.

- **Så ser det ut för eleven.** Varje påstående har två knappar, Sant och Falskt, och under dem knappen Kolla svaret (den blir tryckbar när alla är besvarade). Eleven får veta hur många som är rätt, inte vilka, och efter två misslyckade försök markeras de som är fel så att ingen fastnar. Är allt rätt visas en förklaring under varje påstående. Förklaringarna är alltså där man lär sig varför, inte bara att det var fel.
- **I lektionen.** Ett block i `components`, och ett eget uppdrag med id `sf-<blockets nummer>`:

```json
{ "type": "santfalskt", "prompt": "Sant eller falskt?", "shuffle": true,
  "statements": [
    { "text": "Ett kast med en tärning är ett försök.", "answer": true, "explain": "Ett försök är en gång du gör något där slumpen bestämmer." },
    { "text": "Det är omöjligt att få en sexa på en tärning.", "answer": false, "explain": "En sexa kan hända." } ] }
```

  `answer` ska vara `true` eller `false`. `explain` och `shuffle` (blandad ordning) är valfria. Blanda sanna och falska påståenden, annars är det lätt att gissa (`npm test` varnar). Påståendena visas som all annan text, så bråk, potenser och rötter ritas.
- **I redigeraren.** Lägg till blocket "Sant/falskt" och skriv påståendena, eller tryck "Skapa sant/falskt av korten" på ett begreppskort: då blir det sex påståenden av typen "Slump betyder: …", med rätt förklaring eller nästa korts förklaring, sanna och falska om vartannat. Läs igenom dem, för det är maskinskrivna påståenden. "Skapa av begreppskorten" under Övningsmallar gör också en sant/falskt-mall.
- **Övning och repetition.** I `practice` finns två nya slag av mall, båda med ett Sant/falskt-uppdrag som resultat och med `"for": ["sf-3"]` för att repetera just det uppdraget:
  - Lista: `{ "id": "sf", "mode": "santfalskt", "size": 4, "pool": [{ "text": "…", "answer": true, "explain": "…" }, …] }`. Varje gång väljs `size` påståenden slumpmässigt, med både sanna och falska när listan har båda.
  - Slumptal: en vanlig mall med `vars`, `derive` och `statements: [{ "text": "{a} + {b} = {s}", "answer": true }, { "text": "{a} är större än {b}", "answer": { "expr": "a-b", "min": 1 } }]`. `answer` är `true`/`false`, ett uttryck (`"=s"`, inte noll är sant) eller ett villkor `{ expr, min, max }` när sanningen beror på talen. Mallarna finns som färdiga startmallar i galleriet.
- **Lärarvyn.** Varje kontroll loggas som ett försök med elevens svar ("1: Sant · 2: Falskt") och vilka påståenden som var fel. Frågan till läraren (Fråga läraren) tar med påståendena.
- **Redan utdelade lektioner.** Lägger du ett sant/falskt-block i en lektion som redan är utdelad kommer det som en ny uppgift: elever som var klara med lektionen har då en uppgift kvar. Använd formatet i nya lektioner, eller lägg det i en kopia.

## Matematik i texten och språk för de yngre åren

- **Så skrivs det.** Alla texter, frågor och tabeller visar matematik som på papper (`richtext.js`): `1/2` blir ett bråk, `x^2` och `10^-3` får upphöjt tal (även negativt och `x^(-1)`), och `√50`, `√x` och `√(a + b)` ritas med rottecken och ett streck över talet under roten, utan parenteser. Rottecknet växer med det som står under det, till exempel `√((p/2)^2 − q)`. Skriv rötter så i lektionstexterna. Eleven skriver svar som `√2` eller `sqrt(2)`.
- **Yngre åk.** Ord införs i en lektion och används sedan bara i lektionerna nedanför den i trädet. I åk 3 undviker lektionerna svåra ord: man lägger ihop och drar ifrån, växlar (inte grupperar om), räknar på platser och gör ett överslag. Orden addera, subtrahera, summa, differens, produkt, kvot, term och faktor införs i "Begrepp: räknesätt och svar" (åk 4), och lektioner som använder dem har den som förkunskap. Platsvärde och position går bra från åk 4. Ordet utfall införs i "Begrepp: chans och slump" (åk 4), som kommer före lektionen om sannolikhet. `npm test` kontrollerar att inget av orden används i en lektion som kommer före sin begreppslektion (före åk 6).
- **Regler utan bokstäver.** Före algebran skrivs regler med ord och tal: "Du kan byta plats på talen: 3 · 7 = 7 · 3", "Area = längd · bredd", "Omkrets = 4 · sidan". Bokstäver som a, b och n som stand-in för tal används först från åk 6 (och x som okänt tal i lektionerna om likhet och balansvåg).

## Mobil och tangentbord

- **Följer det som syns.** `viewport.js` mäter den del av skärmen som är synlig (`visualViewport`) och skriver `--vv-h` och `--vv-top` på `<html>`. Lektionsspelaren, chatten, feedbackrutan och inloggningen använder dem i stället för 100 %, så de inte hamnar bakom tangentbordet. Metataggen `interactive-widget=resizes-content` gör samma sak åt Android.
- **Kompakt läge.** När ett textfält har fokus och den synliga höjden krympt (tangentbordet är uppe), eller på en mobil som hålls på tvären, får `<html>` klassen `is-keyboard` eller `is-short`. Då krymper spelaren: översta fältet visar bara förloppet och ✕, frågan upprepas ovanför svarsfältet, tipset begränsas till två rader, svarsfältet och knappen delar en rad, och Tillbaka och Hoppa över döljs tills tangentbordet försvinner.
- **Ritytan.** På skärmar under 640 px är ritytan ihopfälld ("Rita ▾") tills eleven öppnar den, om inget är ritat. Bredare skärmar visar den alltid.
- **Inzoomad rityta.** En ny teckning börjar inzoomad på smala skärmar, så att en ruta blir ungefär 20 bildpunkter och det går att trycka där man vill. Knappen med procenttalet går tillbaka till den storleken och ⤢ visar allt som är ritat. Sparade teckningar öppnas som de lämnades.
- **Svarsfält.** Svarsfältet och textrutorna på ritytan har autoversaler, autokorrigering och stavningskontroll avstängda, så att telefonen inte gör om x = 4 till X = 4. Rättningen ignorerar dessutom stora och små bokstäver (`symbolic-math.js`).
- **Fokus.** Ett fält som får fokus rullas fram om det skulle hamna bakom tangentbordet.
- Fungerar bara på riktiga telefoner fullt ut: testa gärna med tangentbordet uppe på både Android och iPhone.

## Svara med tal eller med uträkning

Där ett vanligt tal väntas som svar räknas en uträkning inte: "36/6" eller "3*6" är rätt värde, men eleven får tipset att räkna ut svaret och skriva talet. Det gäller åk 3–6, där poängen är att träna på att räkna. Från åk 7 tillåts uträkningar (lutning, ekvationer, formler), eftersom räknesteget då ses som enkelt. Frågor där svaret redan är ett bråk eller ett uttryck ("1/6", "x+3") påverkas inte.

Du kan styra det per lektion (fältet "Uträkning som svar" i redigeraren) eller per fråga, och per övningsmall, med `"allowExpression": true` eller `false`. Frågan går före lektionen, och lektionen före årskursen.

## Din väg och hela kartan

Eleverna ser först "Din väg": ett kort steg i taget med **Nu** (uppdrag från läraren, annars lektionen de håller på med, annars nästa lektion), upp till två **Sen**-lektioner och en **Pyssla**-lektion, med en stor knapp på varje kort. Hela lärandegrafen ligger bakom knappen "Visa hela kartan" (valet kommer ihåg). "Mer om lektionen" öppnar lektionspanelen. Lärare ser alltid hela kartan. Urvalet görs i `coach.js` (`path`) och ritas av `path-view.js`.

## Begreppslektioner

Lektioner med `"kind": "begrepp"` (märkta "BEGREPP" och "Aa" i grafen) lär ut vad matematiska ord betyder och testar sedan eleven genom att para ihop varje begrepp med rätt förklaring.

- `{ "type": "begreppskort", "cards": [{ "term", "definition", "example" }] }` visar begreppen som kort (steget "lär dig").
- `{ "type": "koppla", "prompt", "pairs": [{ "term", "definition" }] }` är ihopparningstestet, en egen fråga per omgång. Eleven väljer ett begrepp och en förklaring. Rätt par låses med en färg och ett nummer. Fel par loggas, och lärarvyn visar vilka begrepp som blandas ihop ("Blandade ihop X med Y"). Testet räknas som en uppgift i framsteg.
- Övningsmallar med `pool` ger fler omgångar: `"mode": "koppla"` (ihopparning, `size` par) och `"mode": "fraga"` (en förklaring, eleven skriver begreppet, `alt` anger andra godkända stavningar).

De åtta första lektionerna är: räknesätt, siffror och tal, former och mått, koordinatsystem, bråk och decimaltal, delare och primtal, statistik och chans samt algebra.

## Lärare: visa som elev

Knappen "👀 Visa som elev" i toppmenyn låter läraren se sidan som en elev ser den ("Din väg", rutan med uppdrag, kartan bakom en knapp). Ett rosa fält påminner om att man förhandsgranskar, och "Tillbaka till lärarvyn" tar en tillbaka. Svar man ger i elevvyn sparas på lärarkontot, inte hos eleverna. Valet minns tills fliken stängs.

## Stjärnor och märken

Eleverna får lätt och frivillig motivation, utan ranking och utan jämförelse mellan elever (`rewards.js`):

- **Stjärnor per lektion.** En stjärna för en klar lektion, två om de flesta svar blev rätt på första försöket och tre om alla blev det. De syns på lektionssidan, på slutskärmen och som en summa i toppmenyn (⭐).
- **Märken.** Till exempel "Första steget", "Fem klara", "Rätt direkt", "Ge inte upp", "Pysslaren", "Begreppsmästare", "Övaren" och "Uppdragsklar". "Mina märken" öppnas från stjärnan i toppmenyn och visar hur långt man kommit på de som saknas. När ett märke vinns visas en kort ruta och lite konfetti (inte om webbläsaren är inställd på mindre rörelse).
- **Ingen dagsmål-press.** Inget dagligt mål eller streak. Allt räknas ut från elevens egna svar, så inget extra sparas i databasen. Bara vilka märken som redan firats minns webbläsaren.
- **Läraren kan stänga av det.** I lärarvyns klasslista finns en ruta "Stjärnor och märken" per klass. När den är avstängd ser klassens elever varken stjärnor, märken eller konfetti. Inställningen ligger i tabellen `class_settings`.

## Lärarverktyg

- **Flera lektioner på en gång.** I rutan "Uppdrag" kan du lägga till flera lektioner (knappen "+ Lägg till fler lektioner"). Varje lektion blir ett eget uppdrag med samma klass, elev, datum och hälsning.
- **Öva mer som uppdrag.** Välj "Öva mer" under "Vad ska eleverna göra?" för att ge eleverna nya övningsfrågor i stället för själva lektionen. Uppdraget är klart när eleven svarat rätt på 5 olika övningsfrågor efter att uppdraget skapades. Det går bara för lektioner som har övningsmallar.
- **Förslag utifrån klassen.** Under formuläret visas lektioner där flera elever haft många fel de senaste veckorna (samma underlag som elevens "Repetera"). "Ge klassen Öva mer" fyller i formuläret, och "Ge bara dessa" skickar ett personligt uppdrag till de elever som behöver det.
- **Snabbsvar.** Ovanför varje meddelanderuta finns färdiga korta kommentarer. Skriv en egen text och tryck "+ Spara texten som snabbsvar" för att behålla den. Egna snabbsvar sparas i webbläsaren.
- **Rapport för utskrift.** "🖨 Rapport för utskrift" under en elev öppnar en ren sida med nyckeltal, lektioner, vad som är bra att öva mer på, uppdrag, senaste kommentarer och en ruta för egna anteckningar. Tryck "Skriv ut" och välj "Spara som PDF" om du vill ha en fil.
- **Redigeraren och begreppslektioner.** I redigeraren finns blocken "Begreppskort" och "Para ihop", typen "Begrepp (kort och matchning)" och, under lektionsinfo, rutan "Övningsmallar (Öva mer)". Knapparna "Skapa matchningstest av korten" och "Skapa av begreppskorten" bygger testerna och övningsmallarna åt dig. "Lägg till en räkne-mall" ger en mall att utgå från.

## Uppställning, potenser och Pythagoras i lektionerna

- **Uppställning steg för steg** (`figures.js`, typen `uppstallning`): `{ "type": "uppstallning", "op": "+" | "-" | "*" | "/", "a": 478, "b": 356 }`. Bilden ställer upp talen och eleven trycker på "Nästa steg". Varje steg markerar kolumnen, visar minnessiffror eller lån och förklarar med en mening. Multiplikation och division (kortdivision) tar en siffra som `b`. Figuren kan ligga som `visual`, eller som ett block i `components` och sedan i `layout`, så att en lektion kan ha flera exempel.
- **Pythagoras** (`type: "pythagoras"`): `{ "a": 3, "b": 4, "unit": "cm", "hideC": true }` ritar en rätvinklig triangel med en kvadrat på varje sida. `hideA`, `hideB` och `hideC` döljer en längd som eleven ska räkna ut.
- **Potenser i text.** Skriv `2^5`, `x^2` eller `(a+b)^2` så visas exponenten upphöjd, i alla texter, uppgifter och återkoppling.
- **Frågetexten** är större i lektionsläget, så att uppgifterna är lättare att läsa.

## Tester och mappar

- `npm test` kör alla kontroller: syntax i alla skript, alla lektioner (index, förkunskaper, svar och ledtrådar, inga × eller långa tankstreck), de genererade övningsfrågorna, hur svar jämförs och serverns API (startas på en ledig port med en tillfällig databas, så `data/` rörs aldrig). GitHub kör samma tester före varje publicering, så en trasig lektion stoppar publiceringen. Kör bara en del med till exempel `node tests/run.js lessons`.
- `tests/api-*.js` och `tests/practice.js` går också att köra var för sig. Cloudflare-API:t testas separat med `wrangler dev` (se `cloudflare/README.md`).
- Äldre statusrapporter och planer ligger i `docs/archive/`. Äldre skript och oanvända filer ligger i `dev/archive/`. `docs/` har guiderna för GitHub Pages och lärare, och `docs/logo-proposals/` har logotypförslagen.
- Nya svarsformer: `"form": "blandad"`, `"brak"` eller `"forenklat"` på en fråga kräver att rätt värde skrivs på ett visst sätt (1 3/4, 7/4 eller 2:3). Blandad form som `1 3/4` förstås som 7/4.
- Nya figurer: `tradiagram`, `parallellogram` och `trapets` (se början av `figures.js`).
- Uppställning av multiplikation med ett tvåsiffrigt tal (`"b": 23` med två siffror) visas med två rader och en slutlig addition. Figuren `vag` är en balansvåg: `{ "left": [{ "n": 7, "tone": "x" }, { "n": 3 }], "right": [{ "n": 10 }] }` ritar klossar och lutar efter vilken sida som väger mest. I en pyssla kan `n` vara ett uttryck som `"=x"`, så vågen ändras när eleven drar i ett reglage.

- Figurer för åk 5 till 9: `langdivision` (`a`, `b`: hela uträkningen med produkt och rest i varje steg), `areamodell` (`cols`, `rows`, `cells`: en rektangel delad i fyra, för (x + 3)(x + 2) och (a + b)²) och `trigonometri` (`angle`, `names`, `labels` med `hyp`, `opp`, `adj` och `angle`: en rätvinklig triangel med sidorna namngivna från en vinkel).
- Uttryck i övningsmallar kan även använda `sin`, `cos`, `tan`, `asin`, `acos` och `atan`, alla i grader. Mycket små tal skrivs ut med alla decimaler (0,0042).
- Svarsformer (`form` på en fråga): `blandad`, `brak`, `forenklat`, `utanparentes` (ett rätt svar som fortfarande har parenteser godtas inte, för uppgifter där parenteser ska multipliceras ut) och `grundpotens` (a · 10^n med a från 1 upp till 10). Kvadratrötter kan skrivas som √2 eller sqrt(2).
- Nya figurer för åk 4: `kroppar` (`items` med `shape`: kub, ratblock, cylinder, klot, kon, pyramid), `linjer` (`items` med `kind`: parallella, vinkelrata, skarande) och `strecktabell` (`rows` med `label` och `n`, `counts` visar antalet). Trapetsen kan visa sina parallella sidor med `"showHeight": false` och egna `labels`.
