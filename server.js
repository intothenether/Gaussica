"use strict";
// Gaussica – server: static site + JSON API + SQLite storage.
//
//   node server.js                 start on http://127.0.0.1:8000
//   node server.js --teacher-code  print the code teachers need to register
//
// Environment: PORT (8000), HOST (127.0.0.1; use 0.0.0.0 to serve a network),
// DATA_DIR (./data), TEACHER_CODE (overrides the generated code),
// COOKIE_SECURE=1 (set when served over https, e.g. behind a proxy).

const http = require("http");
const fs = require("fs");
const path = require("path");
const { open } = require("./server/db");
const { createApi } = require("./server/api");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));

const db = open(path.join(DATA_DIR, "gaussica.db"));
const hadCode = Boolean(db.prepare("SELECT 1 FROM settings WHERE key = 'teacher_code'").get()) || Boolean(process.env.TEACHER_CODE);
const api = createApi(db, {
  secureCookie: process.env.COOKIE_SECURE === "1"
});
const teacherCode = api.teacherCode();

if (process.argv.includes("--teacher-code")) {
  console.log(teacherCode);
  process.exit(0);
}

// ----- static files: only what the page needs -----
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".md": "text/markdown; charset=utf-8"
};

// Everything index.html loads, plus the lessons folder and README. Server code and data are never served.
function publicFiles() {
  // sw.js and the icons are named in a script and in the manifest, not in the page itself
  const files = new Set(["/index.html", "/README.md", "/sw.js", "/icon-192.png", "/icon-512.png"]);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const re = /(?:src|href)="\.\/([^"#?]+)"/g;
  let m;
  while ((m = re.exec(html))) files.add("/" + m[1]);
  return files;
}
// Re-read whenever index.html changes, so adding a <script> to the page needs no server restart.
let PUBLIC = publicFiles();
let publicStamp = fs.statSync(path.join(ROOT, "index.html")).mtimeMs;
function currentPublic() {
  const stamp = fs.statSync(path.join(ROOT, "index.html")).mtimeMs;
  if (stamp !== publicStamp) { PUBLIC = publicFiles(); publicStamp = stamp; }
  return PUBLIC;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";
  // lessons/bundle.json is made for the deployed site; here the page reads the single files, which are always current
  const isLesson = /^\/lessons\/[^/]+\.json$/.test(rel) && rel !== "/lessons/bundle.json";
  if (!currentPublic().has(rel) && !isLesson) return notFound(res);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return notFound(res);
  fs.readFile(file, function (err, data) {
    if (err) return notFound(res);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
}

// config.js may point the page at the shared Cloudflare API; the page then needs permission to call it.
function apiOrigin() {
  try {
    const m = /apiBase:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"));
    return m ? new URL(m[1]).origin : "";
  } catch (e) { return ""; }
}

const server = http.createServer(function (req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob:; connect-src 'self' " + apiOrigin() + "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

  let url;
  try {
    url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  } catch (e) {
    res.writeHead(400);
    return res.end();
  }
  if (url.pathname.startsWith("/api/")) {
    api.handle(req, res, url);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  try {
    serveStatic(req, res, url.pathname);
  } catch (e) {
    notFound(res);
  }
});

server.listen(PORT, HOST, function () {
  console.log("Server igång på http://" + (HOST === "0.0.0.0" ? "localhost" : HOST) + ":" + PORT + "/");
  console.log("Databas: " + path.join(DATA_DIR, "gaussica.db"));
  if (!hadCode) {
    console.log("");
    console.log("Lärarkod (behövs när en lärare skapar konto): " + teacherCode);
    console.log("Visa den igen med: node server.js --teacher-code");
  }
});

function shutdown() {
  server.close(function () { db.close(); process.exit(0); });
  setTimeout(function () { process.exit(0); }, 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
