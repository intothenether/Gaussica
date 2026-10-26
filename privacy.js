// "Så hanteras dina uppgifter": a short privacy text shown from the footer and the sign-in screen.
// The text follows how the site is run (shared database, own server or demo mode in the browser).

window.GaussicaPrivacy = (function () {
  "use strict";

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function whereStored() {
    const mode = window.GaussicaAPI && window.GaussicaAPI.mode && window.GaussicaAPI.mode();
    if (mode === "local") return "Just nu körs sidan i demoläge. Allt sparas då bara i den här webbläsaren på den här enheten och skickas aldrig vidare.";
    if (mode === "remote") return "Uppgifterna sparas i en databas som drivs av Cloudflare, åt den som driver sidan.";
    return "Uppgifterna sparas i en databas på servern som sidan körs på.";
  }

  function sections() {
    const cfg = window.GAUSSICA_CONFIG || {};
    const contact = cfg.contact ? "Kontakta " + cfg.contact + "." : "Kontakta din lärare, så hjälper hen dig vidare.";
    return [
      ["Vad sparas?", "Ditt namn (skriv gärna bara förnamn eller ett smeknamn), ditt användarnamn, ett krypterat lösenord och vilken klass du går i. När du räknar sparas dina svar, hur många försök du behövt, det du ritat på ritytan och hur långt du kommit. Gör du nivåtestet (Hitta din nivå) sparas vilka lektioner testet tror att du kan, och gör du ett prov sparas dina svar, rätt svar och hur lång tid det tog. Har du ett djur sparas vilket djur det är, vad det heter och vad du köpt till det. I snabbträningen sparas vilka räknefakta du tränat, hur ofta de blivit rätt och hur lång tid svaren tog, och för repetitionen sparas när varje klar lektion ska fräschas upp. Mynten räknas ut från det du gjort och sparas inte som egna uppgifter. Skriver du till din lärare med knappen Fråga läraren sparas meddelandet, svaret du får och vilken uppgift du tittade på. Skickar du feedback om sidan sparas meddelandet och skickas som e-post till den som driver sidan, tillsammans med ditt namn och din klass om du är inloggad."],
      ["Varför?", "Så att du kan fortsätta där du slutade, få tips som passar dig och så att din lärare kan se hur det går och hjälpa dig."],
      ["Vem kan se det?", "Du själv och läraren som skapade din klass. Det gäller också nivåtest, prov och uppgifter som din lärare delar ut, och din lärare kan ge dig mynt till djuret. Ditt djur, dess namn och hur många mynt du har syns för din lärare men inte för andra elever. Uppgifterna säljs inte, delas inte med andra och används inte till reklam."],
      ["Var sparas det?", whereStored()],
      ["Cookies och spårning", "Sidan har ingen spårning och inga reklamcookies."],
      ["Vad sparas i din webbläsare?", "En inloggningsnyckel, så att du förblir inloggad. Dina läsinställningar (textstorlek, typsnitt och talhastighet). En kopia av sidans filer och lektionerna, så att sidan kan öppnas utan internet. När du är inloggad också en kopia av ditt konto och dina framsteg, och svar som inte hunnit skickas när du var utan internet. Svaren skickas när du är uppkopplad igen. Kopian av ditt konto och dina framsteg tas bort när du loggar ut, men svar som ännu inte skickats blir kvar tills de har skickats. Använder du en delad dator, logga alltid ut."],
      ["Uppläsning och typsnitt", "Knappen Lyssna läser upp texten med den röst som finns i din webbläsare eller på din enhet. Vi skickar ingen text någonstans själva, men en del enheter använder en röst som hämtas från internet. Typsnitten hämtas från Google Fonts, och då ser Google din IP-adress."],
      ["Dina val", "Du kan be om att få dina uppgifter rättade eller raderade. Elever vänder sig till sin lärare, som kan ta bort ett konto i lärarvyn. " + contact]
    ];
  }

  function close() {
    const o = document.getElementById("privacy-overlay");
    if (o) o.remove();
    if (close.opener && document.contains(close.opener)) close.opener.focus();
    close.opener = null;
  }

  function open() {
    if (document.getElementById("privacy-overlay")) return;
    close.opener = document.activeElement;
    const overlay = el("div", "pv-overlay");
    overlay.id = "privacy-overlay";
    const card = el("div", "pv-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "pv-title");
    const title = el("h2", "", "Så hanteras dina uppgifter");
    title.id = "pv-title";
    card.appendChild(title);
    sections().forEach(function (s) {
      card.appendChild(el("h3", "", s[0]));
      card.appendChild(el("p", "", s[1]));
    });
    const done = el("button", "primary-button pv-close", "Okej");
    done.type = "button";
    done.addEventListener("click", close);
    card.appendChild(done);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });
    document.body.appendChild(overlay);
    done.focus();
  }

  // A small text button that opens the text.
  function link(label, className) {
    const b = el("button", className || "pv-link", label || "Så hanteras dina uppgifter");
    b.type = "button";
    b.addEventListener("click", open);
    return b;
  }

  const footer = document.getElementById("footer-privacy");
  if (footer) footer.addEventListener("click", open);

  // ----- cookie notice -----
  // The site sets no tracking or advertising cookies, only what is needed to stay signed in, so this is a
  // short notice with one button. The choice is remembered in the browser.
  const NOTICE_KEY = "gaussica.cookies-ok";

  function noticeSeen() {
    try { return window.localStorage.getItem(NOTICE_KEY) === "1"; } catch (e) { return false; }
  }

  function showCookieNotice() {
    if (noticeSeen() || document.getElementById("cookie-notice")) return;
    const box = el("section", "cookie-notice");
    box.id = "cookie-notice";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Om cookies");
    box.appendChild(el("h2", "", "🍪 Om cookies"));
    box.appendChild(el("p", "", "Vi använder bara det som behövs för att du ska kunna logga in och för att sidan ska fungera. Ingen spårning och inga reklamcookies."));
    const actions = el("div", "cookie-actions");
    const ok = el("button", "primary-button", "Okej");
    ok.type = "button";
    ok.addEventListener("click", function () {
      try { window.localStorage.setItem(NOTICE_KEY, "1"); } catch (e) { /* storage blocked: it just shows again next time */ }
      box.remove();
    });
    actions.append(ok, link("Läs mer"));
    box.appendChild(actions);
    document.body.appendChild(box);
  }

  showCookieNotice();

  return { open: open, close: close, link: link };
}());
