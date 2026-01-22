# 🚌 RedBus Figma Plugin - Setup Guide

Sync live bus data from RedBus directly into your Figma designs. **No server needed!**

---

## 🚀 Quick Start (2 Steps!)

### Step 1: Install the Plugin
1. Open Figma Desktop
2. Go to **Menu → Plugins → Development → Import plugin from manifest**
3. Select `figma-plugin/manifest.json`

### Step 2: Use It!
1. Right-click → **Plugins → RedBus Data Sync**
2. Paste any RedBus search URL
3. Click **⚡ Fetch & Apply**

**That's it!** 🎉

---

## 🎨 Setting Up Your Figma Frames

For the plugin to fill your designs with bus data, name your layers like this:

### Frame Names (for each bus card)
```
Card @[0]    ← First bus
Card @[1]    ← Second bus  
Card @[2]    ← Third bus
...
```

### Text Layer Names (inside each card)
```
@{operator}       ← Bus company name (e.g., "FRESHBUS")
@{price}          ← Price (e.g., "₹850")
@{busType}        ← Bus type (e.g., "A/C Sleeper (2+1)")
@{rating}         ← Star rating (e.g., "4.5")
@{departureTime}  ← Departure (e.g., "22:30")
@{arrivalTime}    ← Arrival (e.g., "05:45")
@{duration}       ← Duration (e.g., "7h 15m")
@{seatsAvailable} ← Seats left (e.g., "23")
@{route}          ← Route name
@{amenities}      ← Features (e.g., "WiFi, Charging")
```

### Example Structure
```
┌─ Frame: "Bus Card @[0]" ─────────────────┐
│                                          │
│   Text: "FRESHBUS"     ← name: @{operator}
│   Text: "₹850"         ← name: @{price}
│   Text: "22:30"        ← name: @{departureTime}
│   Text: "05:45"        ← name: @{arrivalTime}
│   Text: "7h 15m"       ← name: @{duration}
│   Text: "4.5 ★"        ← name: @{rating}
│                                          │
└──────────────────────────────────────────┘
```

Duplicate this card and change `@[0]` to `@[1]`, `@[2]`, etc.

---

## 📋 Supported URLs

Any RedBus search results URL works:

```
https://www.redbus.in/bus-tickets/bangalore-to-tirupathi?fromCityId=122&toCityId=71756&onward=23-Jan-2026
https://www.redbus.in/bus-tickets/bangalore-to-chennai?fromCityId=122&toCityId=123&onward=24-Jan-2026
https://www.redbus.in/bus-tickets/hyderabad-to-pune?fromCityId=124&toCityId=130&onward=25-Jan-2026
```

---

## ❓ Troubleshooting

**"Invalid RedBus URL" error:**
→ Make sure the URL contains `fromCityId`, `toCityId`, and a date parameter (`onward` or `doj`)

**Nothing happens when I click "Apply":**
→ Make sure your Figma layers are named correctly (`@[0]`, `@{operator}`, etc.)

**Data doesn't match my frames:**
→ Check that frame indices match: `@[0]` gets the first result, `@[1]` gets second, etc.

---

## 🔧 First-Time Setup (For Developers)

If you're setting this up for the first time:

```bash
# Clone the repository
git clone https://github.com/ishanjalan/redbus-figma-scraper.git
cd redbus-figma-scraper

# Install plugin dependencies and build
cd figma-plugin
npm install
npm run build
```

Then share the `figma-plugin` folder with your team.

---

## 📞 Need Help?

Contact the UX Tooling team or open an issue on GitHub.
