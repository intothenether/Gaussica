// Working without a connection: registers the service worker (sw.js) and shows a small note while the browser is offline.
//
//   GaussicaOffline.isOffline()   true while the browser says there is no connection
//   GaussicaOffline.onOnline(fn)  fn runs when the connection comes back
//
// Answers given while offline are kept in the browser and sent later (see the outbox in app.js).

window.GaussicaOffline = (function () {
  "use strict";

  const listeners = [];
  let note = null;

  function isOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }

  function show() {
    if (!note) {
      note = document.createElement("div");
      note.className = "offline-note";
      note.setAttribute("role", "status");
      note.textContent = "Du är offline. Du kan fortsätta räkna, svaren sparas här och skickas när du är online igen.";
      document.body.appendChild(note);
    }
    note.hidden = false;
    document.documentElement.classList.add("is-offline");
  }

  function hide() {
    if (note) note.hidden = true;
    document.documentElement.classList.remove("is-offline");
  }

  window.addEventListener("offline", show);
  window.addEventListener("online", function () {
    hide();
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.warn(e); } });
  });
  if (isOffline()) show();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (e) { console.warn("Kunde inte starta offlineläget:", e); });
    });
  }

  return { isOffline: isOffline, onOnline: function (fn) { listeners.push(fn); } };
}());
