# 🌐 RedBus Figma Plugin - Web Scraper Sync

A Figma plugin that syncs live data from RedBus into your designs. Built for the RedBus UX team.

## ✨ Features

- **🔌 Internal API Mode** - Direct access to RedBus data (recommended when available)
- **📊 DataLayer Mode** - Extract structured data from analytics
- **📝 Selector Mode** - Custom CSS selector-based scraping
- **🖼️ Image Support** - Automatically fetch and embed images
- **📋 Batch Updates** - Fill multiple cards with different bus data

## 🚀 Quick Start

### For the Setup Person (One-Time)

1. **Deploy the scraper backend to Vercel** (see [vercel-backend/README.md](vercel-backend/README.md))
2. **Update the plugin URL** in `figma-plugin/src/ui.tsx`
3. **Build and share** with your team

### For Designers

1. **Install the plugin** in Figma
2. **Paste a RedBus URL**
3. **Name your layers** using `@[0]`, `@{operator}`, etc.
4. **Click Sync!**

📖 **Full guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)

## 📁 Project Structure

```
├── figma-plugin/          # Figma plugin source
│   ├── src/
│   │   ├── ui.tsx         # Plugin UI (React)
│   │   ├── code.ts        # Figma sandbox code
│   │   └── services/      # API clients
│   └── dist/              # Built plugin files
│
├── vercel-backend/        # Scraper backend
│   ├── api/               # Serverless functions
│   └── lib/               # Scraping logic
│
├── SETUP_GUIDE.md         # Designer-friendly guide
├── API_SPECIFICATION.md   # Internal API spec for Engineering
└── README.md              # This file
```

## 🔧 Development

### Figma Plugin

```bash
cd figma-plugin
npm install
npm run build    # Build for production
npm run watch    # Watch mode for development
```

### Backend (Local)

```bash
cd vercel-backend
npm install
npm run dev      # Start local server at :3000
```

## 📊 Data Modes Comparison

| Mode | Speed | Reliability | Data Fields |
|------|-------|-------------|-------------|
| ⚡ Auto (Direct API) | ~2s | ⭐⭐⭐ High | All fields (times, duration, amenities) |
| 🔄 XHR Intercept | ~15s | ⭐⭐ Medium | All fields (browser-based) |
| 📊 DataLayer | ~15s | ⭐⭐ Medium | Limited (no times/duration) |
| 📝 Selectors | ~15s | ⭐ Low | Custom |

**Auto mode** tries the direct API first (~2 seconds) and automatically falls back to browser-based extraction if needed.

## 🎯 Roadmap

- [x] DataLayer extraction for bus listings
- [x] Three-way mode selector
- [x] One-click Vercel deployment
- [ ] Internal API integration (waiting on Engineering)
- [ ] Figma Community publishing
- [ ] Chrome extension alternative

## 📄 Documentation

- [SETUP_GUIDE.md](SETUP_GUIDE.md) - For designers
- [API_SPECIFICATION.md](API_SPECIFICATION.md) - For Engineering team
- [vercel-backend/README.md](vercel-backend/README.md) - Backend deployment

## 🤝 Contributing

This is an internal RedBus tool. Contact the UX Tooling team for access.

## 📜 License

Internal use only - RedBus © 2026
