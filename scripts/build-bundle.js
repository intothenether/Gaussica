"use strict";
// Gathers lessons/index.json and every lesson file it lists into one file, lessons/bundle.json, so the site loads
// the course in one request instead of one per lesson. The deploy workflow runs this; the file is not committed.
// The page falls back to the single files when there is no bundle (and the local server never serves it).
//
//   node scripts/build-bundle.js        writes lessons/bundle.json
//   require(...).bundle(root)           the bundle as an object { manifest, lessons: [lesson, ...] } in index order

const fs = require("fs");
const path = require("path");

function bundle(root) {
  const dir = path.join(root, "lessons");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  const lessons = manifest.lessons.map(function (file) { return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); });
  return { manifest: manifest, lessons: lessons };
}

module.exports = { bundle: bundle };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const out = path.join(root, "lessons", "bundle.json");
  const b = bundle(root);
  fs.writeFileSync(out, JSON.stringify(b));
  console.log("lessons/bundle.json: " + b.lessons.length + " lessons, " + Math.round(fs.statSync(out).size / 1024) + " kB");
}
