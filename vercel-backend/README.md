# RedBus Figma Plugin - Scraper Backend

One-click deployable backend for the Figma plugin's scraper functionality.

## 🚀 Deploy to Vercel (One-Time Setup)

Click the button below to deploy your own instance:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_ORG/redbus-figma-scraper&project-name=redbus-figma-scraper&repository-name=redbus-figma-scraper)

> **Note:** Replace `YOUR_ORG/redbus-figma-scraper` with your actual GitHub repository URL after pushing the code.

### Manual Deploy Steps

1. **Push to GitHub** (if not already):
   ```bash
   cd vercel-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_ORG/redbus-figma-scraper.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Click "Deploy"

3. **Get your URL:**
   After deployment, Vercel gives you a URL like:
   ```
   https://redbus-figma-scraper.vercel.app
   ```

4. **Update the Figma plugin** with this URL (see below)

## 📋 After Deployment

Once deployed, your scraper is live at:
```
https://YOUR-PROJECT-NAME.vercel.app/api/scrape
https://YOUR-PROJECT-NAME.vercel.app/api/health
```

Test it:
```bash
curl https://YOUR-PROJECT-NAME.vercel.app/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

## 🔧 Updating the Figma Plugin

After deploying, update the plugin to use your Vercel URL:

1. Open `figma-plugin/src/ui.tsx`
2. Find the line:
   ```typescript
   const SCRAPER_API_URL = 'http://localhost:3000';
   ```
3. Change it to your Vercel URL:
   ```typescript
   const SCRAPER_API_URL = 'https://YOUR-PROJECT-NAME.vercel.app';
   ```
4. Rebuild the plugin:
   ```bash
   cd figma-plugin
   npm run build
   ```

## 🧪 Local Development

For local testing:

```bash
npm install
npm run dev
```

Server runs at `http://localhost:3000`

## 📊 Usage Limits

Vercel free tier includes:
- **100 GB bandwidth/month** (plenty for a design team)
- **100 hours serverless function execution/month**
- **10 second default timeout** (we use 60s for scraping)

For a team of 10 designers doing ~50 scrapes/day, you'll use ~5% of the free tier.

## 🔒 Security Notes

- The scraper has CORS enabled for all origins (required for Figma plugin)
- Consider adding rate limiting for production use
- The scraper can only read public web pages

## 🐛 Troubleshooting

**"Function timeout" error:**
- Some pages take longer to load. Try again or use DataLayer mode.

**"Cannot reach API" error:**
- Check that your Vercel deployment is live
- Verify the URL in the Figma plugin is correct

**Scraping returns empty:**
- The website might be blocking bots
- Try using DataLayer mode instead (works better for RedBus)
