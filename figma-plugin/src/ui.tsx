import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './ui.css';
import { fetchBusListings, isApiConfigured, BusListing } from './services/redbus-api';

// Types
type SyncScope = 'document' | 'page' | 'selection';
type ExtractionMode = 'auto' | 'api' | 'xhr' | 'dataLayer' | 'selector';

interface DetectedLayer {
    id: string;
    name: string;
    selector: string;
    type: 'text' | 'image';
    modifier?: string;
}

interface ScrapeResult {
    id: string;
    found: boolean;
    data?: string;
    type: 'text' | 'image';
    bytes?: Uint8Array;
    error?: string;
    originalId?: string;
    index?: number;
}

interface DataLayerItem {
    [key: string]: any;
}

// BusListing is imported from redbus-api.ts

// ============================================================
// 🔧 CONFIGURATION - Update these URLs after deployment
// ============================================================

// Scraper Backend URL - Update this after deploying to Vercel
// Example: 'https://redbus-figma-scraper.vercel.app'
// For local development, use localhost. For production, deploy to Vercel and update this URL.
const SCRAPER_API_URL = 'http://localhost:3000';

// Internal API URL - Will be provided by Engineering team
const INTERNAL_API_URL = 'https://api-internal.redbus.in';

// ============================================================

// Available dataLayer presets
const DATALAYER_PRESETS = [
    { id: 'redbus', name: 'RedBus (Bus Listings)', fields: ['operator', 'busType', 'rating', 'price', 'features', 'route'] },
    { id: 'products', name: 'E-commerce Products', fields: ['id', 'name', 'brand', 'price'] },
    { id: 'ecommerce_ga4', name: 'GA4 E-commerce', fields: ['id', 'name', 'brand', 'category', 'price'] },
];

// API/XHR mode available fields (complete data)
const COMPLETE_DATA_FIELDS = [
    'operator', 'busType', 'departureTime', 'arrivalTime', 'duration',
    'price', 'priceFormatted', 'rating', 'seatsAvailable', 'route', 'amenities',
    'boardingPoints', 'droppingPoints', 'totalRatings', 'isAc', 'isSleeper'
];

// DataLayer mode fields (limited)
const DATALAYER_FIELDS = [
    'operator', 'busType', 'rating', 'price', 'features', 'route'
];

const App = () => {
    const [url, setUrl] = React.useState('https://example.com');
    const [scope, setScope] = React.useState<SyncScope>('selection');
    const [waitForJs, setWaitForJs] = React.useState(true);
    const [includeImages, setIncludeImages] = React.useState(true);
    const [detectedLayers, setDetectedLayers] = React.useState<DetectedLayer[]>([]);
    const [selectedLayers, setSelectedLayers] = React.useState<Set<string>>(new Set());
    const [loading, setLoading] = React.useState(false);
    const [scanning, setScanning] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<string | null>(null);
    
    // Extraction mode state - 'auto' uses fastest method with fallback
    const [extractionMode, setExtractionMode] = React.useState<ExtractionMode>('auto');
    const [dataLayerPreset, setDataLayerPreset] = React.useState('redbus');
    const [maxItems, setMaxItems] = React.useState(10);
    const [dataLayerItems, setDataLayerItems] = React.useState<DataLayerItem[]>([]);
    
    // API mode state
    const [apiItems, setApiItems] = React.useState<BusListing[]>([]);
    const [apiConfigured, setApiConfigured] = React.useState(false); // Will be true when internal API is available
    
    // XHR mode state (uses same dataLayerItems for storage)
    const [xhrItems, setXhrItems] = React.useState<DataLayerItem[]>([]);

    // Listen for messages from code.ts
    React.useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            const msg = event.data?.pluginMessage;
            if (!msg) return;

            if (msg.type === 'layers-found') {
                setDetectedLayers(msg.layers);
                setSelectedLayers(new Set(msg.layers.map((l: DetectedLayer) => l.id)));
                setScanning(false);
            } else if (msg.type === 'fetch-data') {
                // Fetch data from API (selector mode)
                try {
                    setStatus('Scraping website...');
                    const response = await fetch(`${SCRAPER_API_URL}/api/scrape`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: msg.url,
                            selectors: msg.selectors,
                            options: { waitForJs, timeout: 30000 },
                        }),
                    });
                    const data = await response.json();

                    if (data.success) {
                        setStatus('Processing results...');
                        // Process images if needed
                        const processedResults: ScrapeResult[] = await Promise.all(
                            data.results.map(async (result: any) => {
                                if (result.type === 'image' && result.found && result.data && includeImages) {
                                    try {
                                        const imgRes = await fetch(result.data);
                                        const buffer = await imgRes.arrayBuffer();
                                        return { ...result, bytes: new Uint8Array(buffer) };
                                    } catch (e) {
                                        console.error('Image fetch failed:', e);
                                        return { ...result, found: false, error: 'Image fetch failed' };
                                    }
                                }
                                return result;
                            })
                        );
                        
                        setStatus('Applying to Figma...');
                        parent.postMessage({ pluginMessage: { type: 'apply-data', results: processedResults } }, '*');
                    } else {
                        setLoading(false);
                        setStatus(null);
                        setError(data.error || 'Scraping failed');
                    }
                } catch (err: any) {
                    setLoading(false);
                    setStatus(null);
                    setError(`Network error: ${err.message}`);
                }
            } else if (msg.type === 'sync-complete') {
                setLoading(false);
                setStatus(null);
                setError(null);
                alert(`✓ Updated ${msg.updated} layer(s)${msg.failed > 0 ? `, ${msg.failed} failed` : ''}`);
            } else if (msg.type === 'error') {
                setLoading(false);
                setStatus(null);
                setError(msg.message);
            }
        };

        window.onmessage = handleMessage;

        // Initial scan
        setTimeout(() => {
            setScanning(true);
            parent.postMessage({ pluginMessage: { type: 'scan-layers', scope: 'selection' } }, '*');
        }, 100);

        return () => {
            window.onmessage = null;
        };
    }, [waitForJs, includeImages]);

    // Fetch data using dataLayer mode
    const fetchDataLayer = async () => {
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('Extracting data from page...');

        try {
            const response = await fetch(`${SCRAPER_API_URL}/api/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    options: {
                        extractionMode: 'dataLayer',
                        dataLayerPreset,
                        maxResults: maxItems,
                        waitForJs: true,
                        timeout: 30000,
                    },
                }),
            });

            const data = await response.json();

            if (data.success && data.dataLayerItems) {
                setDataLayerItems(data.dataLayerItems);
                setStatus(`Found ${data.dataLayerItems.length} items (${data.totalItemsFound} total on page)`);
                setLoading(false);
            } else {
                setError(data.error || data.errors?.join(', ') || 'Extraction failed');
                setLoading(false);
                setStatus(null);
            }
        } catch (err: any) {
            setError(`Network error: ${err.message}`);
            setLoading(false);
            setStatus(null);
        }
    };

    // Apply dataLayer items to Figma frames
    const applyDataLayerToFigma = () => {
        if (dataLayerItems.length === 0) {
            setError('No data to apply. Fetch data first.');
            return;
        }

        setLoading(true);
        setStatus('Applying data to Figma frames...');

        // Send the dataLayer items to code.ts for application
        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items: dataLayerItems,
                scope,
            } 
        }, '*');
    };

    // Fetch data using internal API
    const fetchFromApi = async () => {
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        // Parse city IDs and date from URL
        let urlObj: URL;
        try {
            urlObj = new URL(url.trim());
        } catch {
            setError('Invalid URL format');
            return;
        }
        
        const fromCityId = urlObj.searchParams.get('fromCityId');
        const toCityId = urlObj.searchParams.get('toCityId');
        const journeyDate = urlObj.searchParams.get('onward') || urlObj.searchParams.get('doj');

        if (!fromCityId || !toCityId || !journeyDate) {
            setError('URL must contain fromCityId, toCityId, and date parameters');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('Fetching data from internal API...');

        try {
            if (!isApiConfigured()) {
                setApiConfigured(false);
                setError('Internal API not configured. Please contact Engineering team or use DataLayer/Selector mode as fallback.');
                setLoading(false);
                setStatus(null);
                return;
            }

            setApiConfigured(true);
            const buses = await fetchBusListings({
                fromCityId: parseInt(fromCityId),
                toCityId: parseInt(toCityId),
                date: journeyDate,
                maxResults: maxItems,
            });

            setApiItems(buses);
            setStatus(`Found ${buses.length} buses`);
            setLoading(false);
        } catch (err: any) {
            setError(`API error: ${err.message}`);
            setLoading(false);
            setStatus(null);
        }
    };

    // Apply API items to Figma frames
    const applyApiToFigma = () => {
        if (apiItems.length === 0) {
            setError('No data to apply. Fetch data first.');
            return;
        }

        setLoading(true);
        setStatus('Applying data to Figma frames...');

        // Convert API items to the same format used by dataLayer
        const items = apiItems.map(bus => ({
            id: bus.id,
            operator: bus.operator,
            busType: bus.busType,
            departureTime: bus.departureTime,
            arrivalTime: bus.arrivalTime,
            duration: bus.duration,
            price: bus.priceFormatted,
            rating: bus.rating,
            seatsAvailable: String(bus.seatsAvailable),
            route: bus.route,
            amenities: bus.amenities?.join(', ') || '',
        }));

        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items,
                scope,
            } 
        }, '*');
    };

    // Fetch data using auto/XHR mode (direct API with fallback)
    const fetchViaXhr = async () => {
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus(extractionMode === 'auto' 
            ? '⚡ Fetching data (direct API)...' 
            : '🔄 Extracting data via browser...');

        try {
            const response = await fetch(`${SCRAPER_API_URL}/api/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    options: {
                        extractionMode: extractionMode === 'auto' ? 'auto' : 'xhr',
                        xhrPreset: 'redbus',
                        maxResults: maxItems,
                        waitForJs: true,
                        timeout: 45000,
                        fallbackOnError: true,
                    },
                }),
            });

            const data = await response.json();

            if (data.success && data.dataLayerItems && data.dataLayerItems.length > 0) {
                setXhrItems(data.dataLayerItems);
                const modeUsed = data.extractionMode === 'direct' ? '⚡ Direct API' : '🔄 Browser';
                const timing = data.timing?.total ? ` in ${(data.timing.total / 1000).toFixed(1)}s` : '';
                setStatus(`✅ ${modeUsed}: Found ${data.dataLayerItems.length} buses${timing}`);
                setLoading(false);
            } else if (data.success && (!data.dataLayerItems || data.dataLayerItems.length === 0)) {
                setError('No bus data found. Check the URL or try a different route.');
                setLoading(false);
                setStatus(null);
            } else {
                setError(data.error || data.errors?.join(', ') || 'Extraction failed');
                setLoading(false);
                setStatus(null);
            }
        } catch (err: any) {
            setError(`Network error: ${err.message}`);
            setLoading(false);
            setStatus(null);
        }
    };

    // Apply XHR items to Figma frames
    const applyXhrToFigma = () => {
        if (xhrItems.length === 0) {
            setError('No data to apply. Fetch data first.');
            return;
        }

        setLoading(true);
        setStatus('Applying data to Figma frames...');

        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items: xhrItems,
                scope,
            } 
        }, '*');
    };

    const handleScan = () => {
        setScanning(true);
        setError(null);
        parent.postMessage({ pluginMessage: { type: 'scan-layers', scope } }, '*');
    };

    const handleSync = () => {
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }
        setLoading(true);
        setError(null);
        setStatus('Starting sync...');
        parent.postMessage({ 
            pluginMessage: { 
                type: 'sync', 
                url: url.trim(), 
                scope,
                options: { waitForJs, includeImages, timeout: 30000 }
            } 
        }, '*');
    };

    const toggleLayer = (id: string) => {
        setSelectedLayers(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="container">
            <header className="header">
                <h1>🌐 Web Scraper Sync</h1>
            </header>

            {/* URL Input */}
            <div className="section">
                <label className="section-label">Website URL</label>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="url-input"
                />
            </div>

            {/* Extraction Mode Toggle */}
            <div className="section">
                <label className="section-label">Data Source</label>
                <div className="mode-buttons">
                    <button
                        className={`mode-btn ${extractionMode === 'auto' ? 'active recommended' : ''}`}
                        onClick={() => setExtractionMode('auto')}
                    >
                        <span className="mode-icon">⚡</span>
                        <span className="mode-label">Auto (Fastest)</span>
                        <span className="mode-tag">Recommended</span>
                    </button>
                    <button
                        className={`mode-btn ${extractionMode === 'xhr' ? 'active' : ''}`}
                        onClick={() => setExtractionMode('xhr')}
                    >
                        <span className="mode-icon">🔄</span>
                        <span className="mode-label">XHR Intercept</span>
                        <span className="mode-tag fallback">Browser</span>
                    </button>
                    <button
                        className={`mode-btn ${extractionMode === 'dataLayer' ? 'active' : ''}`}
                        onClick={() => setExtractionMode('dataLayer')}
                    >
                        <span className="mode-icon">📊</span>
                        <span className="mode-label">DataLayer</span>
                        <span className="mode-tag fallback">Limited</span>
                    </button>
                    <button
                        className={`mode-btn ${extractionMode === 'selector' ? 'active' : ''}`}
                        onClick={() => setExtractionMode('selector')}
                    >
                        <span className="mode-icon">📝</span>
                        <span className="mode-label">Selectors</span>
                        <span className="mode-tag fallback">Manual</span>
                    </button>
                </div>
                <div className="mode-hint">
                    {extractionMode === 'auto'
                        ? '⚡ Direct API (~2s) with automatic fallback to browser if needed'
                        : extractionMode === 'xhr'
                        ? '🔄 Browser-based API interception (~15s) - complete data'
                        : extractionMode === 'dataLayer'
                        ? '📊 Extract from analytics - limited fields (no duration/times)'
                        : '📝 Manual CSS selectors - flexible but fragile'}
                </div>
            </div>

            {/* Scope */}
            <div className="section">
                <label className="section-label">Sync Scope</label>
                <div className="scope-buttons">
                    {(['selection', 'page', 'document'] as SyncScope[]).map((s) => (
                        <button
                            key={s}
                            className={`scope-btn ${scope === s ? 'active' : ''}`}
                            onClick={() => {
                                setScope(s);
                                setScanning(true);
                                parent.postMessage({ pluginMessage: { type: 'scan-layers', scope: s } }, '*');
                            }}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Auto/XHR Mode UI - both use complete data */}
            {(extractionMode === 'auto' || extractionMode === 'xhr') && (
                <>
                    <div className="section">
                        <label className="section-label">Available Fields (Complete Data!)</label>
                        <div className="api-fields">
                            {COMPLETE_DATA_FIELDS.slice(0, 10).map((field) => (
                                <span key={field} className="api-field-tag">{field}</span>
                            ))}
                        </div>
                    </div>

                    <div className="section">
                        <label className="section-label">Max Results</label>
                        <input
                            type="number"
                            value={maxItems}
                            onChange={(e) => setMaxItems(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                            min={1}
                            max={50}
                            className="max-items-input"
                        />
                    </div>

                    {/* XHR Data Preview */}
                    {xhrItems.length > 0 && (
                        <div className="section">
                            <label className="section-label">
                                Fetched Data <span className="layer-count success">({xhrItems.length} buses)</span>
                            </label>
                            <div className="data-preview">
                                {xhrItems.slice(0, 5).map((bus, idx) => (
                                    <div key={idx} className="data-item">
                                        <span className="data-index">#{idx + 1}</span>
                                        <div className="data-fields">
                                            <span className="data-field"><strong>operator:</strong> {bus.operator}</span>
                                            <span className="data-field"><strong>time:</strong> {bus.departureTime} → {bus.arrivalTime} ({bus.duration})</span>
                                            <span className="data-field"><strong>price:</strong> {bus.priceFormatted || `₹${bus.price}`}</span>
                                        </div>
                                    </div>
                                ))}
                                {xhrItems.length > 5 && (
                                    <div className="data-more">...and {xhrItems.length - 5} more</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="section">
                        <div className="datalayer-hint">
                            <strong>💡 How to use:</strong>
                            <ol>
                                <li>Create card frames named <code>Card @[0]</code>, <code>Card @[1]</code>, etc.</li>
                                <li>Inside each card, name text layers like <code>@{'{operator}'}</code>, <code>@{'{departureTime}'}</code>, <code>@{'{duration}'}</code></li>
                                <li>Click "Fetch Data" then "Apply to Figma"</li>
                            </ol>
                        </div>
                    </div>
                </>
            )}

            {/* API Mode UI */}
            {extractionMode === 'api' && (
                <>
                    {!apiConfigured && (
                        <div className="section">
                            <div className="api-notice">
                                <span className="notice-icon">⚠️</span>
                                <div className="notice-content">
                                    <strong>API Not Configured</strong>
                                    <p>The internal API endpoint is not yet available. Please contact the Engineering team to set up the endpoint, or use DataLayer/Selectors mode as a fallback.</p>
                                    <a href="#" onClick={(e) => { e.preventDefault(); setExtractionMode('dataLayer'); }}>
                                        Switch to DataLayer mode →
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="section">
                        <label className="section-label">Available Fields</label>
                        <div className="api-fields">
                            {COMPLETE_DATA_FIELDS.slice(0, 10).map((field) => (
                                <span key={field} className="api-field-tag">{field}</span>
                            ))}
                        </div>
                    </div>

                    <div className="section">
                        <label className="section-label">Max Results</label>
                        <input
                            type="number"
                            value={maxItems}
                            onChange={(e) => setMaxItems(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                            min={1}
                            max={50}
                            className="max-items-input"
                        />
                    </div>

                    {/* API Data Preview */}
                    {apiItems.length > 0 && (
                        <div className="section">
                            <label className="section-label">
                                Fetched Data <span className="layer-count">({apiItems.length} buses)</span>
                            </label>
                            <div className="data-preview">
                                {apiItems.slice(0, 5).map((bus, idx) => (
                                    <div key={idx} className="data-item">
                                        <span className="data-index">#{idx + 1}</span>
                                        <div className="data-fields">
                                            <span className="data-field"><strong>operator:</strong> {bus.operator}</span>
                                            <span className="data-field"><strong>time:</strong> {bus.departureTime} → {bus.arrivalTime}</span>
                                            <span className="data-field"><strong>price:</strong> {bus.priceFormatted}</span>
                                        </div>
                                    </div>
                                ))}
                                {apiItems.length > 5 && (
                                    <div className="data-more">...and {apiItems.length - 5} more</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="section">
                        <div className="datalayer-hint">
                            <strong>💡 How to use:</strong>
                            <ol>
                                <li>Create card frames named <code>Card @[0]</code>, <code>Card @[1]</code>, etc.</li>
                                <li>Inside each card, name text layers like <code>@{'{operator}'}</code>, <code>@{'{departureTime}'}</code></li>
                                <li>Click "Fetch Data" then "Apply to Figma"</li>
                            </ol>
                        </div>
                    </div>
                </>
            )}

            {/* DataLayer Mode UI */}
            {extractionMode === 'dataLayer' && (
                <>
                    <div className="section">
                        <label className="section-label">Data Preset</label>
                        <select 
                            className="preset-select"
                            value={dataLayerPreset}
                            onChange={(e) => setDataLayerPreset(e.target.value)}
                        >
                            {DATALAYER_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name}
                                </option>
                            ))}
                        </select>
                        <div className="preset-fields">
                            Fields: {DATALAYER_PRESETS.find(p => p.id === dataLayerPreset)?.fields.join(', ')}
                        </div>
                    </div>

                    <div className="section">
                        <label className="section-label">Max Items</label>
                        <input
                            type="number"
                            value={maxItems}
                            onChange={(e) => setMaxItems(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                            min={1}
                            max={50}
                            className="max-items-input"
                        />
                    </div>

                    {/* Data Preview */}
                    {dataLayerItems.length > 0 && (
                        <div className="section">
                            <label className="section-label">
                                Extracted Data <span className="layer-count">({dataLayerItems.length} items)</span>
                            </label>
                            <div className="data-preview">
                                {dataLayerItems.slice(0, 5).map((item, idx) => (
                                    <div key={idx} className="data-item">
                                        <span className="data-index">#{idx + 1}</span>
                                        <div className="data-fields">
                                            {Object.entries(item).slice(0, 3).map(([key, value]) => (
                                                <span key={key} className="data-field">
                                                    <strong>{key}:</strong> {String(value).slice(0, 30)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {dataLayerItems.length > 5 && (
                                    <div className="data-more">...and {dataLayerItems.length - 5} more</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="section">
                        <div className="datalayer-hint">
                            <strong>💡 How to use:</strong>
                            <ol>
                                <li>Create card frames named <code>Card @[0]</code>, <code>Card @[1]</code>, etc.</li>
                                <li>Inside each card, name text layers like <code>@{'{operator}'}</code>, <code>@{'{price}'}</code></li>
                                <li>Click "Fetch Data" then "Apply to Figma"</li>
                            </ol>
                        </div>
                    </div>
                </>
            )}

            {/* Selector Mode: Detected Layers */}
            {extractionMode === 'selector' && (
                <div className="section">
                    <div className="section-header">
                        <label className="section-label">
                            Detected Layers <span className="layer-count">({scanning ? '...' : detectedLayers.length})</span>
                        </label>
                        <button className="rescan-btn" onClick={handleScan} disabled={scanning}>
                            ↻ Rescan
                        </button>
                    </div>
                    <div className="layers-list">
                        {scanning ? (
                            <div className="layers-empty">Scanning...</div>
                        ) : detectedLayers.length === 0 ? (
                            <div className="layers-empty">
                                <div>No @{'{selector}'} layers found</div>
                                <div className="empty-hint">
                                    Name layers like: <code>Title @{'{h1}'}</code>
                                </div>
                            </div>
                        ) : (
                            detectedLayers.map((layer) => (
                                <div
                                    key={layer.id}
                                    className={`layer-item ${selectedLayers.has(layer.id) ? 'selected' : ''}`}
                                    onClick={() => toggleLayer(layer.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedLayers.has(layer.id)}
                                        onChange={() => toggleLayer(layer.id)}
                                    />
                                    <div className="layer-info">
                                        <span className="layer-name">{layer.name || 'Unnamed'}</span>
                                        <span className="layer-selector">
                                            @{`{${layer.selector}}`}
                                            {layer.modifier && `.${layer.modifier}`}
                                        </span>
                                    </div>
                                    <span className="layer-type">{layer.type === 'image' ? '🖼️' : '📝'}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Options (selector mode only) */}
            {extractionMode === 'selector' && (
                <div className="section">
                    <label className="section-label">Options</label>
                    <div className="options-list">
                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={waitForJs}
                                onChange={(e) => setWaitForJs(e.target.checked)}
                            />
                            <span>Wait for JavaScript</span>
                        </label>
                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={includeImages}
                                onChange={(e) => setIncludeImages(e.target.checked)}
                            />
                            <span>Include images</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="error-banner">
                    ⚠️ {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Status */}
            {status && <div className="status-text">{status}</div>}

            {/* Action Buttons */}
            {extractionMode === 'selector' ? (
                <button
                    className="sync-btn"
                    onClick={handleSync}
                    disabled={loading || selectedLayers.size === 0}
                >
                    {loading ? '⏳ Syncing...' : '🔄 Sync Content'}
                </button>
            ) : (extractionMode === 'auto' || extractionMode === 'xhr') ? (
                <div className="button-group">
                    <button
                        className="sync-btn secondary"
                        onClick={fetchViaXhr}
                        disabled={loading}
                    >
                        {loading && !xhrItems.length ? '⏳ Fetching...' : '⚡ Fetch Data'}
                    </button>
                    <button
                        className="sync-btn"
                        onClick={applyXhrToFigma}
                        disabled={loading || xhrItems.length === 0}
                    >
                        {loading && xhrItems.length > 0 ? '⏳ Applying...' : '✨ Apply to Figma'}
                    </button>
                </div>
            ) : extractionMode === 'api' ? (
                <div className="button-group">
                    <button
                        className="sync-btn secondary"
                        onClick={fetchFromApi}
                        disabled={loading}
                    >
                        {loading && !apiItems.length ? '⏳ Fetching...' : '📥 Fetch Data'}
                    </button>
                    <button
                        className="sync-btn"
                        onClick={applyApiToFigma}
                        disabled={loading || apiItems.length === 0}
                    >
                        {loading && apiItems.length > 0 ? '⏳ Applying...' : '✨ Apply to Figma'}
                    </button>
                </div>
            ) : (
                <div className="button-group">
                    <button
                        className="sync-btn secondary"
                        onClick={fetchDataLayer}
                        disabled={loading}
                    >
                        {loading && !dataLayerItems.length ? '⏳ Fetching...' : '📥 Fetch Data'}
                    </button>
                    <button
                        className="sync-btn"
                        onClick={applyDataLayerToFigma}
                        disabled={loading || dataLayerItems.length === 0}
                    >
                        {loading && dataLayerItems.length > 0 ? '⏳ Applying...' : '✨ Apply to Figma'}
            </button>
                </div>
            )}
        </div>
    );
};

// Mount React app
const container = document.getElementById('react-page');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
