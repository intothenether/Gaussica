# Gaussica för skolor: underlag för beslut om att börja använda tjänsten

Svenska skolor behöver ofta ett beslut, ett avtal och en bedömning av risker innan en digital tjänst får användas med elever. Här finns det som brukar efterfrågas, skrivet så att en rektor, ett dataskyddsombud eller en IT-ansvarig kan läsa det på några minuter.

> Dokumenten är mallar och underlag. De är inte juridisk rådgivning. Skolhuvudmannen (kommunen, friskolan) och dess dataskyddsombud bedömer och beslutar. Text inom [hakparentes] fylls i av den som driver tjänsten respektive av skolan innan något skrivs under.

| Dokument | Vad det är | Vem använder det |
| --- | --- | --- |
| [personuppgiftsbitradesavtal.md](personuppgiftsbitradesavtal.md) | Mall för personuppgiftsbiträdesavtal enligt artikel 28 i dataskyddsförordningen, med bilagor | Skolhuvudmannen och den som driver Gaussica skriver under |
| [konsekvensbedomning.md](konsekvensbedomning.md) | Kort konsekvensbedömning: vad som behandlas, risker för eleverna och åtgärder | Dataskyddsombud och rektor |
| [dataplats-och-underbitraden.md](dataplats-och-underbitraden.md) | Var uppgifterna lagras, vilka underleverantörer som finns och vad som lämnar EU | IT-ansvarig, dataskyddsombud |
| [radering-och-gallring.md](radering-och-gallring.md) | Hur uppgifter raderas, hämtas ut och gallras, för elever, lärare och den som driver tjänsten | Alla |

## Det viktigaste i korthet

- **Roller.** Skolhuvudmannen är personuppgiftsansvarig. Den som driver Gaussica är personuppgiftsbiträde och behandlar uppgifterna bara efter skolans instruktioner.
- **Vad som sparas.** Namn (förnamn eller smeknamn räcker), användarnamn, ett krypterat lösenord, klass och elevens arbete i tjänsten: svar, framsteg, ritningar, nivåtest, prov, träning och ett valfritt husdjur. Inga personnummer, inga adresser, ingen e-post för elever (bortsett från en valfri svarsadress som en elev själv kan skriva i feedbackformuläret) och inga känsliga uppgifter som tjänsten själv frågar efter.
- **Ingen spårning.** Inga reklamcookies, ingen analys från tredje part, ingen försäljning eller delning av uppgifter, ingen AI-behandling av elevernas uppgifter.
- **Var.** Databasen ligger hos Cloudflare i EU-jurisdiktion (D1 med `--jurisdiction eu`). Typsnitten ligger på tjänstens egen server, så ingen elevs IP-adress går till Google. Se [dataplats-och-underbitraden.md](dataplats-och-underbitraden.md) för vad som gäller för resten.
- **Radering.** Eleven kan själv ladda ner och radera sitt konto. Läraren kan radera en elev eller en hel klass med ett klick, till exempel när läsåret är slut. Läraren kan ladda ner en elevs uppgifter. Se [radering-och-gallring.md](radering-och-gallring.md).
- **Läraren ser bara sina egna elever.** Åtkomst styrs av klasskoden och lärarens egna klasser.

## Checklista för skolan

1. Läs [konsekvensbedomning.md](konsekvensbedomning.md) och avgör med dataskyddsombudet om en fullständig konsekvensbedömning behövs.
2. Fyll i och skriv under [personuppgiftsbitradesavtal.md](personuppgiftsbitradesavtal.md).
3. Bestäm vilka lärare som får skapa klasser och hur klasskoder delas ut.
4. Bestäm när klasserna raderas (förslag: vid läsårets slut) och lägg det i skolans rutiner.
5. Informera eleverna och vårdnadshavarna. Tjänstens egen text finns under länken Integritet i sidfoten och kan bifogas.
6. Börja med en klass. Det går att byta ut allt senare, för raderingen är fullständig.

## Kontakt

Frågor om dataskydd, avtal eller radering: [kontaktadress, finns också i integritetstexten på sidan].
