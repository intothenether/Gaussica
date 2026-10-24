# Interactive Visual Lesson Editor Implementation

## Overview
The interactive visual lesson editor is a complete drag-and-drop component-based editor that allows teachers to visually design lessons. It features a split-screen layout with a component library, editable canvas, and live preview pane.

## Architecture

### Core Components

#### 1. **interactive-lesson-editor.js** (21.1 KB)
- **Purpose**: Main editor module with complete drag-and-drop functionality
- **API**: `window.InteractiveEditor.open(lesson)` - Opens the visual editor for a lesson
- **Key Features**:
  - Split-screen layout (sidebar + canvas + preview)
  - Drag-and-drop component library
  - Live preview of lesson changes
  - Real-time property editing
  - Component card management (add, edit, delete)

#### 2. **admin-interface.js** (Modified)
- **Added**: 
  - "🎨 Visuell editor" button in admin toolbar
  - `openVisualEditor()` function that opens editor for selected lesson
  - Event listener integration

#### 3. **styles.css** (Extended)
- **Added**: 600+ lines of editor-specific styling
- **Includes**:
  - Editor overlay and modal styling
  - Component library and card styles
  - Split-screen layout (sidebar, canvas, preview)
  - Drag-and-drop visual feedback
  - Property panel styling
  - Component preview rendering

#### 4. **index.html** (Modified)
- **Added**: `<script src="./interactive-lesson-editor.js" defer></script>`
- **Load Order**: 
  1. graph-layout.js
  2. graph-layout-enhanced.js
  3. symbolic-math.js
  4. interactive-lesson-editor.js ← NEW
  5. admin-interface.js
  6. app.js

## Component Types Supported

### Text & Structure
- **text** 📝 - Plain paragraph text
- **heading** 📌 - Hierarchical headings (level 1-3)

### Educational Content
- **rule** 📐 - Formula/rule cards with label, equation, and example
- **diagram** 📊 - Visual diagrams (bar, pie, line, table)
- **slider** 🎚️ - Interactive range sliders
- **functionGraph** 📈 - Function graphing (future support)

### Interactive & Assessment
- **problem** ❓ - Single exercise with prompt and answers
- **problemPattern** 🔄 - Bulk problem generation from patterns

## UI Layout

### Sidebar (240px)
- **Tabs**: 
  - 📄 **Content** - Component library with drag items
  - ⚙️ **Settings** - Property editor for selected component
- **Component Library**:
  - Draggable items for each component type
  - Click to add or drag to canvas
  - Visual icons and labels

### Canvas (Center)
- **Lesson Metadata Section**:
  - Title (editable)
  - Area/Category (editable)
  - Summary (editable textarea)
- **Component Canvas**:
  - Drag-and-drop zone for adding components
  - Component cards showing preview of each component
  - Add/Remove/Edit buttons on each card
  - Drag items from library or reorder components

### Preview Pane (Right)
- **Live Preview**:
  - Shows lesson exactly as student will see it
  - Updates in real-time as you edit
  - Full metadata display
  - Component rendering

## Usage Flow

### Opening the Visual Editor
1. **Enable Lärarläge** (Teacher Mode):
   - Click "Lärarvy" in top header
   - Enter: `lärarläge`
   - Page reloads with admin toolbar

2. **Select a Lesson**:
   - Click "📋 Alla lektioner" to see list
   - Click lesson to select it

3. **Open Visual Editor**:
   - Click "🎨 Visuell editor" button
   - Editor opens in full-screen modal

### Editing Components
1. **Add Component**:
   - Click component type in sidebar library, OR
   - Drag component type to canvas

2. **Select Component**:
   - Click any component card on canvas
   - Settings tab shows editable properties
   - Preview updates in real-time

3. **Edit Properties**:
   - Switch to ⚙️ Settings tab
   - Edit component-specific fields
   - Changes save immediately to preview

4. **Remove Component**:
   - Click ✕ delete button on component card
   - Confirm deletion

### Saving
1. **Click 💾 Spara button**:
   - Saves lesson to window.course.lessons
   - Saves backup to localStorage
   - Shows success message
   - Reloads page to show changes

## Component Property Editors

### Text Components
- **text**: Plain paragraph text
- **heading**: 
  - text: Heading content
  - level: 1-3 (rendered as h2-h4)

### Rule Card
- **label**: Rule name (e.g., "REGEL")
- **formula**: Mathematical expression
- **example**: Usage example

### Diagram
- **type**: Diagram type (stapeldiagram, cirkeldiagram, etc.)
- **title**: Chart title
- **config**: Extended diagram configuration

### Slider
- **min**: Minimum value
- **max**: Maximum value
- **step**: Increment size
- **initialValue**: Starting position

### Problem
- **prompt**: Question text for the student

### Problem Pattern
- **type**: Pattern type (arithmetic, multiStep, wordProblem)

## CSS Classes Reference

### Editor Structure
- `.editor-overlay` - Full-screen backdrop
- `#interactive-editor` - Main editor container
- `.editor-header` - Title and save/cancel buttons
- `.editor-main` - Three-pane layout container

### Sidebar
- `.editor-sidebar` - Left pane
- `.editor-tabs` - Tab switcher
- `.component-library` - Draggable component list
- `.component-properties` - Property editor panel

### Canvas
- `.editor-center` - Central editing area
- `.meta-form` - Lesson metadata form
- `.component-canvas` - Drop zone for components
- `.component-card` - Individual component card

### Preview
- `.editor-preview` - Right pane
- `.preview-content` - Preview container
- `.preview-component` - Individual component in preview
- `.rule-card` - Styled formula display
- `.problem-card` - Styled problem display

## Drag & Drop Behavior

### Drag Source
- Component library items (`.component-library-item`)
- `dataTransfer.setData("componentType", type)`

### Drop Target
- `.component-canvas` element
- `dragover` event adds `.dragover` class (visual feedback)
- `dragleave` event removes `.dragover` class
- `drop` event retrieves component type and adds to lesson

## Data Format

### Lesson with Components
```javascript
{
  id: "lesson-abc123",
  title: "Addition",
  area: "tal",
  summary: "Learn to add numbers",
  components: [
    {
      id: "text-123",
      type: "text",
      text: "Welcome to addition!"
    },
    {
      id: "rule-456",
      type: "rule",
      label: "ADDITION",
      formula: "a + b = c",
      example: "2 + 3 = 5"
    },
    {
      id: "problem-789",
      type: "problem",
      prompt: "What is 4 + 5?"
    }
  ]
}
```

## State Management

### Editor State
```javascript
editorState = {
  isDirty: false,      // Tracks unsaved changes
  activeTab: "content" // "content" or "settings"
}
```

### Current Lesson
- `currentLesson` - Deep copy of the lesson being edited
- `selectedComponentIdx` - Index of selected component in canvas

## Error Handling

- **Missing course data**: Alert "Fel: Kursdata inte tillgänglig"
- **Module not loaded**: Alert "Visuell editor är inte tillgänglig än. Ladda om sidan."
- **Unsaved changes**: Confirmation dialog before closing
- **Delete component**: Confirmation dialog before removal

## Integration Points

### With Admin Interface
- Opens from toolbar button
- Requires active lesson selection
- Uses `window.course` for data access
- Saves to `window.course.lessons`

### With Lesson Renderer
- Lessons saved can be viewed normally
- Components rendered by existing lesson view
- Format compatible with current lesson structure

### With localStorage
- Backs up entire course to `mattesteg-lessons-backup`
- Allows recovery if browser closes unexpectedly

## Accessibility Features

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Escape key to close editor (via modal backdrop click)
- Confirmation dialogs for destructive actions

## Performance Considerations

- Deep copy of lesson on open (prevents accidental original modifications)
- Component library uses simple static data (no network requests)
- Live preview updates efficiently
- Canvas rendering optimized for component count (typical <20 components)

## Known Limitations

1. **Function Graphs**: Not yet rendered visually in preview
2. **Diagram Editors**: Data editor not yet implemented - use config JSON
3. **Problem Patterns**: Generation preview not implemented
4. **File Export**: No direct lesson export/import from/to files
5. **Versioning**: No version history or undo/redo support

## Future Enhancements

1. **Advanced Component Editors**:
   - Visual diagram builder
   - Function graph plotter
   - Problem pattern template designer

2. **Additional Features**:
   - Duplicate/copy components
   - Reorder components via drag
   - Component templates library
   - Search/filter components

3. **Collaboration**:
   - Real-time collaboration
   - Component sharing between teachers
   - Lesson templates repository

4. **Export/Import**:
   - Export lessons to JSON files
   - Import from external templates
   - Git synchronization for version control

## Testing Checklist

- [x] Editor loads without errors
- [x] Lesson metadata editable
- [x] Components add to canvas
- [x] Components deletable
- [x] Properties editable in real-time
- [x] Preview updates live
- [x] Save persists to course data
- [x] Save backs up to localStorage
- [x] Can open saved lessons again
- [x] Drag-and-drop works
- [x] Unsaved changes warning works
- [ ] Function graphs render correctly
- [ ] Problem pattern generation preview works

## Files Modified

1. **interactive-lesson-editor.js** (NEW) - 21.1 KB
2. **admin-interface.js** - Added button and openVisualEditor()
3. **styles.css** - Added 600+ lines of editor styling
4. **index.html** - Added script tag for editor

## Backward Compatibility

- Old lessons without `components` array still work
- Editor automatically initializes `components` array
- Both old and new lesson formats coexist
- Existing lesson viewer still functional
