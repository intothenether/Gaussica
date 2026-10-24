# Interactive Visual Lesson Editor - Quick Start Guide

## Access the Visual Editor

### Step 1: Enable Teacher Mode
1. Open http://localhost:8000 (or your deployment URL)
2. Click **"Lärarvy 📊"** in the top-right corner
3. When prompted, type: `lärarläge`
4. Page reloads with admin toolbar at top

### Step 2: Select a Lesson
1. Click **"📋 Alla lektioner"** button in admin toolbar
2. Browse the lesson list
3. Click the lesson you want to edit (or the radio button to select it)

### Step 3: Open Visual Editor
1. Click **"🎨 Visuell editor"** button in admin toolbar
2. Editor opens in full-screen modal with three panes:
   - **Left (Sidebar)**: Component library and properties
   - **Center (Canvas)**: Lesson editing area
   - **Right (Preview)**: Live lesson preview

---

## Using the Visual Editor

### Adding Components

**Method 1: Click from Library**
1. In sidebar, ensure "📄 Innehål" tab is selected
2. Find the component type you want (e.g., "Tekst")
3. Click it - component appears on canvas
4. Select it and edit properties in Settings tab

**Method 2: Drag from Library**
1. Click and hold a component type in sidebar
2. Drag it to the canvas area
3. Release to add component
4. Select and edit properties

### Editing Lesson Metadata

At the top of the canvas:
- **Titel**: Lesson name
- **Område**: Subject area (tal, brak, procent, etc.)
- **Sammanfattning**: Short description students see

Changes update in preview instantly.

### Editing Components

1. **Click** any component card on the canvas to select it
2. Switch to **⚙️ Inställningar** (Settings) tab in sidebar
3. Edit the component-specific fields:
   - For **Tekst**: Edit text content
   - For **Rubrik**: Edit text and level (1-3)
   - For **Regel**: Edit label, formula, example
   - For **Diagram**: Edit type and title
   - For **Skjutreglage**: Edit min, max, step values
   - For **Uppgift**: Edit question prompt

4. All changes appear **instantly in preview**

### Removing Components

1. Find the component on canvas
2. Click the **✕** button on the component card
3. Confirm deletion in popup
4. Component removed from lesson and preview

### Viewing Live Preview

The right pane shows exactly how the lesson will appear to students:
- Full lesson metadata at top
- All components rendered in order
- Styles applied
- Interactive elements visible

---

## Component Types

| Icon | Name | Purpose | Key Fields |
|------|------|---------|-----------|
| 📝 | Tekst | Paragraph text | text |
| 📌 | Rubrik | Heading (h2-h4) | text, level |
| 📐 | Regel | Formula card | label, formula, example |
| 📊 | Diagram | Charts/graphs | type, title, data |
| 🎚️ | Skjutreglage | Interactive slider | min, max, step, initialValue |
| 📈 | Funktionsgraf | Function graphs | xMin, xMax, yMin, yMax |
| ❓ | Uppgift | Exercise | prompt, answer, feedback |
| 🔄 | Uppgiftsmönster | Bulk problem gen | type, parameters |

---

## Saving Your Changes

### Save Lesson
1. Click **"💾 Spara"** button in header
2. Lesson saves to application data
3. Backup saved to browser localStorage (recoverable if needed)
4. Success message "✅ Lektion sparad!"
5. Page reloads to show changes
6. Return to normal lesson view

### If You Have Unsaved Changes
- Try to close editor without saving
- Popup warns: "❗ Du har ändringar som inte är sparade. Vill du stänga ändå?"
- Click **OK** to discard or **Cancel** to keep working

---

## Examples

### Example 1: Create Simple Text Lesson

1. Click **"🎨 Visuell editor"** to open
2. Edit metadata:
   - Title: "Introducción till addition"
   - Area: "tal"
   - Summary: "Lär dig att addera två tal"
3. Click **"📝 Tekst"** to add text component
4. In Settings, enter: "Addition är att lägga två tal tillsammans"
5. Click **"📐 Regel"** to add rule card
6. Set:
   - Label: "ADDITION"
   - Formula: "a + b = c"
   - Example: "2 + 3 = 5"
7. Click **"❓ Uppgift"** to add problem
8. Set prompt: "Vad är 4 + 7?"
9. Watch preview update on right
10. Click **"💾 Spara"** to save

### Example 2: Interactive Slider Lesson

1. Click **"🎨 Visuell editor"** 
2. Edit metadata for slider exploration lesson
3. Add **"📝 Tekst"**: "Ändra värdena med skjutreglaget"
4. Add **"🎚️ Skjutreglage"**:
   - Min: 0
   - Max: 100
   - Step: 5
   - Initial: 50
5. Preview shows interactive slider
6. Save when ready

### Example 3: Multi-part Lesson

1. Add heading: "Multiplikation"
2. Add text: explanation of multiplication
3. Add rule card with formula
4. Add diagram showing multiplication
5. Add problem
6. View complete lesson in preview
7. Save

---

## Tips & Tricks

✅ **Live preview is your friend** - Watch changes appear instantly
✅ **Add components gradually** - Build complexity step by step
✅ **Test as student** - Preview shows exactly what students see
✅ **Property tab is context-sensitive** - Only relevant fields shown per component
✅ **Drag library items** - Faster than clicking for multiple additions
✅ **Unsaved changes protected** - Can't accidentally close with unsaved work

---

## Troubleshooting

### "Vänligen välj en lektion först" (Please select a lesson first)
→ Click "📋 Alla lektioner" and select a lesson before opening editor

### "Visuell editor är inte tillgänglig än" (Visual editor not available)
→ Reload page with F5, wait for scripts to load

### Editor looks broken/styled incorrectly
→ Clear browser cache (Ctrl+Shift+Delete)
→ Reload page (Ctrl+F5)

### Components not appearing in preview
→ Check that component is properly saved
→ Scroll preview pane to see all content

### Lesson not saved
→ Check browser console for errors (F12)
→ Ensure you clicked "💾 Spara" button
→ Confirm success message appeared

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close editor | Escape or click ✕ |
| Save | No shortcut (use button) |
| Select all text | Ctrl+A in text fields |
| Cancel editing | Escape from dialogs |

---

## Browser Compatibility

✅ Works in: Chrome, Firefox, Edge, Safari (modern versions)
✅ Requires: JavaScript enabled
✅ Best performance: Desktop/tablet (mobile experience cramped)

---

## Data Storage

- Lessons stored in `window.course.lessons` array
- Backup saved to browser localStorage as `mattesteg-lessons-backup`
- localStorage limited to ~5MB per domain
- For production: Sync with backend server

---

## Next Steps After Creating Lessons

1. **Test in student view**:
   - Close admin mode (click "🔒 Stäng lärarläge")
   - Visit lesson as student would
   - Verify all components work

2. **Iterate and improve**:
   - Reopen in visual editor
   - Make refinements
   - Save changes

3. **Share with students**:
   - Deploy application to live server
   - Share link with students
   - Monitor usage and gather feedback

---

## Getting Help

- Check the console (F12) for error messages
- Review VISUAL-EDITOR-IMPLEMENTATION.md for technical details
- Test with simple lessons first before complex ones
