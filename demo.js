// The trial for a parent: index.html#prova opens Gaussica without an account. A family and a child ("Maja") are made in this browser only (local-backend.js,
// startDemo), nothing is sent anywhere, and the visitor starts as the child, so that they see what the child sees. "Tillbaka till mina barn" shows what a
// parent sees, with a week of a child that has done a few things. A bar at the top says that it is a trial.
//
//   GaussicaDemo.start()   draws the bar when the trial is on (called by app.js when the page has started)

window.GaussicaDemo = (function () {
  "use strict";

  const active = () => Boolean(window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active);

  function leave(to) {
    try { window.sessionStorage.removeItem("gaussica.demo"); window.sessionStorage.removeItem("gaussica.preview"); } catch (e) { /* storage blocked */ }
    window.location.href = to;
    window.location.reload();
  }

  function start() {
    if (!active() || document.getElementById("demo-bar")) return;
    const bar = document.createElement("div");
    bar.id = "demo-bar";
    bar.className = "demo-bar";
    bar.setAttribute("role", "note");
    const text = document.createElement("span");
    text.className = "demo-bar-text";
    text.textContent = "Du provar Gaussica. Det du gör sparas bara i den här webbläsaren, och inget skickas någonstans.";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "demo-bar-btn";
    again.textContent = "Börja om";
    again.addEventListener("click", function () {
      window.GaussicaLocal.demo.reset();
      try { window.sessionStorage.removeItem("gaussica.preview"); } catch (e) { /* storage blocked */ }
      window.location.href = "./index.html#prova";
      window.location.reload();
    });
    const make = document.createElement("button");
    make.type = "button";
    make.className = "demo-bar-btn is-main";
    make.textContent = "Skapa ett konto";
    make.addEventListener("click", function () { leave("./index.html#start"); });
    bar.append(text, again, make);
    // after the link past the menus, so that the first Tab still reaches that
    const skip = document.querySelector(".skip-link");
    if (skip && skip.parentNode === document.body) document.body.insertBefore(bar, skip.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  return { start: start, active: active };
}());
