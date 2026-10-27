# Kort konsekvensbedömning: Gaussica

Underlag för en bedömning av risker för elevers rättigheter och friheter enligt artikel 35 i dataskyddsförordningen. Det är den kortversion som den som driver tjänsten tagit fram för att skolans dataskyddsombud ska kunna fatta beslut snabbare. Skolhuvudmannen ansvarar för den slutliga bedömningen.

> Ifylls av skolan: [huvudman], [datum], [dataskyddsombudets namn]. Text inom [hakparentes] ska fyllas i eller bekräftas innan bedömningen används.

## 1. Behövs en fullständig konsekvensbedömning?

Behandlingen gäller barn, som är en särskilt skyddsvärd grupp, och följer deras arbete i matematik över tid. Det talar för att skolan bör göra en bedömning enligt artikel 35 och kontrollera Integritetsskyddsmyndighetens (IMY) lista över behandlingar som kräver det. Behandlingen innehåller däremot ingen känslig uppgift som tjänsten själv frågar efter, ingen övervakning av eleverna utanför tjänsten, ingen automatiserad beslutsfattande med rättsliga följder och ingen kombination av data från andra källor. Dokumentet här är tänkt som underlag för den bedömningen, och för många skolor räcker det som dokumentation av den. Slutsatsen står i punkt 8.

## 2. Beskrivning av behandlingen

**Vad tjänsten är.** En webbplats med matematiklektioner för årskurs 3 till gymnasiet. Eleven loggar in med användarnamn och lösenord, räknar uppgifter, får hjälp och tips, och kan träna, repetera och göra nivåtest och prov. Läraren skapar klasser, delar ut uppdrag och prov, följer elevernas arbete och ger återkoppling.

**Personuppgifter** (full lista i bilaga 1 till personuppgiftsbitradesavtal.md): visningsnamn, användarnamn, krypterat lösenord, klass, elevens svar och framsteg, ritningar, resultat i nivåtest och prov, träningsstatistik, ett valfritt husdjur, meddelanden till läraren.

**Registrerade:** elever (främst 9 till 16 år) och lärare.

**Mottagare:** eleven själv och elevens lärare. Underbiträden i drift (Cloudflare, GitHub, i vissa fall Resend), se dataplats-och-underbitraden.md. Inga andra.

**Rättslig grund** (skolans bedömning): uppgift av allmänt intresse, artikel 6.1 e, inom undervisningen. Samtycke används inte som rättslig grund, eftersom eleverna står i beroendeställning till skolan.

**Lagring:** tills kontot raderas. Läraren kan radera elev eller klass, eleven kan radera sig själv. Se radering-och-gallring.md.

## 3. Nödvändighet och proportionalitet

| Fråga | Bedömning |
| --- | --- |
| Behövs varje uppgift? | Namn behövs för att läraren ska känna igen eleven (förnamn eller smeknamn räcker). Svar och framsteg behövs för att eleven ska kunna fortsätta och få träffsäkra tips och för att läraren ska kunna hjälpa. Träning, repetition och husdjur behandlar bara elevens egna framsteg och används för samma ändamål. |
| Finns mindre ingripande sätt? | Tjänsten samlar inte in personnummer, e-post, telefonnummer, adress, födelsedatum eller foto. Eleven kan använda ett smeknamn. Läraren kan stänga av husdjur och belöningar för klassen. |
| Hålls uppgifterna korrekta? | Eleven och läraren kan ändra och radera. Operatören rättar på begäran. |
| Hur länge sparas de? | Skolan bestämmer. Rekommendation: radera klassen vid läsårets slut. |
| Information till de registrerade | Texten Så hanteras dina uppgifter är skriven för barn och finns på inloggningssidan och i sidfoten. Skolan bör också informera vårdnadshavare. |
| Registrerades rättigheter | Eleven kan själv ladda ner och radera sina uppgifter. Läraren kan göra det åt eleven. |
| Biträden | Personuppgiftsbiträdesavtal med bilagor. Underbiträden listade. |
| Överföring utanför EU | Databasen ligger i EU-jurisdiktion. Vissa underbiträden är amerikanska bolag (punkt 5 i dataplats-och-underbitraden.md). |

## 4. Vad tjänsten medvetet inte gör

- Ingen spårning, ingen analys från tredje part, inga reklamcookies.
- Inga uppgifter säljs eller lämnas ut till andra än skolans egen lärare.
- Ingen AI-behandling av elevernas svar eller meddelanden.
- Inga jämförelser mellan elever som eleverna själva ser. Ingen ranking och inga dagliga mål eller serier som skapar press.
- Ingen automatisk betygssättning. Nivåtest och tips är stöd som läraren och eleven kan följa eller strunta i. Betyg sätts av läraren.

## 5. Risker för de registrerade och åtgärder

Bedömning före åtgärder, sedan kvarstående risk. Skala: låg, medel, hög.

| # | Risk | Före | Åtgärd | Kvar |
| --- | --- | --- | --- | --- |
| 1 | Obehörig läser elevers uppgifter (dataintrång, gissat lösenord) | Medel | Saltad långsam hash för lösenord, gräns för antal inloggningsförsök, sessionsnycklar sparas som hash, åtkomstkontroll på servern, TLS, databas krypterad i vila hos underbiträdet. Lösenord ska vara minst 8 tecken | Låg |
| 2 | En lärare ser elever som inte är hens | Medel | Läraren når bara klasser hen själv skapat. Elever når bara sig själva. Kontrolleras av automatiska tester. Lärare måste ha lärarkod för att registrera sig | Låg |
| 3 | Känsliga uppgifter hamnar i meddelanden till läraren eller i ett namn | Medel | Tjänsten frågar inte efter sådant. Meddelandefältet och registreringen uppmanar eleven att inte skriva privata uppgifter. Läraren kan ta bort meddelanden och elever. Begränsad meddelandelängd och gräns för obesvarade meddelanden | Låg |
| 4 | Eleven känner sig övervakad eller bedömd av sina framsteg | Medel | Ingen ranking mellan elever, inga dagliga mål eller serier. Husdjur och belöningar kan stängas av. Tonen i återkopplingen är uppmuntrande. Eleven kan själv se och ladda ner det som sparats (Konto, Mina uppgifter) | Låg |
| 5 | Uppgifter blir kvar när de inte längre behövs | Medel | Eleven, läraren eller operatören kan radera allt direkt. Rutin att radera klassen vid läsårets slut (lärarvyn). Operatören kan radera inaktiva konton på begäran | Låg |
| 6 | Uppgifter behandlas i USA av underbiträden | Medel | Databasen i EU-jurisdiktion. Cloudflare, GitHub och Resend erbjuder standardavtalsklausuler och uppger att de är anslutna till Data Privacy Framework [kontrollera aktuell status för varje bolag]. Typsnitten hämtas från tjänstens egen server, så ingen IP-adress går till Google. E-post för feedback kan stängas av | Låg till medel |
| 7 | En elev på en delad dator lämnar konton öppna | Låg | Utloggning rensar kopian av kontot i webbläsaren. Integritetstexten uppmanar till utloggning på delade datorer. Sessioner går ut efter 30 dagar | Låg |
| 8 | Elev eller vårdnadshavare förstår inte vad som sparas | Medel | Integritetstext på enkel svenska med exakt lista, ladda ner egna uppgifter, dokument för vårdnadshavare | Låg |
| 9 | Avbrott eller dataförlust | Låg | Återställning av databasen till valfri minut de senaste 30 dagarna hos underbiträdet. Eleven förlorar i värsta fall övningsframsteg, inga betyg eller andra handlingar. Skolan ska inte använda tjänsten som enda lagring av bedömningsunderlag | Låg |
| 10 | Operatören (en person) blir ett enskilt felsteg | Medel | Åtkomst till databasen med tvåfaktorsinloggning. Inga elevdata i test. Instruktion i avtalet. Bekräfta att fler än en person kan nå driften vid behov | Låg till medel |

## 6. Uppgifter om barn

Tjänsten har inget krav på ålder. Användaren är en elev i en klass som en lärare skapat, så skolan, inte barnet eller en vårdnadshavare, har valt att använda tjänsten. Det påverkar:

- information: texten är skriven för barn, och skolan bör informera vårdnadshavare;
- rättslig grund: allmänt intresse, inte samtycke;
- barnets rättigheter: barnet kan själv ladda ner och radera sitt konto;
- minimering: barnet uppmanas att använda smeknamn.

## 7. Samråd

Skolans dataskyddsombud och rektor bör ha läst dokumentet. Om skolan bedömer att en kvarstående risk är hög ska förhandssamråd med IMY ske enligt artikel 36. Med de åtgärder som finns bedömer operatören att så inte är fallet.

## 8. Slutsats

Operatörens bedömning: behandlingen är begränsad till det som behövs för undervisningen, innehåller inga känsliga uppgifter som tjänsten själv samlar in, och riskerna för eleverna är låga till medelhöga före åtgärder och låga efter dem. De kvarstående punkterna är:

1. underbiträden som är amerikanska bolag (risk 6), vilket skolan kan minska genom att kräva att e-post för feedback stängs av och att sidorna läggs på skolans egen server;
2. att tjänsten drivs av en enskild person (risk 10).

Skolans beslut: [godkänd / godkänd med villkor / ej godkänd], [datum], [namn och roll].

## 9. Uppföljning

Bedömningen uppdateras när tjänsten får ny behandling av personuppgifter, byter underbiträde eller efter en personuppgiftsincident, och granskas minst en gång per år: [nästa granskning].
