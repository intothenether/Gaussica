# GitHub Pages Deployment Guide for Gaussica

This guide explains how to deploy Gaussica to GitHub Pages for public hosting.

## Overview

Gaussica is currently designed to run as a static website—no backend server required. The Node.js `server.js` is only used for local development. GitHub Pages can serve the application directly from your repository.

## Prerequisites

- GitHub repository for Gaussica (already created)
- Repository has a main branch
- You have write access to the repository

## Two Deployment Approaches

### Option A: Deploy from /docs folder (Simplest)

1. **Copy all files into a `docs/` folder**
   ```bash
   mkdir docs
   cp -r lessons styles.css app.js index.html graph-layout.js graph-layout-enhanced.js admin-interface.js symbolic-math.js docs/
   ```

2. **Push to GitHub**
   ```bash
   git add docs/
   git commit -m "Add Gaussica to docs folder for GitHub Pages"
   git push origin main
   ```

3. **Enable Pages in GitHub**
   - Go to: Repository → Settings → Pages
   - Source: Select "Deploy from a branch"
   - Branch: Select `main`
   - Folder: Select `docs`
   - Click "Save"

4. **Your site is live!**
   - URL: `https://yourusername.github.io/Gaussica`

### Option B: Deploy using GitHub Actions (Recommended for continuous updates)

1. **Create `.github/workflows/deploy.yml`**
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches:
         - main
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Setup Pages
           uses: actions/configure-pages@v3
         - name: Upload artifact
           uses: actions/upload-pages-artifact@v2
           with:
             path: '.'
         - name: Deploy
           uses: actions/deploy-pages@v2
   ```

2. **Enable Pages in GitHub**
   - Go to: Repository → Settings → Pages
   - Source: Select "GitHub Actions"
   - Click "Save"

3. **Push to trigger deployment**
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "Add GitHub Pages deployment workflow"
   git push origin main
   ```

4. **Monitor deployment**
   - Go to: Repository → Actions tab
   - Watch the workflow run
   - Once complete, your site is live at `https://yourusername.github.io/Gaussica`

## Static Files Required

Ensure all these files are at the root or in `/docs`:

```
├── index.html                 # Main page
├── styles.css                 # Styling
├── app.js                      # Application logic
├── graph-layout.js             # Original graph layout
├── graph-layout-enhanced.js    # Enhanced layout with difficulty progression
├── admin-interface.js          # Teacher admin panel
├── symbolic-math.js            # Math evaluation
├── lessons/                    # All lesson JSON files
│   ├── index.json
│   ├── addition.json
│   ├── ... (all other lessons)
│   └── parenteser.json
```

## Customizing Your Domain

### Use a custom domain (optional)

1. Update your DNS provider to point to GitHub Pages:
   - Add `A` record pointing to GitHub's IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Or add `CNAME` record pointing to `yourusername.github.io`

2. Add a `CNAME` file to your repo root:
   ```
   example.com
   ```

3. Enable in GitHub Pages settings: Repository → Settings → Pages → Custom domain

## Accessing the Admin Interface

Once deployed, teachers can activate the admin panel:

1. Open the site: `https://yourusername.github.io/Gaussica`
2. At any time, press the "Lärarvy 📊" link in the top-right corner
3. Or navigate to `#admin`
4. Enter the activation code: `lärarläge`

**Admin Features:**
- Create new lessons
- Edit existing lessons
- View all lessons
- Export lesson data as JSON
- Delete lessons (with confirmation)

⚠️ **Important**: Admin changes are saved to browser `localStorage` only—they won't persist across browsers or devices unless exported and re-imported. For production, consider integrating a database backend.

## Updating Content

After deploying to GitHub Pages:

1. **Edit locally**
   ```bash
   # Modify lessons/index.json or any lesson file
   # Add new content to lessons/ folder
   ```

2. **Push changes**
   ```bash
   git add lessons/
   git commit -m "Update lesson content"
   git push origin main
   ```

3. **GitHub Actions automatically deploys**
   - The workflow runs automatically on every push
   - Your live site updates within 2 minutes
   - No manual deployment needed

## Troubleshooting

### Site shows "404 Not Found"
- Ensure you've enabled Pages in Settings
- Check that the branch and folder are correct
- Wait 1-2 minutes for initial deployment

### Styles or scripts don't load
- Ensure file paths in `index.html` are relative (correct: `./styles.css` not `/styles.css`)
- Check that all files are committed and pushed
- Clear browser cache: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)

### Changes don't appear after push
- Check Actions tab: is the workflow running?
- Wait 1-2 minutes for GitHub's CDN to update
- Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

### Admin changes disappear
- Admin edits are saved to `localStorage` in that browser only
- To make persistent changes, export the JSON and commit to git
- Or reload the page—changes in localStorage are lost on refresh

## Performance & Analytics

GitHub Pages serves your site via a global CDN for fast loading worldwide. If you want to track usage:

1. **Add Google Analytics**
   - Get a tracking ID from Google Analytics
   - Add to `<head>` in `index.html`:
     ```html
     <script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
     <script>
       window.dataLayer = window.dataLayer || [];
       function gtag(){dataLayer.push(arguments);}
       gtag('js', new Date());
       gtag('config', 'GA_ID');
     </script>
     ```

2. **GitHub Insights** (built-in)
   - Repository → Insights tab shows visitor stats

## Security Considerations

Gaussica stores student progress in browser `localStorage`. This is intentional for privacy:
- No data is sent to servers
- Each device has its own progress
- Clearing browser data clears progress

If you need server-side data storage or user authentication, you'll need to:
1. Create a backend API (Node.js, Python, etc.)
2. Modify `app.js` to send progress to your API
3. Store in a database (PostgreSQL, MongoDB, etc.)

This is beyond the scope of GitHub Pages hosting and would require additional infrastructure.

## Next Steps

1. Choose your deployment approach (Option A or B)
2. Follow the steps above
3. Verify your site is live
4. Share the URL with students and teachers
5. Use the admin interface to manage content

## Support

For issues or questions:
1. Check GitHub Pages troubleshooting: https://docs.github.com/pages/getting-started-with-github-pages/about-github-pages
2. Review your repository Actions tab for deployment errors
3. Ensure all files are properly committed and have correct file names

Happy teaching! 🎓📚
