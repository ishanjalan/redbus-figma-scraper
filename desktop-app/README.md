# RedBus Data Server (Desktop App)

A standalone desktop application that runs the backend server for the RedBus Figma Plugin. Designers simply double-click to start - no terminal commands needed.

## Features

- **One-click startup** - Just double-click to run
- **System tray integration** - Minimizes to menu bar
- **Auto-start** - Can be configured to start with login
- **Cross-platform** - Works on macOS, Windows, and Linux

## For Designers

### Installation

1. Download the app for your platform:
   - **macOS**: `RedBus Data Server.dmg`
   - **Windows**: `RedBus Data Server Setup.exe`

2. Install and launch the app

3. Keep it running while using the Figma plugin

### Usage

1. Launch "RedBus Data Server"
2. You'll see a green "Server Running" status
3. Open Figma and use the RedBus Data Sync plugin
4. You can minimize the app - it stays in the menu bar

## For Developers

### Building the App

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for all platforms
npm run build
```

### Creating an Icon

Before building, add an `icon.png` file (512x512 recommended) to this directory.

### Distribution

After building, distributable files will be in the `dist/` folder:

- **macOS**: `.dmg` and `.zip`
- **Windows**: `.exe` installer and portable version
- **Linux**: `.AppImage` and `.deb`

## Technical Details

- Built with Electron
- Embeds a Node.js/Express server
- Calls RedBus API directly (no browser automation)
- Runs on port 3000 by default
