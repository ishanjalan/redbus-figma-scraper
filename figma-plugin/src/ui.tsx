import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './ui.css';
import { fetchBusesDirect, parseRedBusUrl, BusResult } from './services/redbus-direct';

// Types
type SyncScope = 'document' | 'page' | 'selection';

// Available fields for mapping
const AVAILABLE_FIELDS = [
    'operator', 'busType', 'departureTime', 'arrivalTime', 'duration',
    'price', 'priceFormatted', 'rating', 'seatsAvailable', 'route', 'amenities'
];

const App = () => {
    const [url, setUrl] = React.useState('');
    const [scope, setScope] = React.useState<SyncScope>('selection');
    const [maxItems, setMaxItems] = React.useState(10);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<string | null>(null);
    const [busData, setBusData] = React.useState<BusResult[]>([]);

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

    // Fetch bus data directly from RedBus API
    const handleFetch = async () => {
        if (!url.trim()) {
            setError('Please enter a RedBus URL');
            return;
        }

        // Parse URL to get search params
        const params = parseRedBusUrl(url.trim());
        if (!params) {
            setError('Invalid RedBus URL. Make sure it contains fromCityId, toCityId, and date.');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('⚡ Fetching data from RedBus...');

        const result = await fetchBusesDirect({ ...params, limit: maxItems });

        if (result.success && result.items.length > 0) {
            setBusData(result.items);
            setStatus(`✅ Found ${result.items.length} buses in ${(result.timing / 1000).toFixed(1)}s`);
            setLoading(false);
        } else if (result.success && result.items.length === 0) {
            setError('No buses found for this route. Try a different date or route.');
            setLoading(false);
            setStatus(null);
        } else {
            setError(result.error || 'Failed to fetch data');
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

        // Convert to format expected by code.ts
        const items = busData.map(bus => ({
            ...bus,
            price: bus.priceFormatted,
            amenities: bus.amenities?.join(', ') || '',
            seatsAvailable: String(bus.seatsAvailable),
        }));

        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items,
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

        const params = parseRedBusUrl(url.trim());
        if (!params) {
            setError('Invalid RedBus URL. Make sure it contains fromCityId, toCityId, and date.');
            return;
        }

        setLoading(true);
        setError(null);
        setStatus('⚡ Fetching data...');

        const result = await fetchBusesDirect({ ...params, limit: maxItems });

        if (result.success && result.items.length > 0) {
            setBusData(result.items);
            setStatus('✨ Applying to Figma...');

            const items = result.items.map(bus => ({
                ...bus,
                price: bus.priceFormatted,
                amenities: bus.amenities?.join(', ') || '',
                seatsAvailable: String(bus.seatsAvailable),
            }));

            parent.postMessage({ 
                pluginMessage: { 
                    type: 'apply-datalayer', 
                    items,
                    scope,
                } 
            }, '*');
        } else if (result.success && result.items.length === 0) {
            setError('No buses found for this route.');
            setLoading(false);
            setStatus(null);
        } else {
            setError(result.error || 'Failed to fetch data');
            setLoading(false);
            setStatus(null);
        }
    };

    return (
        <div className="container">
            <header className="header">
                <h1>🚌 RedBus Data Sync</h1>
                <span className="subtitle">No server needed!</span>
            </header>

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
                                    <span className="data-field">{bus.priceFormatted}</span>
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
                    disabled={loading}
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
                disabled={loading}
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
