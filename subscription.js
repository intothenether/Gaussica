// Who may use the site, seen from the page: a slim bar for an adult (a trial that runs out, an address that is missing), the screen that is shown when a
// family has no access, and the two parts of "Mitt konto" that are about an adult: the e-mail address and the subscription.
//
//   GaussicaSubscription.start(user, API)        after sign-in: shows the bar and, when the family has no access, the screen
//   GaussicaSubscription.expired()               the server said 402: the screen for a family without access
//   GaussicaSubscription.emailSection(user, API) the e-mail address in "Mitt konto" (an element, or null for a child)
//   GaussicaSubscription.subscriptionSection(user, API)  the subscription in "Mitt konto" (an element, or null when it is not for this user)
//   GaussicaSubscription.describe(access)        the access as a sentence ("Provperiod: 9 dagar kvar")
//
// What the user gets from the server (see server/account.js): user.access = { state: "active" | "expired", plan: "free" | "trial" | "paid" | "school", reason, until,
// daysLeft, cancelAtPeriodEnd, billing } and, for an adult, user.email and user.emailVerified. Nothing here is checked as a secret: the server decides.

window.GaussicaSubscription = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  let me = null;
  let api = null;
  let screenShown = false;

  const dateText = (iso) => { try { return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
  const days = (n) => n + (n === 1 ? " dag" : " dagar");
  const isAdult = (u) => Boolean(u && (u.role === "teacher" || u.role === "caregiver"));
  const isFamilyOwner = (u) => Boolean(u && u.role === "caregiver");

  function describe(access) {
    if (!access) return "";
    if (access.state === "expired") return access.plan === "trial" ? "Provperioden har gått ut." : "Prenumerationen har gått ut.";
    if (access.plan === "trial") return "Provperiod: " + days(access.daysLeft === null ? 0 : access.daysLeft) + " kvar.";
    if (access.plan === "paid") return access.cancelAtPeriodEnd ? "Prenumerationen avslutas " + dateText(access.until) + "." : "Prenumerationen är aktiv" + (access.until ? " och förnyas " + dateText(access.until) : "") + ".";
    if (access.plan === "free") {
      const why = access.reason === "founder" ? " (tidig användare)" : access.reason === "beta" ? " (medan tjänsten är gratis)" : "";
      return "Gratis åtkomst" + why + (access.until ? " till " + dateText(access.until) : "") + ".";
    }
    return "";
  }

  function openAccount() {
    if (window.GaussicaAccount && window.GaussicaAccount.openStudentModal) window.GaussicaAccount.openStudentModal();
  }

  // ----- the plans, a code, and the customer portal (shared by the screen and "Mitt konto") -----
  async function startCheckout(plan, message) {
    try {
      const r = await api.post("/api/billing/checkout", { plan: plan });
      window.location.href = r.url;
    } catch (err) { message.className = "sub-msg is-error"; message.textContent = err.message; }
  }

  function plansBlock(status, message) {
    const box = makeElement("div", "sub-plans");
    (status.plans || []).forEach(function (p) {
      const b = makeElement("button", "sub-plan");
      b.type = "button";
      b.append(makeElement("strong", "", p.label), makeElement("span", "", p.text));
      b.addEventListener("click", function () { b.disabled = true; startCheckout(p.id, message); });
      box.appendChild(b);
    });
    return box;
  }

  function codeBlock(message, done) {
    const form = makeElement("form", "sub-code");
    const input = document.createElement("input");
    input.type = "text";
    input.name = "code";
    input.autocomplete = "off";
    input.placeholder = "Kod";
    input.setAttribute("aria-label", "Kod som ger gratis åtkomst");
    const go = makeElement("button", "secondary-button", "Använd kod");
    go.type = "submit";
    form.append(makeElement("span", "", "Har du en kod?"), input, go);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      message.className = "sub-msg";
      try {
        const r = await api.post("/api/billing/redeem", { code: input.value });
        message.className = "sub-msg is-ok";
        message.textContent = "Koden fungerar. " + describe(r.access);
        if (done) done(r.access);
      } catch (err) { message.className = "sub-msg is-error"; message.textContent = err.message; }
    });
    return form;
  }

  // ----- the screen for a family without access -----
  function showScreen() {
    if (screenShown || !me) return;
    screenShown = true;
    const overlay = makeElement("div", "sub-screen");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sub-title");
    const card = makeElement("div", "sub-card");
    const title = makeElement("h2");
    title.id = "sub-title";
    card.appendChild(title);
    const message = makeElement("p", "sub-msg");
    message.setAttribute("role", "status");
    const close = function () { overlay.remove(); screenShown = false; };
    const logout = makeElement("button", "account-logout", "Logga ut");
    logout.type = "button";
    logout.addEventListener("click", function () { window.GaussicaAuth.logout(); });
    if (me.role === "student") {
      title.textContent = "Familjens prenumeration har gått ut";
      card.append(makeElement("p", "", "Be din vårdnadshavare logga in på Gaussica och förnya. Dina framsteg finns kvar och väntar på dig."), logout);
    } else {
      title.textContent = me.access && me.access.plan === "trial" ? "Provperioden har gått ut" : "Prenumerationen har gått ut";
      card.appendChild(makeElement("p", "", "Barnens framsteg finns kvar. Välj en prenumeration för att de ska kunna fortsätta. Du kan alltid ladda ner eller radera allt under Mitt konto."));
      api.get("/api/billing").then(function (status) {
        if (status.checkout && (status.plans || []).length) card.insertBefore(plansBlock(status, message), message);
        else card.insertBefore(makeElement("p", "sub-msg", "Betalning är inte påslagen än. Hör av dig till den som driver sidan."), message);
      }).catch(function () { /* the message below stays */ });
      card.append(message, codeBlock(message, function () { close(); window.location.reload(); }));
      const keep = makeElement("button", "pv-link", "Fortsätt utan prenumeration (bara läsa)");
      keep.type = "button";
      keep.addEventListener("click", close);
      card.append(keep, logout);
    }
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ----- the slim bar -----
  function bar(text, actionLabel, action, key) {
    let el = document.getElementById("sub-bar");
    if (el) el.remove();
    try { if (key && window.localStorage.getItem("gaussica.bar." + key + "." + me.id)) return; } catch (e) { /* storage blocked */ }
    el = makeElement("div", "sub-bar");
    el.id = "sub-bar";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Meddelande om kontot");
    el.appendChild(makeElement("span", "", text));
    const go = makeElement("button", "sub-bar-go", actionLabel);
    go.type = "button";
    go.addEventListener("click", action);
    el.appendChild(go);
    if (key) {
      const x = makeElement("button", "sub-bar-x", "✕");
      x.type = "button";
      x.setAttribute("aria-label", "Stäng meddelandet");
      x.addEventListener("click", function () { el.remove(); try { window.localStorage.setItem("gaussica.bar." + key + "." + me.id, "1"); } catch (e) { /* storage blocked */ } });
      el.appendChild(x);
    }
    // after the link past the menus, so that the first Tab still reaches that
    const skip = document.querySelector(".skip-link");
    if (skip && skip.parentNode === document.body) document.body.insertBefore(el, skip.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
  }

  function start(user, API) {
    me = user;
    api = API;
    if (!user) return;
    const access = user.access;
    if (access && access.state === "expired") { showScreen(); return; }
    if (isFamilyOwner(user) && access && access.billing && (access.plan === "trial" || (access.plan === "paid" && access.cancelAtPeriodEnd) || (access.plan === "free" && access.until))) {
      bar(describe(access), access.plan === "trial" ? "Välj prenumeration" : "Visa", openAccount, null);
    } else if (isAdult(user) && !user.email) {
      bar("Lägg till din e-postadress så att du kan få ett nytt lösenord om du glömmer det.", "Lägg till", openAccount, "email");
    } else if (isAdult(user) && user.email && !user.emailVerified) {
      bar("Bekräfta din e-postadress: vi har skickat ett mejl till " + user.email + ".", "Skicka igen", function () {
        api.post("/api/me/email/resend", {}).then(function () { const b = document.getElementById("sub-bar"); if (b) b.firstChild.textContent = "Vi har skickat ett nytt mejl till " + user.email + "."; }).catch(function () { /* the bar stays */ });
      }, "verify");
    }
  }

  function expired() {
    if (me) { me.access = Object.assign({}, me.access || {}, { state: "expired" }); showScreen(); }
  }

  // ----- "Mitt konto": e-mail -----
  function emailSection(u, API) {
    if (!isAdult(u)) return null;
    api = api || API;
    const box = makeElement("div", "account-form sub-section");
    box.appendChild(makeElement("h4", "", "E-post"));
    const status = makeElement("p", "account-note", u.email ? u.email + (u.emailVerified ? " · bekräftad" : " · inte bekräftad än") : "Du har ingen e-postadress än. Med en adress kan du få ett nytt lösenord om du glömmer det.");
    box.appendChild(status);
    const form = makeElement("form", "sub-email");
    const input = document.createElement("input");
    input.type = "email";
    input.name = "email";
    input.required = true;
    input.autocomplete = "email";
    input.maxLength = 120;
    input.placeholder = u.email ? "Ny e-postadress" : "E-postadress";
    input.setAttribute("aria-label", input.placeholder);
    form.appendChild(input);
    let password = null;
    if (u.email) {
      password = document.createElement("input");
      password.type = "password";
      password.name = "password";
      password.required = true;
      password.autocomplete = "current-password";
      password.placeholder = "Ditt lösenord";
      password.setAttribute("aria-label", "Ditt lösenord, för att byta adress");
      form.appendChild(password);
    }
    const save = makeElement("button", "secondary-button", u.email ? "Byt adress" : "Spara adress");
    save.type = "submit";
    const msg = makeElement("p", "sub-msg");
    msg.setAttribute("role", "status");
    form.append(save);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      msg.className = "sub-msg";
      try {
        const r = await api.post("/api/me/email", { email: input.value, password: password ? password.value : undefined });
        msg.className = "sub-msg is-ok";
        msg.textContent = r.sent ? "Vi har skickat ett mejl till adressen. Öppna länken i det för att bekräfta." : "Adressen är sparad, men vi kunde inte skicka mejlet just nu. Försök igen om en stund.";
        status.textContent = input.value.toLowerCase() + " · inte bekräftad än";
        u.email = input.value.toLowerCase(); u.emailVerified = false;
      } catch (err) { msg.className = "sub-msg is-error"; msg.textContent = err.message; }
    });
    box.appendChild(form);
    if (u.email && !u.emailVerified) {
      const again = makeElement("button", "pv-link", "Skicka bekräftelsen igen");
      again.type = "button";
      again.addEventListener("click", function () {
        api.post("/api/me/email/resend", {}).then(function () { msg.className = "sub-msg is-ok"; msg.textContent = "Vi har skickat ett nytt mejl."; })
          .catch(function (err) { msg.className = "sub-msg is-error"; msg.textContent = err.message; });
      });
      box.appendChild(again);
    }
    box.appendChild(msg);
    return box;
  }

  // ----- "Mitt konto": the subscription -----
  function subscriptionSection(u, API) {
    if (!isFamilyOwner(u)) return null;
    api = api || API;
    const box = makeElement("div", "account-form sub-section");
    box.appendChild(makeElement("h4", "", "Prenumeration"));
    const text = makeElement("p", "account-note", describe(u.access) || "Gratis just nu.");
    const message = makeElement("p", "sub-msg");
    message.setAttribute("role", "status");
    box.appendChild(text);
    const more = makeElement("div", "sub-more");
    box.append(more, message);
    api.get("/api/billing").then(function (status) {
      text.textContent = describe(status.access) || "Gratis just nu.";
      if (!status.billing) { more.appendChild(makeElement("p", "account-note", "Tjänsten är gratis just nu. Du får besked innan det ändras.")); return; }
      const needs = status.access.state === "expired" || status.access.plan === "trial" || (status.access.plan === "free" && status.access.until);
      if (needs && status.checkout && (status.plans || []).length) more.appendChild(plansBlock(status, message));
      if (status.manage) {
        const manage = makeElement("button", "secondary-button", "Hantera prenumerationen (betalning, kvitton, avsluta)");
        manage.type = "button";
        manage.addEventListener("click", async function () {
          manage.disabled = true;
          try { const r = await api.post("/api/billing/portal", {}); window.location.href = r.url; }
          catch (err) { message.className = "sub-msg is-error"; message.textContent = err.message; manage.disabled = false; }
        });
        more.appendChild(manage);
      }
      if (needs || status.access.plan === "free") more.appendChild(codeBlock(message, function (access) { text.textContent = describe(access); }));
      const again = makeElement("button", "pv-link", "Har du precis betalat? Kolla igen");
      again.type = "button";
      again.addEventListener("click", function () {
        api.get("/api/billing").then(function (s2) { text.textContent = describe(s2.access); if (s2.access.state === "active") window.location.reload(); });
      });
      more.appendChild(again);
    }).catch(function () { /* the sentence above stays */ });
    return box;
  }

  return { start: start, expired: expired, emailSection: emailSection, subscriptionSection: subscriptionSection, describe: describe };
}());
