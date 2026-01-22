import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './ui.css';

// Types
type SyncScope = 'document' | 'page' | 'selection';
type ViewMode = 'simple' | 'advanced';

interface BusResult {
    operator: string;
    busType: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: string;
    priceFormatted: string;
    rating: string;
    numberOfReviews: number;
    seatsAvailable: string;
    [key: string]: any;
}

interface Preset {
    id: string;
    name: string;
    url: string;
    maxItems: number;
    createdAt: number;
}

interface HistoryItem {
    id: string;
    url: string;
    routeName: string;
    busCount: number;
    timestamp: number;
}

interface DetectedMapping {
    frameIndex: number;
    frameName: string;
    fields: { layerName: string; fieldName: string; sampleValue: string }[];
}

// Backend URL
const API_URL = 'http://localhost:3000';

// All available fields
const ALL_FIELDS = [
    { name: 'operator', label: 'Operator Name', example: 'FRESHBUS' },
    { name: 'busType', label: 'Bus Type', example: 'A/C Sleeper (2+1)' },
    { name: 'departureTime', label: 'Departure', example: '22:30' },
    { name: 'arrivalTime', label: 'Arrival', example: '05:45' },
    { name: 'duration', label: 'Duration', example: '7h 15m' },
    { name: 'priceFormatted', label: 'Price', example: '₹788' },
    { name: 'originalPriceFormatted', label: 'Original Price', example: '₹831' },
    { name: 'discount', label: 'Discount', example: '5% OFF' },
    { name: 'rating', label: 'Rating', example: '4.7' },
    { name: 'numberOfReviews', label: 'Reviews', example: '779' },
    { name: 'seatsAvailable', label: 'Seats', example: '33' },
    { name: 'singleSeats', label: 'Single Seats', example: '15' },
    { name: 'boardingPoint', label: 'Boarding Point', example: 'Central Silk Board' },
    { name: 'droppingPoint', label: 'Dropping Point', example: 'RTC Bus Stand' },
    { name: 'tags', label: 'Tags', example: 'Live Tracking' },
    { name: 'offerTag', label: 'Offer', example: 'Exclusive 7.5% OFF' },
    { name: 'isElectricVehicle', label: 'Electric', example: 'true' },
    { name: 'isPrimo', label: 'Primo', example: 'true' },
];

const App = () => {
    // Core state
    const [url, setUrl] = React.useState('');
    const [urls, setUrls] = React.useState<string[]>([]); // For batch mode
    const [scope, setScope] = React.useState<SyncScope>('selection');
    const [maxItems, setMaxItems] = React.useState(10);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<string | null>(null);
    const [busData, setBusData] = React.useState<BusResult[]>([]);
    
    // Server status
    const [serverOnline, setServerOnline] = React.useState<boolean | null>(null);
    const [retryCount, setRetryCount] = React.useState(0);
    
    // UI state
    const [viewMode, setViewMode] = React.useState<ViewMode>('simple');
    const [showOnboarding, setShowOnboarding] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'fetch' | 'presets' | 'history'>('fetch');
    
    // Presets & History
    const [presets, setPresets] = React.useState<Preset[]>([]);
    const [history, setHistory] = React.useState<HistoryItem[]>([]);
    
    // Field mappings detected in Figma
    const [detectedMappings, setDetectedMappings] = React.useState<DetectedMapping[]>([]);
    
    // Cache
    const [cachedData, setCachedData] = React.useState<{ url: string; data: BusResult[]; timestamp: number } | null>(null);

    // Initialize - check server, load presets/history, check onboarding
    React.useEffect(() => {
        checkServer();
        loadStoredData();
        checkFirstRun();
        
        // Listen for messages from code.ts
        window.onmessage = handlePluginMessage;
        
        // Request initial layer scan
        setTimeout(() => {
            parent.postMessage({ pluginMessage: { type: 'scan-mappings', scope } }, '*');
        }, 200);
        
        return () => { window.onmessage = null; };
    }, []);

    const handlePluginMessage = (event: MessageEvent) => {
        const msg = event.data?.pluginMessage;
        if (!msg) return;

        if (msg.type === 'sync-complete') {
            setLoading(false);
            setStatus(null);
            const message = `Updated ${msg.updated} layer(s)` + (msg.failed > 0 ? ` (${msg.failed} failed)` : '');
            showSuccess(message);
        } else if (msg.type === 'error') {
            setLoading(false);
            setStatus(null);
            setError(msg.message);
        } else if (msg.type === 'mappings-detected') {
            setDetectedMappings(msg.mappings || []);
        } else if (msg.type === 'storage-loaded') {
            setPresets(msg.presets || []);
            setHistory(msg.history || []);
        }
    };

    const checkServer = async () => {
        try {
            const res = await fetch(`${API_URL}/api/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            setServerOnline(res.ok);
            setRetryCount(0);
        } catch {
            setServerOnline(false);
        }
    };

    const loadStoredData = async () => {
        try {
            // Load from Figma clientStorage
            parent.postMessage({ pluginMessage: { type: 'load-storage' } }, '*');
        } catch (e) {
            console.error('Failed to load stored data:', e);
        }
    };

    const checkFirstRun = () => {
        // Show onboarding if first time
        const hasSeenOnboarding = localStorage.getItem('redbus-onboarding-seen');
        if (!hasSeenOnboarding) {
            setShowOnboarding(true);
        }
    };

    const dismissOnboarding = () => {
        localStorage.setItem('redbus-onboarding-seen', 'true');
        setShowOnboarding(false);
    };

    const showSuccess = (message: string) => {
        setStatus(`✓ ${message}`);
        setTimeout(() => setStatus(null), 3000);
    };

    // Extract route name from URL
    const extractRouteName = (urlStr: string): string => {
        try {
            const match = urlStr.match(/bus-tickets\/([^?]+)/);
            if (match) {
                return match[1].replace(/-/g, ' → ').replace(/\b\w/g, c => c.toUpperCase());
            }
        } catch {}
        return 'Unknown Route';
    };

    // Fetch with retry logic
    const fetchWithRetry = async (fetchFn: () => Promise<any>, maxRetries = 3): Promise<any> => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fetchFn();
            } catch (err: any) {
                if (i === maxRetries - 1) throw err;
                setRetryCount(i + 1);
                setStatus(`Retrying... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
            }
        }
    };

    // Main fetch function
    const handleFetch = async () => {
        const urlsToFetch = urls.length > 0 ? urls : [url.trim()];
        
        if (urlsToFetch.length === 0 || !urlsToFetch[0]) {
            setError('Please enter a RedBus URL');
            return;
        }

        // Validate URLs
        for (const u of urlsToFetch) {
            if (!u.includes('redbus.in')) {
                setError(`Invalid URL: ${u.slice(0, 50)}...`);
                return;
            }
        }

        setLoading(true);
        setError(null);
        setRetryCount(0);
        setStatus('Fetching bus data...');

        try {
            const allBuses: BusResult[] = [];
            
            for (const fetchUrl of urlsToFetch) {
                const response = await fetchWithRetry(async () => {
                    const res = await fetch(`${API_URL}/api/scrape`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: fetchUrl,
                            options: { extractionMode: 'direct', maxResults: maxItems },
                        }),
                        signal: AbortSignal.timeout(30000),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                });

                if (response.success && response.dataLayerItems?.length > 0) {
                    allBuses.push(...response.dataLayerItems);
                }
            }

            if (allBuses.length > 0) {
                setBusData(allBuses);
                
                // Cache the data
                setCachedData({ url: urlsToFetch[0], data: allBuses, timestamp: Date.now() });
                
                // Add to history
                addToHistory(urlsToFetch[0], allBuses.length);
                
                setStatus(`Found ${allBuses.length} buses`);
                setLoading(false);
            } else {
                setError('No buses found. Try a different route or date.');
                setLoading(false);
                setStatus(null);
            }
        } catch (err: any) {
            if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
                setServerOnline(false);
                setError('Server not running. Start the RedBus Data Server first.');
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
            // Try to use cached data
            if (cachedData) {
                setBusData(cachedData.data);
                setStatus('Using cached data');
            } else {
                setError('No data to apply. Fetch data first.');
                return;
            }
        }

        setLoading(true);
        setStatus('Applying to Figma...');

        parent.postMessage({ 
            pluginMessage: { 
                type: 'apply-datalayer', 
                items: busData,
                scope,
            } 
        }, '*');
    };

    // Quick fetch and apply
    const handleQuickSync = async () => {
        await handleFetch();
        if (busData.length > 0) {
            setTimeout(() => handleApply(), 100);
        }
    };

    // Preset management
    const savePreset = () => {
        const name = prompt('Preset name:', extractRouteName(url));
        if (!name) return;
        
        const newPreset: Preset = {
            id: Date.now().toString(),
            name,
            url,
            maxItems,
            createdAt: Date.now(),
        };
        
        const updated = [...presets, newPreset];
        setPresets(updated);
        parent.postMessage({ pluginMessage: { type: 'save-presets', presets: updated } }, '*');
        showSuccess('Preset saved');
    };

    const loadPreset = (preset: Preset) => {
        setUrl(preset.url);
        setMaxItems(preset.maxItems);
        setActiveTab('fetch');
    };

    const deletePreset = (id: string) => {
        const updated = presets.filter(p => p.id !== id);
        setPresets(updated);
        parent.postMessage({ pluginMessage: { type: 'save-presets', presets: updated } }, '*');
    };

    // History management
    const addToHistory = (fetchUrl: string, busCount: number) => {
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            url: fetchUrl,
            routeName: extractRouteName(fetchUrl),
            busCount,
            timestamp: Date.now(),
        };
        
        const updated = [newItem, ...history].slice(0, 20); // Keep last 20
        setHistory(updated);
        parent.postMessage({ pluginMessage: { type: 'save-history', history: updated } }, '*');
    };

    const loadFromHistory = (item: HistoryItem) => {
        setUrl(item.url);
        setActiveTab('fetch');
    };

    // Batch URL handling
    const handleBatchUrls = (text: string) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.includes('redbus.in'));
        setUrls(lines);
        if (lines.length > 0) {
            setUrl(lines[0]);
        }
    };

    // Render onboarding overlay
    const renderOnboarding = () => (
        <div className="onboarding-overlay">
            <div className="onboarding-content">
                <h2>Welcome to RedBus Data Sync!</h2>
                <div className="onboarding-steps">
                    <div className="onboarding-step">
                        <span className="step-number">1</span>
                        <div>
                            <strong>Name your frames</strong>
                            <p>Use <code>Card @[0]</code>, <code>Card @[1]</code>, etc.</p>
                        </div>
                    </div>
                    <div className="onboarding-step">
                        <span className="step-number">2</span>
                        <div>
                            <strong>Name text layers</strong>
                            <p>Use <code>@{'{operator}'}</code>, <code>@{'{price}'}</code>, etc.</p>
                        </div>
                    </div>
                    <div className="onboarding-step">
                        <span className="step-number">3</span>
                        <div>
                            <strong>Paste URL and sync</strong>
                            <p>Paste any RedBus search URL and click Sync!</p>
                        </div>
                    </div>
                </div>
                <button className="onboarding-dismiss" onClick={dismissOnboarding}>
                    Got it!
                </button>
            </div>
        </div>
    );

    // Render server status
    const renderServerStatus = () => {
        if (serverOnline === false) {
            return (
                <div className="server-offline">
                    <div className="server-offline-icon">⚠️</div>
                    <div className="server-offline-content">
                        <strong>Server not running</strong>
                        <p>Start the RedBus Data Server:</p>
                        <code>cd vercel-backend && npm run dev</code>
                        <button onClick={checkServer} className="retry-btn">
                            Check Again
                        </button>
                    </div>
                </div>
            );
        }
        if (serverOnline === true) {
            return <div className="server-online">● Connected</div>;
        }
        return <div className="server-checking">Checking server...</div>;
    };

    // Render field mapping preview
    const renderMappingPreview = () => {
        if (detectedMappings.length === 0 || busData.length === 0) return null;
        
        return (
            <div className="mapping-preview">
                <div className="mapping-header">
                    <span className="mapping-title">Preview</span>
                    <span className="mapping-count">{detectedMappings.length} cards detected</span>
                </div>
                <div className="mapping-list">
                    {detectedMappings.slice(0, 3).map((mapping, idx) => (
                        <div key={idx} className="mapping-item">
                            <span className="mapping-frame">{mapping.frameName}</span>
                            <span className="mapping-arrow">→</span>
                            <span className="mapping-value">
                                {busData[idx]?.operator || 'No data'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render data preview
    const renderDataPreview = () => {
        if (busData.length === 0) return null;
        
        return (
            <div className="data-preview">
                <div className="preview-header">
                    <span>Fetched Data</span>
                    <span className="preview-count">{busData.length} buses</span>
                </div>
                <div className="preview-list">
                    {busData.slice(0, 5).map((bus, idx) => (
                        <div key={idx} className="preview-item">
                            <span className="preview-index">#{idx + 1}</span>
                            <div className="preview-details">
                                <strong>{bus.operator}</strong>
                                <span>{bus.departureTime} → {bus.arrivalTime}</span>
                                <span>{bus.priceFormatted}</span>
                            </div>
                        </div>
                    ))}
                    {busData.length > 5 && (
                        <div className="preview-more">+{busData.length - 5} more</div>
                    )}
                </div>
            </div>
        );
    };

    // Main render
    return (
        <div className="app">
            {showOnboarding && renderOnboarding()}
            
            <header className="app-header">
                <h1>RedBus Data Sync</h1>
                {renderServerStatus()}
            </header>

            {/* Tabs */}
            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 'fetch' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fetch')}
                >
                    Fetch
                </button>
                <button 
                    className={`tab ${activeTab === 'presets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('presets')}
                >
                    Presets
                    {presets.length > 0 && <span className="tab-badge">{presets.length}</span>}
                </button>
                <button 
                    className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    History
                </button>
            </div>

            {/* Fetch Tab */}
            {activeTab === 'fetch' && (
                <div className="tab-content">
                    {/* URL Input */}
                    <div className="input-group">
                        <label>RedBus URL</label>
                        <textarea
                            value={urls.length > 1 ? urls.join('\n') : url}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val.includes('\n')) {
                                    handleBatchUrls(val);
                                } else {
                                    setUrl(val);
                                    setUrls([]);
                                }
                            }}
                            placeholder="Paste RedBus search URL(s)..."
                            className="url-input"
                            rows={urls.length > 1 ? 3 : 1}
                        />
                        {urls.length > 1 && (
                            <span className="url-hint">{urls.length} URLs detected (batch mode)</span>
                        )}
                    </div>

                    {/* Quick Settings */}
                    <div className="quick-settings">
                        <div className="setting">
                            <label>Apply to</label>
                            <select value={scope} onChange={(e) => setScope(e.target.value as SyncScope)}>
                                <option value="selection">Selection</option>
                                <option value="page">Current Page</option>
                                <option value="document">Entire Document</option>
                            </select>
                        </div>
                        <div className="setting">
                            <label>Max buses</label>
                            <input
                                type="number"
                                value={maxItems}
                                onChange={(e) => setMaxItems(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                                min={1}
                                max={50}
                            />
                        </div>
                    </div>

                    {/* Mapping Preview */}
                    {renderMappingPreview()}

                    {/* Data Preview */}
                    {renderDataPreview()}

                    {/* Advanced Section */}
                    <details className="advanced-section">
                        <summary>Available Fields</summary>
                        <div className="fields-grid">
                            {ALL_FIELDS.map(field => (
                                <div key={field.name} className="field-item">
                                    <code>@{`{${field.name}}`}</code>
                                    <span>{field.example}</span>
                                </div>
                            ))}
                        </div>
                    </details>

                    {/* Error */}
                    {error && (
                        <div className="error-banner">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {/* Status */}
                    {status && <div className="status-banner">{status}</div>}

                    {/* Actions */}
                    <div className="actions">
                        <button
                            className="btn btn-secondary"
                            onClick={handleFetch}
                            disabled={loading || serverOnline === false}
                        >
                            {loading ? 'Fetching...' : 'Fetch Data'}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleApply}
                            disabled={loading || busData.length === 0}
                        >
                            Apply to Figma
                        </button>
                    </div>

                    <button
                        className="btn btn-hero"
                        onClick={handleQuickSync}
                        disabled={loading || serverOnline === false}
                    >
                        {loading ? (retryCount > 0 ? `Retrying (${retryCount}/3)...` : 'Working...') : 'Sync Now'}
                    </button>

                    {/* Save as preset */}
                    {url && (
                        <button className="btn btn-text" onClick={savePreset}>
                            Save as Preset
                        </button>
                    )}
                </div>
            )}

            {/* Presets Tab */}
            {activeTab === 'presets' && (
                <div className="tab-content">
                    {presets.length === 0 ? (
                        <div className="empty-state">
                            <p>No presets saved yet.</p>
                            <p className="empty-hint">Save frequently used routes for quick access.</p>
                        </div>
                    ) : (
                        <div className="preset-list">
                            {presets.map(preset => (
                                <div key={preset.id} className="preset-item">
                                    <div className="preset-info" onClick={() => loadPreset(preset)}>
                                        <strong>{preset.name}</strong>
                                        <span className="preset-meta">{preset.maxItems} buses</span>
                                    </div>
                                    <button 
                                        className="preset-delete"
                                        onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="tab-content">
                    {history.length === 0 ? (
                        <div className="empty-state">
                            <p>No history yet.</p>
                            <p className="empty-hint">Your recent fetches will appear here.</p>
                        </div>
                    ) : (
                        <div className="history-list">
                            {history.map(item => (
                                <div 
                                    key={item.id} 
                                    className="history-item"
                                    onClick={() => loadFromHistory(item)}
                                >
                                    <div className="history-route">{item.routeName}</div>
                                    <div className="history-meta">
                                        <span>{item.busCount} buses</span>
                                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Help Button */}
            <button className="help-btn" onClick={() => setShowOnboarding(true)}>
                ?
            </button>
        </div>
    );
};

// Mount
const container = document.getElementById('react-page');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
