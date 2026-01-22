# RedBus Figma Data Sync

A Figma plugin that syncs live bus data from RedBus directly into your design frames.

## Overview

This plugin allows designers to:
- Fetch real-time bus data from any RedBus search URL
- Auto-populate design frames with operator names, prices, times, ratings, and more
- Batch-process multiple routes at once
- Save frequently used routes as presets

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Figma Plugin   │────▶│  Data Server    │────▶│  RedBus API     │
│  (UI + Logic)   │     │  (Local/Desktop)│     │  (Data Source)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Components

### 1. Figma Plugin (`/figma-plugin`)
The design interface that runs inside Figma.

### 2. Desktop App (`/desktop-app`)
**Recommended for designers** - A standalone app that runs the server. Just double-click to start!

### 3. Local Server (`/vercel-backend`)
For developers who prefer running the server from terminal.

## Quick Start

### Option A: Desktop App (Recommended for Designers)

1. Download and install the RedBus Data Server app
2. Launch the app (it shows "Server Running")
3. Open Figma and run the RedBus Data Sync plugin

### Option B: Local Server (For Developers)

```bash
cd vercel-backend
npm install
npm run dev
```

## Naming Your Figma Layers

### Frame Naming
Name your card frames with indices:
- `Card @[0]` - First bus
- `Card @[1]` - Second bus
- `Card @[2]` - Third bus

### Layer Naming
Name text layers with field names:
- `@{operator}` - Bus operator name
- `@{priceFormatted}` - Price (₹788)
- `@{departureTime}` - Departure time
- `@{rating}` - Rating

### Available Fields

| Field | Example | Description |
|-------|---------|-------------|
| `operator` | FRESHBUS | Operator name |
| `busType` | A/C Sleeper (2+1) | Bus type |
| `departureTime` | 22:30 | Departure time |
| `arrivalTime` | 05:45 | Arrival time |
| `duration` | 7h 15m | Travel duration |
| `priceFormatted` | ₹788 | Price with currency |
| `originalPriceFormatted` | ₹831 | Original price |
| `discount` | 5% OFF | Discount label |
| `rating` | 4.7 | Bus rating |
| `numberOfReviews` | 779 | Number of reviews |
| `seatsAvailable` | 33 | Available seats |
| `boardingPoint` | Central Silk Board | Pickup point |
| `droppingPoint` | RTC Bus Stand | Drop point |
| `tags` | Live Tracking | Bus tags |
| `offerTag` | Exclusive 7.5% OFF | Offer message |
| `isPrimo` | true | Primo status |
| `isElectricVehicle` | true | Electric bus |

## Features

### ✅ Batch URLs
Paste multiple RedBus URLs (one per line) to fetch data from multiple routes.

### ✅ Presets
Save frequently used routes for quick access.

### ✅ History
Access your last 20 fetches quickly.

### ✅ Retry Logic
Automatic retry with exponential backoff for reliability.

### ✅ Data Caching
Use cached data when offline.

### ✅ Field Mapping Preview
See which Figma layers will receive which data before applying.

## Development

### Building the Figma Plugin

```bash
cd figma-plugin
npm install
npm run build
```

### Building the Desktop App

```bash
cd desktop-app
npm install
npm run build:mac   # for macOS
npm run build:win   # for Windows
```

## Team

Built for the RedBus UX Design Team.
