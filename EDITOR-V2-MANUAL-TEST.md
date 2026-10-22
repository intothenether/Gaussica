# Full Lesson Editor V2 - Manual Testing Instructions

## Quick Start Testing (2-3 minutes)

### 1. Open Page
- Go to http://localhost:8000
- You should see the Gaussica homepage

### 2. Activate Teacher Mode
- Click "Lärarvy 📊" link in top right
- Type `lärarläge` when prompted
- Page reloads
- Green admin toolbar should appear at top with buttons:
  - ➕ Ny lektion
  - 🎨 Visuell editor
  - ✏️ Redigera
  - 📋 Alla lektioner
  - 💾 Exportera
  - 🔒 Stäng lärarläge

### 3. Select a Lesson
- Click on any lesson card (e.g., "Addition")
- The lesson should load

### 4. Open the New Editor
- In the admin toolbar, click "🎨 Visuell editor"
- **EXPECTED**: A large modal opens showing:
  - Header: "Redigera lektion: Addition"
  - Left side (narrower): Editor pane with metadata and blocks
  - Right side (wider): Live preview
  - Top: "💾 Spara" and "✕ Avbryt" buttons

---

## Detailed Feature Testing

### Test A: Metadata Editing
**Objective**: Verify metadata fields update the preview

1. In the editor left pane, find the metadata section at top
2. Locate these input fields:
   - Titel
   - Område
   - Nivå
   - Längd
   - Sammanfattning

3. **Test**: Change the title field
   - Type a new title
   - Press Tab or click elsewhere
   - **EXPECTED**: Preview on right updates immediately with new title

4. **Test**: Change summary
   - Clear and type new summary
   - **EXPECTED**: Summary appears in preview with special styling

### Test B: Viewing Existing Content Blocks
**Objective**: Verify all lesson content is rendered as blocks

1. Scroll down in left pane to "📦 Lektionsinnehål" section
2. **EXPECTED**: You should see block cards for:
   - 🎨 Visuell förklaring (if lesson has visual content)
   - 📝 Textförklaring (if lesson has explanation)
   - 📐 Regel/Formel (if lesson has rule)
   - ✏️ Övning (if lesson has exercise)
   - 📖 Textuppgifter (if lesson has word problems)

3. Each block card should show:
   - Icon and type name
   - Two buttons: "✎ Redigera" and "🗑️"
   - Preview text of content

4. In right pane preview, **EXPECTED**:
   - All these blocks render with student-facing appearance
   - Diagrams show actual visualizations (if any)
   - Rules show with special styling
   - Exercises show prompt and expected answer

### Test C: Selecting and Editing a Block
**Objective**: Verify block selection and editing works

1. In left pane, click on a block card (any one)
   - **EXPECTED**: Block card turns blue/highlighted

2. Scroll down in left pane
   - **EXPECTED**: An "✎ Redigera: [Block Type]" section appears below the blocks list

3. Editing fields should match the block type:
   - **For Explanation**: Title and text field
   - **For Rule**: Rule label and rule content
   - **For Exercise**: Prompt, answers, feedback
   - **For Visual/Diagram**: Title, type selector, JSON data editor

4. **Test**: Change a value (e.g., rule text)
   - Type something new
   - Click elsewhere or press Tab
   - **EXPECTED**: 
     - Right pane preview updates immediately
     - Changes are reflected in the block card preview

### Test D: Adding a New Block
**Objective**: Verify new blocks can be added

1. In left pane, find the "+ Lägg till block" button
2. Click it
   - **EXPECTED**: Menu appears with all block types:
     - 🎨 Visuell förklaring
     - 📝 Textförklaring
     - 📐 Regel/Formel
     - 📊 Diagram
     - 🎚️ Interaktiv skjutreglage
     - 📈 Funktionsgraf
     - ❓ Uppgift
     - 🔄 Uppgiftsmönster
     - ✏️ Övning
     - 📖 Textuppgifter

3. Click on "📝 Textförklaring" (Text Explanation)
   - **EXPECTED**: Menu closes, new block appears in canvas
   - New block is automatically selected
   - Edit panel shows below with default content

4. In edit panel, change the text:
   - Add title and explanation
   - **EXPECTED**: New text appears in right pane preview

### Test E: Deleting a Block
**Objective**: Verify blocks can be deleted

1. In left pane, find a block card
2. Click the "🗑️" button on that block
   - **EXPECTED**: Confirmation dialog appears: "Ta bort [Block Type]?"
3. Click "OK"
   - **EXPECTED**: Block disappears from canvas and preview

### Test F: Save and Reload
**Objective**: Verify changes persist after saving

1. Make a small change (e.g., change title or add text block)
2. Click "💾 Spara" button at top
   - **EXPECTED**: Alert: "Lektion sparad!"
   - Editor closes automatically

3. Reload the page (Ctrl+R or Cmd+R)
4. Select the same lesson again and open editor
   - **EXPECTED**: Your changes are still there!

### Test G: Diagram Block Editing
**Objective**: Verify diagram components work

1. Click "+ Lägg till block"
2. Select "📊 Diagram"
3. New diagram block added
4. Scroll to edit panel below
5. You should see:
   - Diagram titel field
   - Diagram typ dropdown (stapeldiagram, cirkeldiagram)
   - Data (JSON) textarea
6. In JSON field, enter:
   ```
   [
     {"label": "Test", "value": 100},
     {"label": "Value", "value": 200}
   ]
   ```
7. **EXPECTED**: 
   - Diagram appears in right preview
   - Shows actual chart with your data
   - If you change data, chart updates live

---

## Browser Console Testing

If you want automated tests, open browser console (F12) and run:

```javascript
// Load the test suite
fetch('./test-editor-v2.js').then(r => r.text()).then(t => {
  eval(t);
  window.testEditorV2.run();
});
```

This will run 12 automated tests and show results.

---

## Troubleshooting

### Editor doesn't open
- Check browser console (F12 → Console tab) for errors
- Verify admin mode is on (green bar should be visible)
- Try hard refresh (Ctrl+Shift+R)

### Preview doesn't update
- Check that you're editing in the left pane
- Click Tab or elsewhere to trigger change event
- Try scrolling right pane to see if content is there

### Blocks don't appear
- Scroll down in left pane to see blocks section
- Click on a block to select it
- Try adding a new block with "+ Lägg till block"

### Save doesn't work
- Check browser console for errors
- Make sure you've made a change
- Try closing editor and reopening

---

## Success Criteria ✓

The editor is working correctly if:

1. ✓ Opens without errors
2. ✓ Shows metadata fields that update preview
3. ✓ Displays all lesson content as editable blocks
4. ✓ Can add new blocks
5. ✓ Can edit block content (text appears in preview)
6. ✓ Can delete blocks
7. ✓ Can save and changes persist after reload
8. ✓ Diagrams render with actual data
9. ✓ Preview is live and updates immediately
10. ✓ No JavaScript errors in console

---

## Video Test Workflow (if recording)

1. Activate teacher mode
2. Open existing lesson
3. Click visual editor
4. Change title (show preview update)
5. Add new text block (show menu, add block, edit it)
6. Add diagram with data (show data format, preview chart)
7. Save lesson
8. Reload page
9. Verify changes persisted
10. Show final preview with all content

This demonstrates all key features in ~2 minutes.
