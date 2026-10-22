# Admin Interface Fixes - Complete Resolution

## Issues Reported
1. **"Redigera" button always requires lesson selection** - clicking "Redigera" says you need to select a lesson first, even when one is selected
2. **"Ny lektion" form doesn't close** - creating a new lesson form does not close nor add a lesson when trying to create it
3. **Admin interface not functional** - despite page loading, teacher features were inaccessible

## Root Causes

### Issue 1: Missing Data Exposure
The admin interface (`admin-interface.js`) was trying to access `window.activeLessonId` and `window.course`, but these were local variables inside the `app.js` IIFE (Immediately Invoked Function Expression) and never exposed to the global `window` object.

**Before:**
```javascript
// app.js (IIFE scope - not accessible to other modules)
let course;
let activeLessonId = "";

// admin-interface.js (IIFE scope - different module)
if (!window.activeLessonId) {
  alert("Vänligen välj en lektion först.");  // This always happened!
  return;
}
```

**After:**
```javascript
// app.js
let course;
let activeLessonId = "";
// ... later in loadCourse() ...
window.course = course;  // Now accessible
Object.defineProperty(window, 'activeLessonId', {
  get: function() { return activeLessonId; },
  set: function(value) { activeLessonId = value; }
});
window.openLesson = openLesson;
```

### Issue 2: Inline onclick Handlers
The lesson editor form used inline `onclick` handlers in the HTML template, which don't properly bind `this` context and can fail in certain scenarios.

**Before:**
```html
<button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Avbryt</button>
<button type="button" class="btn-primary" onclick="saveLessonEdits(this.closest('form'))">Spara lektion</button>
```

**After:**
```html
<button type="button" class="btn-secondary" id="btn-cancel-lesson">Avbryt</button>
<button type="button" class="btn-primary" id="btn-save-lesson">Spara lektion</button>
```

```javascript
const cancelBtn = content.querySelector("#btn-cancel-lesson");
const saveBtn = content.querySelector("#btn-save-lesson");

cancelBtn.addEventListener("click", function() {
  modal.remove();
});

saveBtn.addEventListener("click", function() {
  window.saveLessonEdits(form);
});
```

## Changes Made

### File: `app.js`
**Location:** Lines after `checkRoute();` in `loadCourse()` function

**Changes:**
1. Expose `course` to window after loading
2. Create getter/setter for `activeLessonId` to maintain encapsulation while exposing access
3. Expose `openLesson` function for lesson navigation from admin interface

```javascript
if (window.initAdminInterface) window.initAdminInterface();

// Expose to admin interface
window.course = course;
Object.defineProperty(window, 'activeLessonId', {
  get: function() { return activeLessonId; },
  set: function(value) { activeLessonId = value; }
});
window.openLesson = openLesson;
```

### File: `admin-interface.js`
**Location:** `showLessonEditor()` function (lines ~112-177)

**Changes:**
1. Replace inline `onclick` handlers with proper event listeners
2. Attach listeners to cancel and save buttons after modal is added to DOM
3. Ensure form submission properly calls `saveLessonEdits()`

```javascript
const form = content.querySelector(".lesson-editor");
const cancelBtn = content.querySelector("#btn-cancel-lesson");
const saveBtn = content.querySelector("#btn-save-lesson");

cancelBtn.addEventListener("click", function() {
  modal.remove();
});

saveBtn.addEventListener("click", function() {
  window.saveLessonEdits(form);
});

document.body.appendChild(modal);
```

## Workflow After Fixes

### Creating a New Lesson
1. User clicks "➕ Ny lektion" button in admin toolbar
2. `openNewLessonEditor()` creates a template lesson object
3. `showLessonEditor()` displays the form in a modal
4. User fills in the form fields (ID, title, area, content, etc.)
5. User clicks "Spara lektion" button
6. Event listener calls `saveLessonEdits(form)`
7. Form data is extracted and lesson is created/updated in `window.course.lessons`
8. Modal closes and page reloads to show the new lesson

### Editing an Existing Lesson
1. User selects a lesson by clicking on it in the graph
2. `activeLessonId` is updated (via setter) when lesson is clicked
3. User clicks "✏️ Redigera" button in admin toolbar
4. `openLessonEditor()` checks `window.activeLessonId` (now works!)
5. Finds the lesson and displays it in the editor form
6. User makes changes
7. User clicks "Spara lektion"
8. Changes are merged with existing lesson data (preserves exercise data)
9. Modal closes and page reloads

## Testing Checklist

After deployment, verify:

- [ ] Hard refresh browser (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
- [ ] Click "Lärarvy 📊" and enter "lärarläge" to enable admin mode
- [ ] Verify "👨‍🏫 Lärarläge aktiverat" toolbar appears at top
- [ ] Click on a lesson in the graph to select it
- [ ] Click "✏️ Redigera" button - editor should open (not show "select a lesson first" alert)
- [ ] Click "Avbryt" - modal should close
- [ ] Click "✏️ Redigera" again
- [ ] Modify a field (e.g., change title)
- [ ] Click "Spara lektion" - modal should close and page should reload
- [ ] Verify the lesson was updated with your changes
- [ ] Click "➕ Ny lektion" to create a new lesson
- [ ] Fill in all required fields
- [ ] Click "Spara lektion" - modal should close and page should reload
- [ ] Verify the new lesson appears in the list

## Browser LocalStorage

Note: All admin edits are stored in browser localStorage only. To persist changes permanently:

1. Click "💾 Exportera" in the admin toolbar
2. This downloads a JSON file with all lessons
3. Commit this JSON file to git
4. Or paste the content into the `lessons/index.json` and individual lesson files

## Related Files

- `app.js` - Core application, lesson loading and rendering
- `admin-interface.js` - Teacher admin interface for CRUD operations
- `graph-layout-enhanced.js` - Graph layout (now compatible with both signatures)
- `index.html` - Fixed admin link: `href="javascript:toggleAdminMode()"`

## Technical Notes

### Why Object.defineProperty for activeLessonId?
Using a property descriptor with getter/setter allows:
- Encapsulation: The actual `activeLessonId` variable remains local to `app.js`
- Controlled access: We can add logic to the getter/setter if needed in future
- Consistency: Both reading and writing go through the same interface
- Memory efficiency: We're not duplicating the variable on window

### Why Event Listeners Instead of onclick?
- More reliable: Listeners aren't affected by HTML parsing quirks
- Better debugging: Stack traces show the actual function names
- Proper context: Function scope is cleaner without inline code
- Flexibility: Easy to add multiple handlers to same event
- Standards: Follows modern JavaScript best practices

## Deployment

1. Clear browser cache or hard refresh (Ctrl+F5)
2. Clear localStorage if you want to start fresh (open DevTools → Application → Storage → Local Storage → select domain → Clear All)
3. Reload page
4. Test admin features

If issues persist, check browser console (F12 → Console tab) for any error messages.
