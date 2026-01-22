import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './ui.css';

// Types
type SyncScope = 'document' | 'page' | 'selection';

interface BusResult {
    operator: string;
    busType: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: string;
    rating: string;
    seatsAvailable: string;
    route: string;
    amenities: string;
}

// Backend URL - local proxy server (needed for CORS)
const API_URL = 'http://localhost:3000';

// Available fields for mapping
const AVAILABLE_FIELDS = [
    // Core
    'operator', 'busType', 'serviceName',
    // Timing
    'departureTime', 'arrivalTime', 'duration',
    // Pricing
    'price', 'priceFormatted', 'originalPrice', 'originalPriceFormatted', 'discount',
    // Ratings
    'rating', 'numberOfReviews',
    // Seats
    'seatsAvailable', 'totalSeats', 'singleSeats',
    // Route
    'route', 'viaRoute', 'boardingPoint', 'droppingPoint',
    // Features
    'amenities', 'tags', 'offerTag', 'specialMessage',
    // Booleans
    'isPrimo', 'isAc', 'isSleeper', 'isElectricVehicle', 'isLiveTracking',
];

const App = () => {
    const [url, setUrl] = React.useState('');
    const [scope, setScope] = React.useState<SyncScope>('selection');
    const [maxItems, setMaxItems] = React.useState(10);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<string | null>(null);
    const [busData, setBusData] = React.useState<BusResult[]>([]);
    const [serverOnline, setServerOnline] = React.useState<boolean | null>(null);

    // Check server status on mount
    React.useEffect(() => {
        checkServer();
    }, []);

    // Listen for messages from code.ts
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg = event.data?.pluginMessage;
            if (!msg) return;

            if (msg.type === 'sync-complete') {
                setLoading(false);
                setStatus(null);
                alert(`✓ Updated ${msg.updated} layer(s)${msg.failed > 0 ? `, ${msg.failed} failed` : ''}`);
            } else if (msg.type === 'error') {
                setLoading(false);
                setStatus(null);
                setError(msg.message);
            }
        };

        window.onmessage = handleMessage;
        return () => { window.onmessage = null; };
    }, []);

    const checkServer = async () => {
        try {
            const res = await fetch(`${API_URL}/api/health`, { method: 'GET' });
            setServerOnline(res.ok);
        } catch {
            setServerOnline(false);
        }
    };

    // Fetch bus data via local proxy
    const handleFetch = async () => {
        if (!url.trim()) {
            setError('Please enter a RedBus URL');
            return;
        }

        // Validate URL has required params
        try {
            const urlObj = new URL(url.trim());
            const fromCityId = urlObj.searchParams.get('fromCityId');
            const toCityId = urlObj.searchParams.get('toCityId');
            const journeyDate = urlObj.searchParams.get('onward') || urlObj.searchParams.get('doj');

            if (!fromCityId || !toCityId || !journeyDate) {
                setError('Invalid RedBus URL. Make sure it contains fromCityId, toCityId, and date.');
                return;
            }
        } catch {
            setError('Invalid URL format');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('⚡ Fetching data...');

        try {
            const response = await fetch(`${API_URL}/api/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    options: {
                        extractionMode: 'direct',
                        maxResults: maxItems,
                    },
                }),
            });

            const data = await response.json();

            if (data.success && data.dataLayerItems && data.dataLayerItems.length > 0) {
                setBusData(data.dataLayerItems);
                const timing = data.timing?.total ? ` in ${(data.timing.total / 1000).toFixed(1)}s` : '';
                setStatus(`✅ Found ${data.dataLayerItems.length} buses${timing}`);
                setLoading(false);
            } else if (data.success && (!data.dataLayerItems || data.dataLayerItems.length === 0)) {
                setError('No buses found for this route. Try a different date or route.');
                setLoading(false);
                setStatus(null);
            } else {
                setError(data.errors?.join(', ') || data.error || 'Failed to fetch data');
                setLoading(false);
                setStatus(null);
            }
        } catch (err: any) {
            if (err.message.includes('Failed to fetch')) {
                setServerOnline(false);
                setError('Server not running. Start it first (see instructions below).');
            } else {
                setError(`Error: ${err.message}`);
            }
            setLoading(false);
            setStatus(null);
        }
    };

    // Apply data to Figma
    const handleApply = () => {
        if (busData.length === 0) {
            setError('No data to apply. Fetch data first.');
            return;
        }

        setLoading(true);
        setStatus('✨ Applying data to Figma...');

        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items: busData,
                scope,
            } 
        }, '*');
    };

    // Fetch and apply in one click
    const handleFetchAndApply = async () => {
        if (!url.trim()) {
            setError('Please enter a RedBus URL');
            return;
        }

        // Validate URL
        try {
            const urlObj = new URL(url.trim());
            const fromCityId = urlObj.searchParams.get('fromCityId');
            const toCityId = urlObj.searchParams.get('toCityId');
            const journeyDate = urlObj.searchParams.get('onward') || urlObj.searchParams.get('doj');

            if (!fromCityId || !toCityId || !journeyDate) {
                setError('Invalid RedBus URL. Make sure it contains fromCityId, toCityId, and date.');
                return;
            }
        } catch {
            setError('Invalid URL format');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('⚡ Fetching data...');

        try {
            const response = await fetch(`${API_URL}/api/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    options: {
                        extractionMode: 'direct',
                        maxResults: maxItems,
                    },
                }),
            });

            const data = await response.json();

            if (data.success && data.dataLayerItems && data.dataLayerItems.length > 0) {
                setBusData(data.dataLayerItems);
                setStatus('✨ Applying to Figma...');

                parent.postMessage({ 
                    pluginMessage: { 
                        type: 'apply-datalayer', 
                        items: data.dataLayerItems,
                        scope,
                    } 
                }, '*');
            } else if (data.success && (!data.dataLayerItems || data.dataLayerItems.length === 0)) {
                setError('No buses found for this route.');
                setLoading(false);
                setStatus(null);
            } else {
                setError(data.errors?.join(', ') || data.error || 'Failed to fetch data');
                setLoading(false);
                setStatus(null);
            }
        } catch (err: any) {
            if (err.message.includes('Failed to fetch')) {
                setServerOnline(false);
                setError('Server not running. Start it first (see instructions below).');
            } else {
                setError(`Error: ${err.message}`);
            }
            setLoading(false);
            setStatus(null);
        }
    };

    return (
        <div className="container">
            <header className="header">
                <h1>🚌 RedBus Data Sync</h1>
            </header>

            {/* Server Status */}
            {serverOnline === false && (
                <div className="server-notice">
                    <span className="notice-icon">⚠️</span>
                    <div className="notice-content">
                        <strong>Start the local server first</strong>
                        <p>Open Terminal and run:</p>
                        <code className="terminal-cmd">cd vercel-backend && npm run dev</code>
                        <button className="retry-btn" onClick={checkServer}>
                            Check Again
                        </button>
                    </div>
                </div>
            )}

            {serverOnline === true && (
                <div className="server-online">
                    ✓ Server connected
                </div>
            )}

            {/* URL Input */}
            <div className="section">
                <label className="section-label">RedBus Search URL</label>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.redbus.in/bus-tickets/bangalore-to-tirupathi?..."
                    className="url-input"
                />
                <div className="url-hint">
                    Paste any RedBus search results URL
                </div>
            </div>

            {/* Scope */}
            <div className="section">
                <label className="section-label">Apply To</label>
                <div className="scope-buttons">
                    {(['selection', 'page', 'document'] as SyncScope[]).map((s) => (
                        <button
                            key={s}
                            className={`scope-btn ${scope === s ? 'active' : ''}`}
                            onClick={() => setScope(s)}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Max Results */}
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

            {/* Available Fields */}
            <div className="section">
                <label className="section-label">Available Fields</label>
                <div className="api-fields">
                    {AVAILABLE_FIELDS.map((field) => (
                        <span key={field} className="api-field-tag">{field}</span>
                    ))}
                </div>
            </div>

            {/* Data Preview */}
            {busData.length > 0 && (
                <div className="section">
                    <label className="section-label">
                        Fetched Data <span className="layer-count success">({busData.length} buses)</span>
                    </label>
                    <div className="data-preview">
                        {busData.slice(0, 5).map((bus, idx) => (
                            <div key={idx} className="data-item">
                                <span className="data-index">#{idx + 1}</span>
                                <div className="data-fields">
                                    <span className="data-field"><strong>{bus.operator}</strong></span>
                                    <span className="data-field">{bus.departureTime} → {bus.arrivalTime} ({bus.duration})</span>
                                    <span className="data-field">{bus.price}</span>
                                </div>
                            </div>
                        ))}
                        {busData.length > 5 && (
                            <div className="data-more">...and {busData.length - 5} more</div>
                        )}
                    </div>
                </div>
            )}

            {/* Setup Instructions */}
            <div className="section">
                <div className="datalayer-hint">
                    <strong>💡 Setup your Figma frames:</strong>
                    <ol>
                        <li>Name frames: <code>Card @[0]</code>, <code>Card @[1]</code>, etc.</li>
                        <li>Name text layers: <code>@{'{operator}'}</code>, <code>@{'{departureTime}'}</code>, <code>@{'{price}'}</code></li>
                    </ol>
                </div>
            </div>

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
            <div className="button-group">
                <button
                    className="sync-btn secondary"
                    onClick={handleFetch}
                    disabled={loading || serverOnline === false}
                >
                    {loading && busData.length === 0 ? '⏳ Fetching...' : '📥 Fetch Data'}
                </button>
                <button
                    className="sync-btn"
                    onClick={handleApply}
                    disabled={loading || busData.length === 0}
                >
                    {loading && busData.length > 0 ? '⏳ Applying...' : '✨ Apply to Figma'}
                </button>
            </div>

            {/* Quick Action */}
            <button
                className="sync-btn full-width"
                onClick={handleFetchAndApply}
                disabled={loading || serverOnline === false}
            >
                {loading ? '⏳ Working...' : '⚡ Fetch & Apply'}
            </button>
        </div>
    );
};

// Mount React app
const container = document.getElementById('react-page');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
