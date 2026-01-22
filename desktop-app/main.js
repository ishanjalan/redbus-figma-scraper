const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let server = null;

const PORT = 3000;

// Create the server
function startServer() {
    const express = require('express');
    const cors = require('cors');
    const serverApp = express();

    serverApp.use(cors());
    serverApp.use(express.json());

    // Health endpoint
    serverApp.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            service: 'RedBus Data Server (Desktop)'
        });
    });

    // Scrape endpoint - calls RedBus API directly
    serverApp.post('/api/scrape', async (req, res) => {
        const { url, options = {} } = req.body;
        
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        try {
            const result = await fetchBusData(url, options);
            res.json(result);
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message,
                errors: [error.message]
            });
        }
    });

    server = serverApp.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: true, port: PORT });
        }
    });

    server.on('error', (err) => {
        console.error('Server error:', err);
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false, error: err.message });
        }
    });
}

// Fetch bus data from RedBus API
async function fetchBusData(urlString, options = {}) {
    const fetch = require('node-fetch');
    const startTime = Date.now();
    
    try {
        // Parse URL to extract params
        const urlObj = new URL(urlString);
        const fromCityId = urlObj.searchParams.get('fromCityId');
        const toCityId = urlObj.searchParams.get('toCityId');
        const journeyDate = urlObj.searchParams.get('onward') || urlObj.searchParams.get('doj');

        if (!fromCityId || !toCityId || !journeyDate) {
            throw new Error('Invalid RedBus URL');
        }

        const limit = options.maxResults || 20;
        
        // Build API URL
        const apiParams = new URLSearchParams({
            fromCity: fromCityId,
            toCity: toCityId,
            DOJ: journeyDate,
            limit: String(limit),
            offset: '0',
            meta: 'true',
        });

        const apiUrl = `https://www.redbus.in/rpw/api/searchResults?${apiParams}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error('API returned unsuccessful response');
        }

        const inventories = data.data?.inventories || [];
        const items = inventories.map(bus => transformBusData(bus));

        return {
            success: true,
            url: urlString,
            dataLayerItems: items,
            totalItemsFound: data.data?.metaData?.totalCount || items.length,
            timing: { total: Date.now() - startTime },
            extractionMode: 'direct'
        };

    } catch (error) {
        return {
            success: false,
            url: urlString,
            dataLayerItems: [],
            errors: [error.message],
            timing: { total: Date.now() - startTime }
        };
    }
}

// Transform bus data
function transformBusData(bus) {
    const fareList = bus.fareList || [];
    const price = typeof fareList[0] === 'number' ? fareList[0] : 0;
    const originalPrice = fareList[1] || fareList[0] || price;
    const discountPercent = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

    // Parse times
    const depMatch = (bus.departureTime || '').match(/(\d{2}):(\d{2})/);
    const arrMatch = (bus.arrivalTime || '').match(/(\d{2}):(\d{2})/);
    const depTime = depMatch ? `${depMatch[1]}:${depMatch[2]}` : '';
    const arrTime = arrMatch ? `${arrMatch[1]}:${arrMatch[2]}` : '';

    // Calculate duration
    let durationMins = bus.journeyDurationMin || 0;
    if (!durationMins && depMatch && arrMatch) {
        let depMins = parseInt(depMatch[1]) * 60 + parseInt(depMatch[2]);
        let arrMins = parseInt(arrMatch[1]) * 60 + parseInt(arrMatch[2]);
        if (arrMins < depMins) arrMins += 24 * 60;
        durationMins = arrMins - depMins;
    }
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const duration = durationMins > 0 ? `${hours}h ${mins}m` : '';

    return {
        id: String(bus.routeId || bus.serviceId || ''),
        operator: bus.travelsName || '',
        operatorId: String(bus.operatorId || ''),
        serviceName: bus.serviceName || '',
        busType: bus.busType || '',
        isAc: bus.isAc || false,
        isSleeper: (bus.busType || '').toLowerCase().includes('sleeper'),
        isSeater: bus.isSeater || false,
        isElectricVehicle: bus.isElectricVehicle || false,
        departureTime: depTime,
        arrivalTime: arrTime,
        duration: duration,
        durationMinutes: durationMins,
        price: price,
        priceFormatted: `₹${price.toLocaleString('en-IN')}`,
        originalPrice: originalPrice,
        originalPriceFormatted: originalPrice > price ? `₹${originalPrice.toLocaleString('en-IN')}` : '',
        discount: discountPercent > 0 ? `${discountPercent}% OFF` : '',
        rating: String(bus.totalRatings || 0),
        numberOfReviews: bus.numberOfReviews || 0,
        seatsAvailable: bus.availableSeats || 0,
        totalSeats: bus.totalSeats || 0,
        singleSeats: bus.availableWindowSeats || 0,
        windowSeats: bus.availableWindowSeats || 0,
        boardingPoint: bus.standardBpName || '',
        droppingPoint: bus.standardDpName || '',
        viaRoute: bus.viaRt || '',
        tags: bus.isLiveTrackingAvailable ? ['Live Tracking'] : [],
        isPrimo: bus.rdBoostInfo?.isPrimo || false,
        isLiveTracking: bus.isLiveTrackingAvailable || false,
        offerTag: bus.operatorOfferCampaign?.title || '',
        amenities: [],
        cancellationPolicy: bus.cancellationPolicy || ''
    };
}

// Create window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 500,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png'),
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    mainWindow.on('close', (event) => {
        // Hide instead of close
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

// Create tray icon
function createTray() {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Show Window', 
            click: () => mainWindow.show() 
        },
        { 
            label: 'Open Figma', 
            click: () => shell.openExternal('https://www.figma.com') 
        },
        { type: 'separator' },
        { 
            label: `Server: localhost:${PORT}`,
            enabled: false
        },
        { type: 'separator' },
        { 
            label: 'Quit', 
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('RedBus Data Server');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        mainWindow.show();
    });
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    createTray();
    startServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });
});

app.on('window-all-closed', () => {
    // Don't quit on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (server) {
        server.close();
    }
});
