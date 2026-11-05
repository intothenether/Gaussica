"use strict";
// The rules for access (free, trial, paid) and what a Paddle webhook changes, and that the copy in the worker is the same code.
const fs = require("fs");
const path = require("path");
const { accessOf, paddleChange } = require("../server/billing-core.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const DAY = 86400000;
const NOW = Date.parse("2026-12-01T12:00:00Z");
const at = (days) => new Date(NOW + days * DAY).toISOString();
const A = (ent, billing) => accessOf(ent, { billing: billing !== false, now: NOW });

// while the site charges nobody, everybody is in
ok(A({ plan: "trial", trial_ends_at: at(-30) }, false).state === "active" && A(null, false).state === "active", "billing off: everyone has access, even a trial that ended");
// free accounts
ok(A({ plan: "free", free_reason: "founder" }).state === "active" && A({ plan: "free", free_reason: "founder" }).reason === "founder", "a free account is in, with its reason");
ok(A({ plan: "free", free_until: at(10) }).daysLeft === 10 && A({ plan: "free", free_until: at(-1) }).state === "expired", "a free access that ends is in until then");
// trial
ok(A({ plan: "trial", trial_ends_at: at(13.2) }).state === "active" && A({ plan: "trial", trial_ends_at: at(13.2) }).daysLeft === 14, "a trial counts the days left, rounded up");
ok(A({ plan: "trial", trial_ends_at: at(-0.1) }).state === "expired" && A({ plan: "trial" }).state === "expired", "a trial that ended (or has no end) is over");
// paid
ok(A({ plan: "paid", status: "active", period_end: at(20) }).state === "active", "a paid subscription is in");
ok(A({ plan: "paid", status: "active", period_end: at(-3) }).state === "active" && A({ plan: "paid", status: "active", period_end: at(-8) }).state === "expired", "a week of grace if the renewal or the webhook is late");
ok(A({ plan: "paid", status: "past_due", period_end: at(-2) }).state === "active", "a payment that failed does not lock a family out at once");
const gone = A({ plan: "paid", status: "canceled", period_end: at(5) });
ok(gone.state === "active" && gone.cancelAtPeriodEnd === true && gone.daysLeft === 5, "a cancelled subscription is in until the end of what is paid");
ok(A({ plan: "paid", status: "canceled", period_end: at(-1) }).state === "expired" && A({ plan: "paid", status: "paused", period_end: at(5) }).state === "expired" && A({ plan: "paid" }).state === "expired", "cancelled and ended, paused, or nothing known: out");

// the webhooks of Paddle
const sub = (type, data) => ({ event_type: type, event_id: "evt_1", data: Object.assign({ id: "sub_1", customer_id: "ctm_1", status: "active", custom_data: { user_id: "42" }, current_billing_period: { ends_at: "2027-01-01T00:00:00Z" } }, data) });
let c = paddleChange(sub("subscription.created"));
ok(c && c.userId === 42 && c.status === "active" && c.customerId === "ctm_1" && c.subscriptionId === "sub_1" && c.periodEnd === "2027-01-01T00:00:00.000Z" && !c.cancelAtPeriodEnd, "a new subscription: who, the ids, the status and the end of the period");
ok(paddleChange(sub("subscription.updated", { scheduled_change: { action: "cancel", effective_at: "2027-01-01T00:00:00Z" } })).cancelAtPeriodEnd === true, "a cancel that is scheduled is told");
c = paddleChange(sub("subscription.canceled", { status: "canceled", canceled_at: "2026-12-20T10:00:00Z" }));
ok(c.status === "canceled" && c.periodEnd === "2026-12-20T10:00:00.000Z", "a cancelled subscription ends when it was cancelled");
ok(paddleChange({ event_type: "transaction.completed", data: { custom_data: { user_id: "42" } } }) === null, "other events are not about the subscription");
ok(paddleChange(sub("subscription.created", { custom_data: {} })) === null && paddleChange(sub("subscription.created", { custom_data: { user_id: "abc" } })) === null && paddleChange(null) === null, "without one of our users, nothing changes");

// the copy in the worker
const core = fs.readFileSync(path.join(__dirname, "..", "server", "billing-core.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "..", "cloudflare", "worker.js"), "utf8");
const cut = (text) => { const a = text.indexOf("// BEGIN billing-core"), b = text.indexOf("// END billing-core"); return a >= 0 && b > a ? text.slice(a, b).replace(/\r\n/g, "\n") : null; };
ok(cut(core) !== null && cut(worker) !== null && cut(core) === cut(worker), "cloudflare/worker.js has the same billing rules as server/billing-core.js (copy the block between BEGIN and END)");

// the script of the person who runs the site
const admin = require("../scripts/admin.js");
const pa = admin.parseArgs(["grant", "maria", "--reason", "vän", "--days", "30", "--api", "https://x.example"]);
ok(pa.command === "grant" && pa.username === "maria" && pa.flags.reason === "vän" && pa.flags.api === "https://x.example", "admin.js reads a command, a user name and flags");
const rq = admin.request(pa);
ok(rq.path === "/api/admin/access" && rq.body.action === "grant" && rq.body.days === 30 && rq.body.reason === "vän", "and asks the site to give free access for 30 days");
ok(admin.request(admin.parseArgs(["revoke"])).error && admin.request(admin.parseArgs(["nonsense"])).error, "a command without a user name, or one that does not exist, is told so");
ok(admin.request(admin.parseArgs(["code", "--uses", "5"])).body.uses === 5 && admin.request(admin.parseArgs(["code"])).path === "/api/admin/codes", "and asks for a code");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All billing rule checks passed");
