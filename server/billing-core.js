"use strict";
// The rules for who may use the site: a free account, a trial, or a paid subscription. Pure functions, so that the Node server, the Cloudflare worker
// and the tests all use the same rules. The part between BEGIN and END is copied into cloudflare/worker.js (the worker is one file), and
// tests/billing-core.js checks that the copy is the same.
//
// An entitlement belongs to a caregiver (a home family) and has: plan ("free", "trial", "paid"), free_reason, free_until (a free access that ends),
// trial_ends_at, status (what Paddle says: active, trialing, past_due, paused, canceled), period_end and cancel_at_period_end.
// The children of the family use the family's access. Teachers (schools) are not asked to pay.

// BEGIN billing-core
const BILLING_GRACE_DAYS = 7;       // a payment that is late or a webhook that is missed does not lock a family out at once
const BILLING_DAY_MS = 86400000;

function billingMs(v) {
  const t = typeof v === "number" ? v : Date.parse(v || "");
  return Number.isFinite(t) ? t : null;
}

function billingIso(ms) { return ms === null || ms === undefined ? null : new Date(ms).toISOString(); }

// { state: "active" | "expired", plan, reason, until, daysLeft, cancelAtPeriodEnd, billing }
function accessOf(ent, opts) {
  opts = opts || {};
  const now = billingMs(opts.now) === null ? Date.now() : billingMs(opts.now);
  const out = (state, plan, extra) => Object.assign({ state: state, plan: plan, reason: null, until: null, daysLeft: null, cancelAtPeriodEnd: false, billing: Boolean(opts.billing) }, extra || {});
  const left = (until) => (until === null ? null : Math.max(0, Math.ceil((until - now) / BILLING_DAY_MS)));
  if (!ent) return out("active", "free", { reason: "ingen" });
  // while the site is not charging anyone, everybody is in
  if (!opts.billing) return out("active", ent.plan || "free", { reason: ent.free_reason || "beta", until: billingIso(billingMs(ent.free_until)) });
  if (ent.plan === "free") {
    const until = billingMs(ent.free_until);
    if (until !== null && until <= now) return out("expired", "free", { reason: ent.free_reason || null, until: billingIso(until), daysLeft: 0 });
    return out("active", "free", { reason: ent.free_reason || "gratis", until: billingIso(until), daysLeft: left(until) });
  }
  if (ent.plan === "trial") {
    const until = billingMs(ent.trial_ends_at);
    if (until === null || until <= now) return out("expired", "trial", { until: billingIso(until), daysLeft: 0 });
    return out("active", "trial", { until: billingIso(until), daysLeft: left(until) });
  }
  // paid
  const end = billingMs(ent.period_end);
  const cancel = Boolean(ent.cancel_at_period_end);
  const status = String(ent.status || "");
  if (status === "canceled") {
    if (end !== null && end > now) return out("active", "paid", { until: billingIso(end), daysLeft: left(end), cancelAtPeriodEnd: true });
    return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
  }
  if (status === "active" || status === "trialing" || status === "past_due") {
    const lastDay = end === null ? null : end + BILLING_GRACE_DAYS * BILLING_DAY_MS;
    if (lastDay !== null && lastDay <= now) return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
    return out("active", "paid", { until: billingIso(end), daysLeft: left(end), cancelAtPeriodEnd: cancel });
  }
  return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
}

// What a Paddle webhook says about a subscription, as a change to the entitlement: { userId, customerId, subscriptionId, status, periodEnd,
// cancelAtPeriodEnd } or null for events that are not about a subscription of one of our users. custom_data.user_id is set when the checkout is made.
function paddleChange(event) {
  const type = event && typeof event.event_type === "string" ? event.event_type : "";
  const d = event && event.data;
  if (!/^subscription\./.test(type) || !d || typeof d !== "object") return null;
  const userId = Number(d.custom_data && d.custom_data.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const status = String(d.status || "");
  const period = d.current_billing_period && d.current_billing_period.ends_at;
  const cancel = Boolean(d.scheduled_change && d.scheduled_change.action === "cancel");
  let periodEnd = billingIso(billingMs(period));
  if (status === "canceled") periodEnd = billingIso(billingMs(d.canceled_at) === null ? billingMs(period) : billingMs(d.canceled_at));
  return { userId: userId, customerId: d.customer_id ? String(d.customer_id) : null, subscriptionId: d.id ? String(d.id) : null, status: status, periodEnd: periodEnd, cancelAtPeriodEnd: cancel };
}
// END billing-core

module.exports = { accessOf, paddleChange, BILLING_GRACE_DAYS };
