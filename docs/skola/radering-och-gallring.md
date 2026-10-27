# Radering, utlämning och gallring

Hur uppgifter hämtas ut och raderas, vem som kan göra det och vad som sker med säkerhetskopior. Rutinen gäller både den hostade tjänsten och en egen server.

## 1. Vem kan göra vad

| Vad | Elev | Lärare | Den som driver tjänsten |
| --- | --- | --- | --- |
| Ladda ner sina egna uppgifter | Ja: Konto, Mina uppgifter, Ladda ner | Ja, samma ställe | |
| Ladda ner en elevs uppgifter | | Ja: lärarvyn, eleven, Ladda ner elevens uppgifter | På begäran |
| Radera sitt eget konto | Ja: Konto, Mina uppgifter, Radera mitt konto (kräver lösenordet) | Ja, samma ställe. Raderar också lärarens klasser och alla elever i dem | |
| Radera en elev | | Ja: lärarvyn, eleven, Ta bort elev | På begäran |
| Radera en hel klass | | Ja: lärarvyn, Klasser, Radera klassen (kräver att klassens namn skrivs) | På begäran |
| Återställa en elevs lösenord | | Ja | |
| Rätta ett namn | | Skapa nytt konto om det behövs | På begäran |

Raderingen är fullständig och går inte att ångra. Allt som hör till kontot tas bort direkt ur databasen:

- kontot, lösenordshashen och inloggningssessioner,
- svar, framsteg, ritningar, nivåtest, prov, träning, repetition och husdjur,
- meddelanden till och från läraren och lärarens återkoppling till eleven,
- uppdrag som var riktade till eleven (och för en klass: alla klassens uppdrag),
- feedback om tjänsten som eleven skickat som inloggad (hittas via avsändartexten, namn och klass).

Det som inte raderas: lärarens ändringar av lektionernas innehåll (de innehåller inga elevuppgifter) och sådant som redan lämnat tjänsten, till exempel en nedladdad fil eller ett utskrivet arbetsblad. Meddelanden till operatören via e-post (om funktionen är på) ligger kvar i operatörens e-post och raderas av operatören på begäran.

## 2. Rekommenderad gallring

| När | Vad | Vem |
| --- | --- | --- |
| Vid läsårets slut | Radera klassen (eller spara först elevernas uppgifter om skolan behöver dem för bedömning) | Läraren |
| När en elev slutar skolan | Radera eleven | Läraren |
| Efter [12 månader] utan inloggning | Radera kontot | Operatören, på begäran av skolan (se punkt 4) |
| När avtalet upphör | Radera allt som hör till huvudmannen | Operatören, inom 30 dagar, med skriftlig bekräftelse |

Tjänsten raderar inte konton av sig själv. Skolan bestämmer lagringstiden. Elevens framsteg är övningsdata. Bedömningsunderlag som skolan behöver spara (till exempel det som exporteras som bedömningsunderlag i lärarvyn) hör till skolans egen dokumenthantering och ska sparas där, inte här.

## 3. Begäran från elev eller vårdnadshavare

1. **Tillgång** ("vad har ni om mig?"): eleven laddar ner sina uppgifter själv, eller läraren laddar ner dem åt eleven. Filen är JSON och kan öppnas i vilken textläsare som helst.
2. **Radering**: eleven eller läraren raderar kontot enligt punkt 1. Det tar effekt direkt.
3. **Rättelse**: läraren skapar ett nytt konto med rätt namn och raderar det gamla, eller kontaktar operatören.
4. **Invändning eller begränsning**: kontakta skolan, som kontaktar operatören. Operatören kan till exempel stänga av husdjur och belöningar för en klass (läraren gör det själv under Klasser).

Begäranden som kommer direkt till operatören skickas vidare till skolan, som svarar inom en månad.

## 4. För operatören: radera på begäran

Gör det bara på uppdrag av skolan, och bekräfta skriftligt när det är gjort.

**Cloudflare D1.** Byt `elevnamn` mot elevens användarnamn. Kör som en fil, för att alla delar ska följa med:

```sql
DELETE FROM site_feedback WHERE sender IN (
  SELECT u.display_name || ' (elev' || COALESCE(', klass ' || c.name, '') || ')'
  FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.username = 'elevnamn');
DELETE FROM chat WHERE student_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM attempts WHERE user_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM progress WHERE user_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM feedback WHERE student_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM assignments WHERE student_id IN (SELECT id FROM users WHERE username = 'elevnamn');
DELETE FROM users WHERE username = 'elevnamn' AND role = 'student';
```

```bash
npx wrangler d1 execute gaussica --remote --file=radera-elev.sql
```

För en hel klass används i stället `class_id = <klassens id>` i varje delfråga. Det är ett nödfall: lärarna kan radera klasser själva, och det är det normala sättet.

**Egen server (SQLite).** Databasen har främmande nycklar med radering som följd. Öppna den med ett SQLite-verktyg, slå på kontrollen och radera användaren:

```sql
PRAGMA foreign_keys = ON;
DELETE FROM users WHERE username = 'elevnamn';
```

Kontrollera sedan att inga rader finns kvar: `SELECT COUNT(*) FROM progress WHERE user_id = <id>` och motsvarande för `attempts`, `chat` och `feedback`.

## 5. Säkerhetskopior

- **Hostad tjänst:** Cloudflare D1 behåller databasens historik i 30 dagar (Time Travel). Raderade uppgifter förfaller därifrån inom den tiden och återställs inte av operatören, utom vid ett haveri och då bara till den tidpunkt som behövs. Efter en återställning ska raderingar som skett sedan dess göras om.
- **Egen server:** skolan bestämmer. Rekommendation: kopior sparas högst 30 dagar.

## 6. Dokumentation

Operatören sparar inte uppgifter om vem som raderats utöver det som skolan skriftligen begär. En kort anteckning (datum, användarnamn eller klass, vem som begärde) räcker.
