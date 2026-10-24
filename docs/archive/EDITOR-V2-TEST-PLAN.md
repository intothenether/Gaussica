# Full Lesson Editor V2 - Test Plan & Workflow

## What Changed
The visual editor has been completely redesigned to handle **full lesson editing**, not just custom components.

### Old vs New
- **Old**: Only edited `lesson.components` array (custom components only)
- **New**: Edits entire lesson including metadata, visual, explanation, rule, exercise, word problems, and custom components

## Architecture
- **interactive-lesson-editor-v2.js**: New complete lesson editor
- **Hybrid approach**:
  - Top: Metadata editing (title, area, level, duration, summary)
  - Middle: WYSIWYG block editor (add/edit/delete/reorder content blocks)
  - Right: Live preview showing how student sees it

## Test Workflow

### Setup
1. Open http://localhost:8000
2. Click "Lärarvy" at top → Enter "lärarläge" as password
3. You should see admin toolbar appear at top with buttons

### Test 1: Open Existing Lesson
1. Click on a lesson card (e.g., "Addition")
2. In admin toolbar, click "🎨 Visuell editor"
3. The full lesson editor should open with:
   - Left pane: Metadata fields + block canvas
   - Right pane: Live preview of the lesson

### Test 2: Edit Metadata
1. In editor, scroll to top of left pane
2. Change "Titel" field to something else
3. The preview on right should update immediately

### Test 3: Add a New Block
1. Click "+ Lägg till block" button
2. Menu appears with all block types
3. Click "Diagram" to add a diagram block
4. Block appears in the canvas

### Test 4: Edit a Block
1. Click a block in the canvas (should turn blue/selected)
2. Below the block list, an "✎ Redigera" section appears
3. Edit fields for that block type
4. Changes appear in preview immediately

### Test 5: Save and Reload
1. After making changes, click "💾 Spara"
2. Alert says "Lektion sparad!"
3. Reload the page
4. Select the lesson again in the graph
5. All your changes should be there

### Test 6: Create a Complete Lesson
1. Click "➕ Ny lektion" in toolbar
2. Edit metadata at top
3. Add blocks: Explanation, Rule, Exercise
4. Click save
5. The new lesson should appear in course

## Expected Behavior

### Metadata Fields
- Title, Area, Level, Duration, Summary
- All should update preview in real-time

### Block Types Supported
- **visual**: Diagrams (stapeldiagram, cirkeldiagram)
- **explanation**: Text explanations with title
- **rule**: Formulas/rules with label
- **exercise**: Single problem with prompt/answer
- **wordProblems**: List of text problems
- **component**: Custom components (advanced)

### Preview Updates
- Live as you type
- Shows how student will see it
- Diagram preview shows actual chart

## Known Limitations (v1)
- wordProblems editing is basic (show data but not full editor)
- Custom components editing placeholder
- No drag-to-reorder yet (will add in v2)

## Files Modified
- `interactive-lesson-editor-v2.js` - New complete editor
- `styles.css` - Added comprehensive editor styling
- `index.html` - Updated to load v2 editor
- `admin-interface.js` - Already has openVisualEditor() which calls InteractiveEditor.open()

## Next Steps After Testing
1. If all tests pass:
   - Delete old `interactive-lesson-editor.js`
   - Update any documentation
   
2. If issues found:
   - Fix and retest

3. Feature requests for future:
   - Drag-to-reorder blocks
   - More component types
   - Batch edit multiple lessons
   - Problem pattern visual editor
