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

// Messages from UI to Code
export type UIToCodeMessage =
    | { type: 'sync'; url: string; scope: SyncScope; options: ScrapeOptions }
    | { type: 'scan-layers'; scope: SyncScope }
    | { type: 'apply-data'; results: ScrapeResult[] }
    | { type: 'apply-datalayer'; items: DataLayerItem[]; scope: SyncScope };

// Messages from Code to UI
export type CodeToUIMessage =
    | { type: 'layers-found'; layers: DetectedLayer[] }
    | { type: 'fetch-data'; url: string; selectors: SelectorRequest[] }
    | { type: 'sync-complete'; updated: number; failed: number }
    | { type: 'error'; message: string }
    | { type: 'progress'; current: number; total: number; message: string };

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
