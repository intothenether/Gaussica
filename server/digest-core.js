"use strict";
// The weekly summary that a caregiver can ask for by e-mail: what each child did in the last seven days, in a few plain sentences. The pure part, so that the
// Node server (server/account.js) and the worker (cloudflare/worker.js) say the same thing; the block between BEGIN and END is copied into worker.js as it is
// (tests/digest-core.js checks that it is the same).
//
//   digestWeek(attempts, now)          attempts: [{ at (ISO), completed, seconds, lessonTitle }] -> { answers, right, days, minutes, lessons }
//   digestMail({ guardian, siteUrl, children: [{ name, attempts }], now })   -> { subject, text }

// BEGIN digest-core
const DIGEST_DAY = 86400000;
const DIGEST_CAP_SECONDS = 300;   // seconds counted for one answer at the most, so that a tab left open does not count as time spent

function digestWeek(attempts, now) {
  const since = now - 7 * DIGEST_DAY;
  const days = new Set();
  let answers = 0, right = 0, seconds = 0;
  const lessons = [];
  (attempts || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).forEach(function (a) {
    const t = Date.parse(a.at);
    if (!(t >= since && t <= now + DIGEST_DAY)) return;
    answers += 1;
    if (a.completed) right += 1;
    seconds += Math.min(DIGEST_CAP_SECONDS, Math.max(0, Number(a.seconds) || 0));
    days.add(String(a.at).slice(0, 10));
    if (a.lessonTitle && lessons.indexOf(a.lessonTitle) < 0) lessons.push(a.lessonTitle);
  });
  return { answers: answers, right: right, days: days.size, minutes: Math.round(seconds / 60), lessons: lessons };
}

function digestMail(o) {
  const first = function (name) { return String(name || "").trim().split(/\s+/)[0] || "barnet"; };
  const lines = (o.children || []).map(function (c) {
    const w = digestWeek(c.attempts, o.now);
    const who = first(c.name);
    if (!w.answers) return who + ": inget har gjorts de senaste sju dagarna.";
    return who + ": övade " + (w.days === 1 ? "en dag" : w.days + " dagar") + (w.minutes ? ", ungefär " + w.minutes + " minuter" : "") + ". " + w.right + " av " + w.answers + " svar var rätt."
      + (w.lessons.length ? " Jobbade med: " + w.lessons.slice(0, 3).join(", ") + (w.lessons.length > 3 ? " med flera" : "") + "." : "");
  });
  return {
    subject: "Veckan på Gaussica",
    text: "Hej " + first(o.guardian) + "!\n\nSå här gick det på Gaussica de senaste sju dagarna.\n\n" + lines.join("\n") + "\n\nÖppna Gaussica för att se mer: " + o.siteUrl +
      "\n\nDu får det här mejlet eftersom du har bett om en veckosammanfattning. Du stänger av den under Mitt konto." + "\n\nHälsningar\nGaussica"
  };
}
// END digest-core

module.exports = { digestWeek, digestMail };
