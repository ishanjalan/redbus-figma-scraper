# 🎨 RedBus Figma Plugin - Setup Guide

A simple guide to get the plugin working for your design team.

---

## 🚀 Quick Start (For Designers)

### Step 1: Start the Server
**Double-click** `START_SERVER.command` in the project folder.

Keep the terminal window open while using the plugin.

### Step 2: Install the Figma Plugin (One-time)
1. Open Figma Desktop
2. Go to **Menu → Plugins → Development → Import plugin from manifest**
3. Select `figma-plugin/manifest.json`

### Step 3: Use It!
1. Right-click → **Plugins → Web Scraper Sync**
2. Paste any RedBus search URL
3. Click **Fetch & Apply**

**That's it!** 🎉

---

## First-Time Setup (One Person Does This)

If you haven't cloned the repo yet:

```bash
# Clone the repository
git clone https://github.com/ishanjalan/redbus-figma-scraper.git
cd redbus-figma-scraper

# Install backend dependencies
cd vercel-backend
npm install
```

Then share the folder with your team (via Google Drive, Dropbox, etc.).

---

## For Designers (Using the Plugin)

### Installing the Plugin

1. Open Figma Desktop
2. Go to **Menu → Plugins → Development → Import plugin from manifest**
3. Select the `figma-plugin/manifest.json` file
4. Done! ✅

### Using the Plugin

#### Quick Start

1. **Open the plugin:** Right-click → Plugins → Web Scraper Sync
2. **Paste a RedBus URL** (e.g., search results page)
3. **Choose a mode:**
   - 🔌 **Internal API** - Best quality (when available)
   - 📊 **DataLayer** - Good for bus listings
   - 📝 **Selectors** - Custom scraping
4. **Click "Fetch Data"** then **"Apply to Figma"**

#### Setting Up Your Figma Frames

For the plugin to fill your designs, name your layers like this:

**Frame names:**
```
Card @[0]    ← First bus
Card @[1]    ← Second bus
Card @[2]    ← Third bus
...
```

**Text layers inside each card:**
```
@{operator}       ← Bus company name (e.g., "FRESHBUS")
@{price}          ← Formatted price (e.g., "₹850")
@{busType}        ← Bus type (e.g., "A/C Sleeper (2+1)")
@{rating}         ← Star rating (e.g., "4.5")
@{departureTime}  ← Departure time (e.g., "22:30")
@{arrivalTime}    ← Arrival time (e.g., "05:45")
@{duration}       ← Duration (e.g., "7h 15m")
@{seatsAvailable} ← Available seats (e.g., "23")
@{route}          ← Route name
@{amenities}      ← Comma-separated amenities
```

#### Example Setup

```
┌─ Frame: "Bus Card @[0]" ─────────────────┐
│                                          │
│   Text: "FRESHBUS"     ← name: @{operator}
│   Text: "₹850"         ← name: @{price}
│   Text: "A/C Sleeper"  ← name: @{busType}
│   Text: "4.5 ★"        ← name: @{rating}
│                                          │
└──────────────────────────────────────────┘
```

Duplicate this card and change `@[0]` to `@[1]`, `@[2]`, etc.

---

## Which Mode Should I Use?

| Mode | Speed | Data Available | Notes |
|------|-------|----------------|-------|
| ⚡ **Auto (Recommended)** | ~2 seconds | Everything | Direct API with fallback |
| 🔄 XHR Intercept | ~15 seconds | Everything | Browser-based, reliable |
| 📊 DataLayer | ~15 seconds | Limited | No duration/times |
| 📝 Selectors | ~15 seconds | Custom | Manual, fragile |

**Recommendation:** Use **Auto** mode (default) - it's 10x faster and has automatic fallback!

---

## Troubleshooting

**"Network error: Failed to fetch":**
→ Make sure you started the server first! Double-click `START_SERVER.command`

**"API not configured" message:**
→ Internal API isn't ready yet. Use DataLayer mode instead.

**Nothing happens when I click "Apply":**
→ Make sure your Figma layers are named correctly (`@[0]`, `@{operator}`, etc.)

**Data doesn't match my frames:**
→ Check that frame indices match: `@[0]` gets the first result, `@[1]` gets second, etc.

**Server window closed accidentally:**
→ Just double-click `START_SERVER.command` again

---

## Need Help?

Contact the UX Tooling team or check the [API_SPECIFICATION.md](API_SPECIFICATION.md) for technical details.
