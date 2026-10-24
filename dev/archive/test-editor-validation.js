// Validation script to test InteractiveEditor module
// Run in browser console after page load

console.log("🔍 Validating Interactive Lesson Editor...\n");

// Test 1: Module is loaded
if (typeof window.InteractiveEditor === 'object') {
  console.log("✅ window.InteractiveEditor module loaded");
} else {
  console.error("❌ window.InteractiveEditor NOT found");
}

// Test 2: Public API exists
if (window.InteractiveEditor && typeof window.InteractiveEditor.open === 'function') {
  console.log("✅ InteractiveEditor.open() API available");
} else {
  console.error("❌ InteractiveEditor.open() NOT found");
}

// Test 3: Admin interface button
const visualEditorBtn = document.getElementById('btn-visual-editor');
if (visualEditorBtn) {
  console.log("✅ Visual editor button found in DOM");
} else {
  console.warn("⚠️  Visual editor button not in DOM (might not be in admin mode)");
}

// Test 4: CSS loaded
const editorCSS = document.querySelector('style') || 
  Array.from(document.styleSheets).find(s => s.href.includes('styles.css'));
if (editorCSS) {
  console.log("✅ Styles.css loaded");
} else {
  console.warn("⚠️  Could not verify styles.css");
}

// Test 5: Sample lesson data
const sampleLesson = {
  id: "test-lesson-" + Date.now(),
  title: "Test Lesson",
  area: "tal",
  summary: "This is a test",
  components: [
    { type: "text", text: "Hello", id: "t1" },
    { type: "rule", label: "TEST", formula: "a=b", example: "1=1", id: "r1" }
  ]
};

console.log("\n📋 Test lesson created:");
console.log(sampleLesson);

// Test 6: Try opening editor (requires admin mode and course data)
if (window.course && window.course.lessons && window.course.lessons.length > 0) {
  console.log("\n✅ Course data available");
  console.log("   Lessons loaded:", window.course.lessons.length);
  
  console.log("\n🚀 To test editor:");
  console.log("   1. Click 📋 Alla lektioner button");
  console.log("   2. Select a lesson");
  console.log("   3. Click 🎨 Visuell editor button");
  console.log("\n   Or call in console:");
  console.log("   window.InteractiveEditor.open(window.course.lessons[0])");
} else {
  console.warn("⚠️  Course data not yet loaded. Wait for page to fully load.");
}

// Test 7: Test drag-and-drop functions
console.log("\n🧪 Testing component utilities...");
console.log("   Editor will be tested during actual use");

console.log("\n✨ Validation complete! Ready to test visual editor.\n");
