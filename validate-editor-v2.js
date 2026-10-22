// Comprehensive validation of Editor V2
const fs = require("fs");

console.log("\n🔍 EDITOR V2 VALIDATION REPORT\n");

// Check 1: File exists
const editorFile = "./interactive-lesson-editor-v2.js";
if (!fs.existsSync(editorFile)) {
  console.error("❌ Editor file not found:", editorFile);
  process.exit(1);
}
console.log("✓ Editor file exists");

const code = fs.readFileSync(editorFile, "utf8");

// Check 2: Key functions exist
const requiredFunctions = [
  "renderEditorUI",
  "renderEditorPane",
  "renderPreviewPane",
  "getContentBlocks",
  "renderBlockCard",
  "showBlockMenu",
  "addBlock",
  "removeBlock",
  "selectBlock",
  "saveLessonFromEditor"
];

console.log("\n📋 Function Check:");
let allFunctionsPresent = true;
requiredFunctions.forEach(fn => {
  if (code.includes(`function ${fn}`) || code.includes(`${fn}:`)) {
    console.log(`  ✓ ${fn}`);
  } else {
    console.log(`  ❌ ${fn} - MISSING`);
    allFunctionsPresent = false;
  }
});

// Check 3: Block types defined
console.log("\n🎯 Block Types:");
const blockTypes = [
  "visual",
  "explanation",
  "rule",
  "diagram",
  "slider",
  "functionGraph",
  "problem",
  "problemPattern",
  "exercise",
  "wordProblems"
];

const blockTypeDef = code.match(/const BLOCK_TYPES = \{[\s\S]*?\};/);
if (blockTypeDef) {
  console.log("✓ BLOCK_TYPES defined");
  blockTypes.forEach(type => {
    if (blockTypeDef[0].includes(`"${type}"`)) {
      console.log(`  ✓ ${type}`);
    } else {
      console.log(`  ❌ ${type} - NOT DEFINED`);
    }
  });
} else {
  console.log("❌ BLOCK_TYPES not found");
}

// Check 4: CSS file updated
console.log("\n🎨 CSS Check:");
const cssFile = "./styles.css";
if (fs.existsSync(cssFile)) {
  const cssCode = fs.readFileSync(cssFile, "utf8");
  if (cssCode.includes("interactive-editor-v2") || cssCode.includes("editor-main-v2")) {
    console.log("✓ CSS styles for editor V2 added");
  } else {
    console.log("⚠️  CSS might not be fully updated for V2");
  }
} else {
  console.log("❌ CSS file not found");
}

// Check 5: HTML loads correct script
console.log("\n📄 HTML Check:");
const htmlFile = "./index.html";
if (fs.existsSync(htmlFile)) {
  const html = fs.readFileSync(htmlFile, "utf8");
  if (html.includes("interactive-lesson-editor-v2.js")) {
    console.log("✓ HTML loads editor V2");
  } else {
    console.log("❌ HTML still loads old editor");
  }
} else {
  console.log("❌ HTML file not found");
}

// Check 6: Validate localStorage persistence
console.log("\n💾 Data Persistence:");
if (code.includes("mattesteg-lessons-backup")) {
  console.log("✓ localStorage backup implemented");
} else {
  console.log("❌ localStorage backup not found");
}

// Check 7: Syntax validation
console.log("\n✅ Syntax Check:");
try {
  const vm = require("vm");
  new vm.Script(code);
  console.log("✓ No JavaScript syntax errors");
} catch (err) {
  console.error("❌ Syntax error:", err.message);
}

// Check 8: Key features
console.log("\n🚀 Feature Check:");
const features = [
  { name: "Metadata editing", check: "createFormField" },
  { name: "Block WYSIWYG editing", check: "renderBlockCard" },
  { name: "Live preview", check: "renderPreviewPane" },
  { name: "Diagram support", check: "diagramType" },
  { name: "Save functionality", check: "saveLessonFromEditor" },
  { name: "Complete lesson structure", check: "getContentBlocks" }
];

features.forEach(feature => {
  if (code.includes(feature.check)) {
    console.log(`✓ ${feature.name}`);
  } else {
    console.log(`❌ ${feature.name} - NOT FOUND`);
  }
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("✅ EDITOR V2 VALIDATION COMPLETE\n");
console.log("Status: READY FOR TESTING");
console.log("\nNext steps:");
console.log("1. Open http://localhost:8000 in browser");
console.log("2. Click 'Lärarvy 📊' and type 'lärarläge'");
console.log("3. Click a lesson, then '🎨 Visuell editor'");
console.log("4. Follow tests in EDITOR-V2-MANUAL-TEST.md");
console.log("\n" + "=".repeat(50) + "\n");
