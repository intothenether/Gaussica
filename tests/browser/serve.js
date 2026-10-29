"use strict";
// A plain static server for the browser tests (like GitHub Pages: no /api), always in the demo mode.
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.PORT) || 8126;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  if (p === "/config.js") {   // never the real database
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end('window.GAUSSICA_CONFIG = { apiBase: "", contact: "test@example.se" };');
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || /[\/](data|node_modules|\.git)[\/]/.test(f) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("browser tests: static on " + PORT));
