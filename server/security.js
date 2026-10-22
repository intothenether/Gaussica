"use strict";
// Password hashing, session tokens and a small in-memory rate limiter.

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// A real hash of a random password, used so unknown usernames cost the same time as wrong passwords.
let dummyHash = null;
async function dummyVerify(password) {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(12).toString("hex"));
  await verifyPassword(password, dummyHash);
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Codes without look-alike characters (no 0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(length) {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function normalizeCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Sliding-window limiter: allows `max` hits per `windowMs` for a key.
function createLimiter(max, windowMs) {
  const hits = new Map();
  return {
    // Returns seconds to wait when over the limit, otherwise 0. Counts the hit.
    check: function (key) {
      const now = Date.now();
      const list = (hits.get(key) || []).filter(function (t) { return now - t < windowMs; });
      if (list.length >= max) {
        hits.set(key, list);
        return Math.ceil((windowMs - (now - list[0])) / 1000);
      }
      list.push(now);
      hits.set(key, list);
      return 0;
    },
    reset: function (key) { hits.delete(key); },
    sweep: function () {
      const now = Date.now();
      hits.forEach(function (list, key) {
        const fresh = list.filter(function (t) { return now - t < windowMs; });
        if (fresh.length) hits.set(key, fresh); else hits.delete(key);
      });
    }
  };
}

module.exports = { hashPassword, verifyPassword, dummyVerify, newToken, hashToken, randomCode, normalizeCode, safeEqual, createLimiter };
