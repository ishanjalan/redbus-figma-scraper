// Types for communication between UI and Code sandbox

export type SyncScope = 'document' | 'page' | 'selection';

export interface SelectorRequest {
    id: string;
    selector: string;
    type: 'text' | 'image';
    modifier?: string;
    attribute?: string;
    index?: number; // For indexed extraction within .group[N] parents
}

export interface ScrapeOptions {
    waitForJs: boolean;
    includeImages: boolean;
    timeout?: number;
}

export interface ScrapeResult {
    id: string;
    found: boolean;
    data?: string;
    type: 'text' | 'image';
    bytes?: Uint8Array;
    error?: string;
    // For repeated items (.all modifier)
    originalId?: string;
    index?: number;
}

export interface DetectedLayer {
    id: string;
    name: string;
    selector: string;
    type: 'text' | 'image';
    modifier?: string;
}

// DataLayer item (from dataLayer extraction)
export interface DataLayerItem {
    [key: string]: any;
}

// Preset type for saving routes
export interface Preset {
    id: string;
    name: string;
    url: string;
    maxItems: number;
    createdAt: number;
}

// History item
export interface HistoryItem {
    id: string;
    url: string;
    routeName: string;
    busCount: number;
    timestamp: number;
}

// Detected mapping (for preview)
export interface DetectedMapping {
    frameIndex: number;
    frameName: string;
    fields: { layerName: string; fieldName: string; sampleValue: string }[];
}

// Messages from UI to Code
export type UIToCodeMessage =
    | { type: 'sync'; url: string; scope: SyncScope; options: ScrapeOptions }
    | { type: 'scan-layers'; scope: SyncScope }
    | { type: 'scan-mappings'; scope: SyncScope }
    | { type: 'apply-data'; results: ScrapeResult[] }
    | { type: 'apply-datalayer'; items: DataLayerItem[]; scope: SyncScope }
    | { type: 'load-storage' }
    | { type: 'save-presets'; presets: Preset[] }
    | { type: 'save-history'; history: HistoryItem[] };

// Messages from Code to UI
export type CodeToUIMessage =
    | { type: 'layers-found'; layers: DetectedLayer[] }
    | { type: 'mappings-detected'; mappings: DetectedMapping[] }
    | { type: 'fetch-data'; url: string; selectors: SelectorRequest[] }
    | { type: 'sync-complete'; updated: number; failed: number }
    | { type: 'error'; message: string }
    | { type: 'progress'; current: number; total: number; message: string }
    | { type: 'storage-loaded'; presets: Preset[]; history: HistoryItem[] };

// API Request/Response types
export interface ScrapeAPIRequest {
    url: string;
    selectors: SelectorRequest[];
    options: ScrapeOptions;
}

export interface ScrapeAPIResponse {
    success: boolean;
    url: string;
    results: Array<{
        id: string;
        found: boolean;
        data?: string;
        type: 'text' | 'image';
        originalId?: string;
        index?: number;
    }>;
    errors: string[];
}
