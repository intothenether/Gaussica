// Test suite for Full Lesson Editor V2
// This runs in the browser console

window.testEditorV2 = (function() {
  let testsPassed = 0;
  let testsFailed = 0;
  
  const log = (msg, isPass = true) => {
    const emoji = isPass ? "✓" : "❌";
    const color = isPass ? "color: green" : "color: red";
    console.log(`%c${emoji} ${msg}`, color);
    if (isPass) testsPassed++;
    else testsFailed++;
  };
  
  return {
    run: function() {
      console.log("%c=== EDITOR V2 TEST SUITE ===", "font-weight: bold; font-size: 14px");
      
      // Test 1: Editor module exists
      try {
        if (window.InteractiveEditor && typeof window.InteractiveEditor.open === "function") {
          log("InteractiveEditor module loaded");
        } else {
          log("InteractiveEditor module not found", false);
          return;
        }
      } catch (err) {
        log("Error checking editor: " + err.message, false);
        return;
      }
      
      // Test 2: Create test lesson
      const testLesson = {
        id: "test-lesson-" + Date.now(),
        title: "Test: Addition",
        area: "tal",
        level: "Åk 3",
        duration: "5 min",
        summary: "Test lesson for editor",
        explanation: "Förklaring här",
        explanationTitle: "Förklaring",
        rule: "1 + 1 = 2",
        ruleLabel: "REGEL",
        exercise: {
          prompt: "Vad är 1 + 1?",
          answer: ["2"],
          correct: "Rätt!"
        },
        wordProblems: [
          {
            prompt: "Anna har 1 äpple. Hon får 1 till. Hur många har hon nu?",
            answer: ["2"],
            correct: "Rätt!"
          }
        ],
        visual: [
          {
            type: "diagram",
            diagramType: "stapeldiagram",
            diagramTitle: "Exempel diagram",
            diagramData: [
              { label: "A", value: 10 },
              { label: "B", value: 20 }
            ]
          }
        ],
        components: []
      };
      
      log("Test lesson created with all content types");
      
      // Test 3: Open editor
      try {
        window.InteractiveEditor.open(testLesson);
        log("Editor opened successfully");
      } catch (err) {
        log("Failed to open editor: " + err.message, false);
        return;
      }
      
      // Wait a bit for DOM to render
      setTimeout(() => {
        // Test 4: Check editor DOM exists
        const editor = document.querySelector("#interactive-editor-v2");
        if (editor) {
          log("Editor DOM element created");
        } else {
          log("Editor DOM element not found", false);
        }
        
        // Test 5: Check header
        const header = document.querySelector(".editor-header");
        if (header && header.textContent.includes("Redigera lektion")) {
          log("Editor header displays correctly");
        } else {
          log("Editor header not found", false);
        }
        
        // Test 6: Check left pane (editor pane)
        const editorPane = document.querySelector(".editor-pane");
        if (editorPane) {
          log("Editor pane (left side) renders");
          
          // Check for metadata section
          if (editorPane.textContent.includes("Lektionsmetadata")) {
            log("Metadata section present");
          } else {
            log("Metadata section missing", false);
          }
          
          // Check for blocks section
          if (editorPane.textContent.includes("Lektionsinnehål")) {
            log("Content blocks section present");
          } else {
            log("Content blocks section missing", false);
          }
        } else {
          log("Editor pane not found", false);
        }
        
        // Test 7: Check preview pane
        const previewPane = document.querySelector(".preview-pane");
        if (previewPane) {
          log("Preview pane (right side) renders");
          
          // Check that lesson content shows in preview
          if (previewPane.textContent.includes("Test: Addition")) {
            log("Lesson title appears in preview");
          } else {
            log("Lesson title missing from preview", false);
          }
        } else {
          log("Preview pane not found", false);
        }
        
        // Test 8: Check metadata fields
        const titleInput = editorPane.querySelector('input[value*="Test: Addition"]');
        if (titleInput) {
          log("Title field is editable");
        } else {
          log("Title field not found", false);
        }
        
        // Test 9: Check block cards in canvas
        const blockCards = editorPane.querySelectorAll(".block-card");
        if (blockCards.length > 0) {
          log(`Found ${blockCards.length} content blocks`);
        } else {
          log("No content blocks found", false);
        }
        
        // Test 10: Check add block button
        const addBtn = editorPane.querySelector(".btn-add-block");
        if (addBtn) {
          log("Add block button present");
        } else {
          log("Add block button not found", false);
        }
        
        // Test 11: Check save button
        const saveBtn = document.querySelector(".btn-primary");
        if (saveBtn && saveBtn.textContent.includes("Spara")) {
          log("Save button present");
        } else {
          log("Save button not found", false);
        }
        
        // Test 12: Try to click a block
        if (blockCards.length > 0) {
          try {
            blockCards[0].click();
            
            // Wait for edit section to appear
            setTimeout(() => {
              const editSection = document.querySelector(".editor-edit-section");
              if (editSection) {
                log("Block editing panel appears when block is selected");
              } else {
                log("Block editing panel did not appear", false);
              }
              
              // Print summary
              console.log(`\n%c=== TEST RESULTS ===\n%cPassed: ${testsPassed}\nFailed: ${testsFailed}`, 
                "font-weight: bold; font-size: 12px", 
                testsFailed === 0 ? "color: green; font-weight: bold" : "color: red; font-weight: bold");
              
              if (testsFailed === 0) {
                console.log("%c✓ ALL TESTS PASSED!", "color: green; font-weight: bold; font-size: 14px");
              }
            }, 500);
          } catch (err) {
            log("Error clicking block: " + err.message, false);
          }
        }
      }, 500);
    }
  };
})();

// Run tests
console.log("Starting tests in 2 seconds...");
setTimeout(() => {
  window.testEditorV2.run();
}, 2000);
