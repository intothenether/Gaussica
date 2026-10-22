# Gaussica Quick Start Guide

Get up and running with Gaussica in 2 minutes.

## Prerequisites

- Node.js 14+ installed
- Git
- Browser (Chrome, Firefox, Safari, Edge)

## Local Development (2 minutes)

### 1. Start the Server

```bash
cd C:\Users\sebas\Projects\Gaussica
node server.js
```

Server starts on `http://localhost:8000`

### 2. Open in Browser

```
http://localhost:8000
```

### 3. View Available Lessons

Browse the interactive graph and select any lesson.

## Three Ways to Use Gaussica

### 1️⃣ Student Mode (Default)

1. Open `http://localhost:8000`
2. Click any lesson node
3. Read explanation
4. Solve exercises
5. Track progress

✅ **Features:**
- 21 curriculum lessons
- 44+ auto-generated practice problems
- Mistake explanations
- Progress tracking

### 2️⃣ Teacher Admin Mode

1. Open `http://localhost:8000`
2. Click "Lärarvy 📊" (top-right)
3. Enter code: `lärarläge`
4. Admin toolbar appears
5. Create, edit, or export lessons

✅ **Features:**
- Create new lessons from UI
- Edit lesson content (no JSON needed)
- View all lessons
- Export backup JSON
- Delete lessons

📚 **Guide:** See `TEACHER-ADMIN-GUIDE.md`

### 3️⃣ Production Deployment

1. Follow guide in `GITHUB-PAGES-SETUP.md`
2. Deploy to GitHub Pages (Option A or B)
3. Site goes live in 1-2 minutes
4. Share URL with students

✅ **Features:**
- Free hosting on GitHub
- Automatic updates via git push
- Fast CDN-backed delivery
- Admin interface works on live site

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main page |
| `app.js` | Core application |
| `styles.css` | Visual design |
| `graph-layout-enhanced.js` | Learning graph layout |
| `admin-interface.js` | Teacher panel |
| `lessons/` | Curriculum content (JSON) |
| `server.js` | Local dev server |

## Key Documentation

| File | Read This For |
|------|---|
| `TEACHER-ADMIN-GUIDE.md` | How to create/edit lessons |
| `GRAPH-REDESIGN.md` | How the graph works |
| `GITHUB-PAGES-SETUP.md` | How to deploy |
| `PHASE-3-COMPLETE.md` | What's new in this update |
| `README-INDEX.md` | Full documentation index |

## Common Tasks

### Add a New Lesson

**Option A: Via Admin UI (Recommended)**
1. Open `http://localhost:8000`
2. Click "Lärarvy 📊" → Enter `lärarläge`
3. Click "➕ Ny lektion"
4. Fill form and save
5. Click "💾 Exportera" to backup
6. Commit JSON to git

**Option B: Direct JSON Edit**
1. Create `lessons/my-lesson.json`
2. Add to `lessons/index.json`
3. Refresh browser

### Export Lesson Data

```bash
# In admin panel, click "💾 Exportera"
# File downloads as gaussica-lessons-YYYY-MM-DD.json
```

### Deploy to GitHub Pages

```bash
# Follow GITHUB-PAGES-SETUP.md
# Quick version:
git add .
git commit -m "Deploy Gaussica to GitHub Pages"
git push origin main
```

### Test Admin Interface

1. Open `http://localhost:8000`
2. Click "Lärarvy 📊"
3. Enter: `lärarläge`
4. Admin toolbar should appear (dark green bar at top)

### Check Console for Errors

```bash
# Press F12 in browser
# Go to Console tab
# Look for red error messages
```

## Lesson Structure

Each lesson is a JSON file with this structure:

```json
{
  "id": "addition",
  "title": "Addition: lägg ihop tal",
  "area": "tal",
  "level": "Ungefär åk 3",
  "duration": "5 min",
  "prerequisites": [],
  "summary": "Kort beskrivning...",
  "explanation": "Detaljerad förklaring...",
  "rule": "a + b = c",
  "example": "Exempel här...",
  "exercise": {
    "prompt": "Fråga här?",
    "answer": ["7"],
    "feedback": ["Rätt! 3 + 4 = 7"]
  },
  "wordProblems": [
    {
      "prompt": "Text problem...",
      "answer": ["svar"],
      "feedback": ["Förklaring..."]
    }
  ],
  "problemPatterns": []
}
```

### Required Fields

- ✅ `id` - unique identifier
- ✅ `title` - lesson name
- ✅ `area` - one of: tal, algebra, geometri, matning, data
- ✅ `level` - grade level (free text)
- ✅ `duration` - time estimate
- ✅ `prerequisites` - array of lesson IDs
- ✅ `exercise` - main problem with prompt/answer/feedback
- ✅ `wordProblems` - array of word problems (can be empty)

## Areas (Subject Categories)

| Area | English | Example Lessons |
|------|---------|---|
| `tal` | Numbers & Arithmetic | Addition, Subtraction, Fractions |
| `algebra` | Relationships & Algebra | Equations, Functions, Patterns |
| `geometri` | Shape & Space | Area, Perimeter, 3D shapes |
| `matning` | Time & Measurement | Clock, Units, Conversions |
| `data` | Data & Probability | Diagrams, Statistics, Probability |

## Keyboard Shortcuts

### Application

- `#start` → Home
- `#larstig` → Learning graph
- `#admin` → Admin panel
- Click any lesson → Open lesson
- Click "Lärarvy 📊" → Toggle admin

### Admin Panel

- `Tab` → Next field
- `Shift+Tab` → Previous field
- `Enter` (in textarea) → New line
- `Ctrl+Enter` → Submit (if implemented)

## API Endpoints (Dev Server Only)

```
GET /                               # Main page
GET /lessons/index.json             # Lesson registry
GET /lessons/{lesson-id}.json       # Individual lesson
GET /styles.css                     # Styles
GET /app.js                         # Application
```

## Performance Tips

**Optimize lessons:**
- Keep explanations < 500 characters
- Use 3-5 example problems per lesson
- Limit word problems to 3-5 max
- Use simple, clear language

**Optimize graph:**
- Auto-calculated from prerequisites
- No manual positioning needed
- Responsive: adapts to screen size

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server won't start | Check port 8000 not in use: `netstat -an \| findstr 8000` |
| Lessons won't load | Check `lessons/index.json` paths are correct |
| Admin mode won't activate | Refresh (Ctrl+F5), check console for errors |
| Changes disappear on refresh | Admin changes in localStorage only—export to backup |
| Graph shows wrong order | Prerequisites incorrectly set—check lesson JSON |

## Next Steps

1. **Explore the curriculum**
   - Open `http://localhost:8000`
   - Click through all 21 lessons

2. **Test admin interface**
   - Click "Lärarvy 📊"
   - Enter `lärarläge`
   - Try creating a new lesson

3. **Prepare for deployment**
   - Read `GITHUB-PAGES-SETUP.md`
   - Choose Option A or B
   - Push to GitHub

4. **Share with students**
   - Give them the GitHub Pages URL
   - Or keep running locally
   - Add more lessons as needed

## Support

**For issues:**
1. Check relevant documentation file
2. Review browser console (F12)
3. Test in different browser
4. Check this quick start guide

**Documentation:**
- `README-INDEX.md` - Full documentation index
- `TEACHER-ADMIN-GUIDE.md` - Admin features
- `GRAPH-REDESIGN.md` - Graph details
- `GITHUB-PAGES-SETUP.md` - Deployment

## That's it! 🎉

Gaussica is ready to use. Happy teaching and learning! 📚✏️

---

**Current Version:** 3.0
**Status:** ✅ Production Ready
**Last Updated:** 2024-01-15
