# 🚌 RedBus Figma Plugin

A Figma plugin that syncs live bus data from RedBus directly into your designs. **No server required!**

## ✨ Features

- **Zero Setup** - Just install the plugin and go
- **Direct API** - Fetches data directly from RedBus (~2 seconds)
- **Complete Data** - Gets all fields including times, duration, prices, ratings
- **Bulk Sync** - Fill multiple bus cards at once

## 🚀 Quick Start

1. **Install:** Figma → Plugins → Development → Import from manifest → Select `figma-plugin/manifest.json`
2. **Use:** Paste a RedBus search URL → Click "Fetch & Apply"

## 📖 Documentation

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions on:
- Setting up your Figma frames
- Naming conventions for auto-fill
- Troubleshooting

## 🏗️ Project Structure

```
├── figma-plugin/          # The Figma plugin (all you need!)
│   ├── manifest.json      # Plugin configuration
│   ├── src/               # Source code
│   │   ├── ui.tsx         # Plugin UI
│   │   ├── code.ts        # Figma sandbox code
│   │   └── services/      # API client
│   └── dist/              # Built files
│
└── vercel-backend/        # (Optional) Legacy scraper backend
```

## 🛠️ Development

```bash
# Install dependencies
cd figma-plugin && npm install

# Build
npm run build

# Watch mode
npm run watch
```

## 📝 Available Fields

| Field | Example |
|-------|---------|
| `operator` | FRESHBUS |
| `busType` | A/C Sleeper (2+1) |
| `departureTime` | 22:30 |
| `arrivalTime` | 05:45 |
| `duration` | 7h 15m |
| `price` | ₹850 |
| `rating` | 4.5 |
| `seatsAvailable` | 23 |
| `route` | Bangalore to Tirupati |
| `amenities` | WiFi, Charging Point |

## 📜 License

Internal RedBus UX Team Tool
