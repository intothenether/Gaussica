const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync("./interactive-lesson-editor-v2.js", "utf8");

try {
  new vm.Script(code);
  console.log("✓ No syntax errors found!");
} catch (err) {
  console.error("❌ Syntax error:", err.message);
  console.error("At line:", err.stack.split("\n")[1]);
  process.exit(1);
}
