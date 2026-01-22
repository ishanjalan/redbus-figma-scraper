# Setup Guide for Designers

This guide will help you get the RedBus Data Sync plugin running in under 5 minutes.

---

## Step 1: Start the Server

### Option A: Desktop App (Easiest)

1. **Download** the "RedBus Data Server" app
2. **Double-click** to open
3. Wait for "Server Running" status

That's it! Keep this app open while using Figma.

### Option B: Terminal Command

If you're comfortable with Terminal:

```bash
cd vercel-backend
npm run dev
```

---

## Step 2: Install the Figma Plugin

1. Open Figma Desktop
2. Go to **Menu → Plugins → Development → Import plugin from manifest**
3. Select the `figma-plugin/manifest.json` file
4. The plugin is now installed!

---

## Step 3: Name Your Layers

### Frame Naming

Name your card frames with `@[N]` where N is the index (starting from 0):

```
📁 Card @[0]    ← First bus
📁 Card @[1]    ← Second bus  
📁 Card @[2]    ← Third bus
```

### Text Layer Naming

Name your text layers with `@{fieldName}`:

```
📁 Card @[0]
  └── 📝 @{operator}        ← Will show "FRESHBUS"
  └── 📝 @{priceFormatted}  ← Will show "₹788"
  └── 📝 @{departureTime}   ← Will show "22:30"
  └── 📝 @{rating}          ← Will show "4.7"
```

---

## Step 4: Sync Data

1. Open the plugin: **Plugins → RedBus Data Sync**
2. Paste a RedBus search URL
3. Click **Sync Now**
4. Watch your design fill with live data!

---

## Available Fields

| Layer Name | What it shows | Example |
|------------|---------------|---------|
| `@{operator}` | Bus company | FRESHBUS |
| `@{busType}` | Bus type | A/C Sleeper (2+1) |
| `@{departureTime}` | Departure | 22:30 |
| `@{arrivalTime}` | Arrival | 05:45 |
| `@{duration}` | Travel time | 7h 15m |
| `@{priceFormatted}` | Ticket price | ₹788 |
| `@{originalPriceFormatted}` | Original price | ₹831 |
| `@{discount}` | Discount | 5% OFF |
| `@{rating}` | Rating | 4.7 |
| `@{numberOfReviews}` | Review count | 779 |
| `@{seatsAvailable}` | Available seats | 33 |
| `@{boardingPoint}` | Pickup point | Central Silk Board |
| `@{droppingPoint}` | Drop point | RTC Bus Stand |
| `@{tags}` | Tags | Live Tracking |
| `@{offerTag}` | Offer text | Exclusive 7.5% OFF |

---

## Tips

### Batch Mode
Paste multiple URLs (one per line) to fetch data from different routes at once.

### Save Presets
Click "Save as Preset" to save frequently used routes for quick access.

### History
Check the History tab to quickly reload recent fetches.

---

## Troubleshooting

### "Server not running"

Make sure the RedBus Data Server app is open and shows "Server Running".

### "No buses found"

- Check if the URL is a valid RedBus search URL
- Make sure the date is in the future
- Try a different route

### "No @{selector} layers found"

- Select the frames you want to update
- Make sure layers are named with `@{fieldName}` format
- Check the "Apply to" dropdown (Selection vs Page)

---

## Need Help?

Reach out to the UX team or check the project repository for more documentation.
