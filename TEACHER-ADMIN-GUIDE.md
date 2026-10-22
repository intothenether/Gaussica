# Teacher Admin Interface Documentation

## Overview

The Teacher Admin Interface (`admin-interface.js`) provides an interactive panel for creating, editing, and managing lessons without touching JSON files. It includes a visual editor, lesson list, and export functionality.

## Accessing Admin Mode

### Activation

1. **Open the application** at `http://localhost:8000` (or your GitHub Pages URL)
2. **Click "Lärarvy 📊"** in the top-right corner of any page
3. **Enter the activation code:** `lärarläge`
4. **Admin toolbar appears** at the top with green styling

### Deactivation

- Click **"🔒 Stäng lärarläge"** button in the admin toolbar
- Admin mode disables and page reloads

## Admin Toolbar

Once activated, you'll see a dark green toolbar with five buttons:

```
👨‍🏫 Lärarläge aktiverat  [➕ Ny lektion] [✏️ Redigera] [📋 Alla lektioner] [💾 Exportera] [🔒 Stäng lärarläge]
```

### Buttons

| Button | Function |
|--------|----------|
| **➕ Ny lektion** | Create a new lesson from blank template |
| **✏️ Redigera** | Edit currently selected lesson |
| **📋 Alla lektioner** | View list of all lessons with edit/delete options |
| **💾 Exportera** | Download all lessons as JSON file |
| **🔒 Stäng lärarläge** | Disable admin mode and hide toolbar |

## Creating a New Lesson

### Step 1: Click "➕ Ny lektion"

A modal window opens with a lesson editor form.

### Step 2: Fill in Lesson Information

**Basic Information Section:**

| Field | Example | Required |
|-------|---------|----------|
| **Lektion-ID** | `fractions-compare` | Yes |
| **Titel** | `Jämföra bråk` | Yes |
| **Område** | Select from dropdown: Tal & räkning, Algebra, Geometri, Mätning, Data | Yes |
| **Nivå/Årskurs** | `Ungefär åk 4-5` | Yes |
| **Varaktighet** | `8 min` | Yes |
| **Förkunskaper** | `fractions-basics, addition` (comma-separated IDs) | Optional |

**Content Section:**

| Field | Example | Purpose |
|-------|---------|---------|
| **Sammanfattning** | `Lär dig att jämföra två bråk och se vilken som är större.` | Short description shown in lesson overview |
| **Förklarings-rubrik** | `Hur jämför vi bråk?` | Heading for the explanation section |
| **Förklaring (långt)** | `För att jämföra två bråk behöver vi... [detailed explanation]` | Detailed explanation content |
| **Regel/Formel** | `Samma nämnare: jämför täljarna` | The key rule or formula |
| **Regel-etikett** | `HUVUDREGEL` | Label displayed above the rule |
| **Exempel** | `1/4 < 1/3 eftersom 3 är mindre än 4` | Concrete example |

### Step 3: Save

Click **"Spara lektion"** button.

- If creating new → Lesson added to course
- If editing existing → Lesson updated
- Modal closes, page refreshes, changes visible

## Editing a Lesson

### Method 1: Quick Edit (Current Lesson)

1. Select a lesson by clicking it on the graph
2. Click **"✏️ Redigera"** in admin toolbar
3. Edit form opens with current lesson data pre-filled
4. Make changes and click **"Spara lektion"**

### Method 2: Find & Edit (Any Lesson)

1. Click **"📋 Alla lektioner"** 
2. Scroll to find the lesson
3. Click **"Redigera"** button on that lesson's card
4. Edit form opens
5. Make changes and click **"Spara lektion"**

## Deleting a Lesson

1. Click **"📋 Alla lektioner"**
2. Find the lesson to delete
3. Click **"Radera"** button (red button)
4. Confirm deletion prompt
5. Lesson removed from course immediately

⚠️ **Warning:** Deletion is permanent and will affect all student progress data in that lesson.

## Viewing All Lessons

Click **"📋 Alla lektioner"** to see a comprehensive list:

For each lesson, you'll see:
- **Title** and Area badge (color-coded)
- **ID** (in code font)
- **Prerequisites count** or "Startkurs" if none
- **Duration**
- **Summary text**
- Action buttons: "Redigera" and "Radera"

### Features

- Scroll to browse all lessons
- Click "Redigera" to edit any lesson
- Click "Radera" to delete (with confirmation)
- Modal stays open for bulk operations

## Exporting Lesson Data

Click **"💾 Exportera"** to download all lesson data:

- **File:** `gaussica-lessons-YYYY-MM-DD.json`
- **Format:** Complete JSON with all lessons
- **Contents:** Areas, area notes, and all lesson details
- **Use Cases:**
  - Backup before making changes
  - Share with colleagues
  - Version control in git

### What Gets Exported

```json
{
  "areas": [
    {"id": "tal", "name": "Tal & räkning"},
    ...
  ],
  "areaNotes": {
    "tal": "Grundläggande räkning...",
    ...
  },
  "lessons": [
    {
      "id": "addition",
      "title": "Addition: lägg ihop tal",
      "area": "tal",
      "prerequisites": [],
      ...
    }
  ]
}
```

## Important Notes

### 🔒 Data Persistence

**Critical:** Admin changes are saved to browser `localStorage` only.

This means:
- ✅ Changes persist if you reload the page (same browser)
- ❌ Changes disappear if you clear browser data
- ❌ Changes don't sync across devices
- ❌ Changes don't sync across different browsers

### How to Make Changes Permanent

To preserve admin edits:

1. **Export as JSON** (💾 Exportera)
2. **Save the JSON file** to your computer
3. **Commit to git:**
   ```bash
   git add lessons/
   git commit -m "Update lessons via admin interface"
   git push
   ```
4. **Or:** Replace the lesson file manually with exported JSON

### For Production

If you want persistent admin changes without manual export:
1. Set up a backend database (PostgreSQL, MongoDB, etc.)
2. Modify `admin-interface.js` to send changes to your API
3. Update `app.js` to load lessons from your API
4. Deploy backend service alongside GitHub Pages

This requires additional infrastructure beyond scope of this guide.

## Lesson Editor Form Details

### Lektion-ID

- **Must be unique** across all lessons
- **Format:** lowercase, hyphen-separated (e.g., `fractions-basics`)
- **Used for:** Prerequisites links, progress tracking, URLs
- **Cannot change** after creation (best practice: set carefully)

### Område (Area)

Select the curriculum area this lesson belongs to:
- **Tal & räkning** (Numbers & Arithmetic)
- **Samband & algebra** (Relationships & Algebra)
- **Form & rum** (Shape & Space)
- **Tid & mätning** (Time & Measurement)
- **Data & slump** (Data & Probability)

⚠️ Changing area may affect how lesson appears in graph.

### Förkunskaper (Prerequisites)

- Enter comma-separated lesson IDs
- Examples: `addition, fractions-basics`
- Spaces are trimmed automatically
- These create the prerequisite chain in the graph
- Changing prerequisites automatically repositions lesson in graph

### Nivå (Level)

Examples:
- `Ungefär åk 3`
- `Åk 4-5`
- `Ungefär åk 6`

Free text field—use consistent format for clarity.

### Content Fields

All content fields support:
- ✅ Swedish text with special characters (å, ä, ö)
- ✅ Multi-line text (use line breaks)
- ✅ Mathematical symbols and expressions
- ✅ Plain text formatting (no HTML support currently)

## Keyboard Shortcuts

While editing:
- **Tab** → Move to next field
- **Shift+Tab** → Move to previous field
- **Enter** (in textarea) → New line (don't submit)
- **Ctrl+Enter** → Submit form (if implemented)

## Browser Compatibility

Tested and working in:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE 11 not supported (use modern browser)

## Troubleshooting

### "Admin mode activated but toolbar not visible"
1. Refresh page: Ctrl+F5 or Cmd+Shift+R
2. Check browser console for errors: F12 → Console tab
3. Verify `admin-interface.js` loaded: F12 → Sources tab

### "Changes disappeared after refresh"
- This is expected! Changes are in `localStorage` only
- Export the JSON to make permanent
- Reload clears `localStorage`
- **Solution:** Use "💾 Exportera" before refreshing

### "Cannot edit certain fields"
- Check for typos in lesson ID (must match exactly)
- Verify you have the correct browser (desktop, not mobile)
- Try clearing cache: Ctrl+Shift+Delete

### "Lesson won't save"
- Check that **Lektion-ID** is unique (no duplicates)
- Ensure **Titel**, **Område**, **Nivå** are filled
- Look at browser console (F12) for error messages

### "Exported JSON won't import back"
- Manually add to `lessons/` folder with correct filename
- Update `lessons/index.json` to reference the new file
- Deploy via git push

## Advanced: Modifying the Admin Interface

The admin interface is defined in `admin-interface.js` (~350 lines). To customize:

### Add a new field to the form

1. Find the `showLessonEditor()` function
2. Add an `<input>` or `<textarea>` with `name="fieldName"`
3. In `saveLessonEdits()`, add: `fieldName: data.get("fieldName")`
4. The field will be saved to the lesson automatically

### Change the activation code

In `admin-interface.js`, line ~20:
```javascript
if (code === "lärarläge") {  // ← Change this text
```

### Hide the admin link

In `index.html`, comment out line with `admin-top-link`:
```html
<!-- <a class="admin-top-link" href="#admin" id="admin-top-link">Lärarvy 📊</a> -->
```

## Examples

### Example 1: Create a Fractions Lesson

1. Click **➕ Ny lektion**
2. Fill form:
   - ID: `fractions-compare`
   - Titel: `Jämföra bråk`
   - Område: Tal & räkning
   - Nivå: Ungefär åk 4-5
   - Varaktighet: 8 min
   - Förkunskaper: `fractions-basics`
   - Sammanfattning: Lär dig jämföra två bråk
   - Förklaring: Två bråk kan jämföras genom...
   - Regel: Samma nämnare → jämför täljarna
3. Click **Spara lektion**
4. Lesson appears in graph automatically

### Example 2: Update an Existing Lesson

1. Click lesson in graph to select it
2. Click **✏️ Redigera**
3. Change the **Varaktighet** from `6 min` to `10 min`
4. Update **Förklaring** with new content
5. Click **Spara lektion**
6. Graph updates immediately

### Example 3: Export Before Major Changes

1. Click **💾 Exportera**
2. Save `gaussica-lessons-2024-01-15.json` to your computer
3. Make multiple changes to lessons
4. If something breaks, you have a backup!

## Support & Feedback

If you encounter issues or have feature requests:
1. Check this documentation first
2. Review browser console (F12) for error messages
3. Test in a different browser
4. Create a GitHub issue with details

Happy teaching! 🎓✏️
