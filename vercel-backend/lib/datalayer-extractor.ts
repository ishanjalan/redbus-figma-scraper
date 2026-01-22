/**
 * DataLayer Extractor
 * 
 * Extracts structured data from Google Analytics dataLayer objects.
 * This is useful for sites like RedBus that push e-commerce data to GTM.
 */

export interface DataLayerItem {
    [key: string]: any;
}

export interface DataLayerExtractConfig {
    /** Event name to filter (e.g., 'view_item_list') */
    eventFilter?: string;
    /** Path to items array (e.g., 'items' or 'ecommerce.items') */
    itemsPath?: string;
    /** Field mappings from dataLayer to output */
    fieldMappings: DataLayerFieldMapping[];
    /** Maximum number of items to extract */
    maxItems?: number;
}

export interface DataLayerFieldMapping {
    /** Output field name */
    outputField: string;
    /** Source field in dataLayer item (supports dot notation) */
    sourceField: string;
    /** Default value if source field is missing */
    defaultValue?: string;
    /** Transform function name (optional) */
    transform?: 'uppercase' | 'lowercase' | 'trim' | 'number' | 'currency';
}

export interface ExtractedDataLayerResult {
    success: boolean;
    items: Record<string, any>[];
    totalFound: number;
    errors: string[];
}

/**
 * Creates a script that extracts data from window.dataLayer
 * This script runs in the browser context
 */
export function createDataLayerExtractorScript(): string {
    return `
    (function(config) {
        const result = {
            success: false,
            items: [],
            totalFound: 0,
            errors: []
        };

        try {
            const dataLayer = window.dataLayer;
            if (!dataLayer || !Array.isArray(dataLayer)) {
                result.errors.push('dataLayer not found or not an array');
                return result;
            }

            // Filter events if specified
            let events = dataLayer;
            if (config.eventFilter) {
                events = dataLayer.filter(d => d.event === config.eventFilter);
            }

            if (events.length === 0) {
                result.errors.push('No matching events found in dataLayer');
                return result;
            }

            // Helper to get nested value using dot notation
            const getNestedValue = (obj, path) => {
                return path.split('.').reduce((acc, part) => acc?.[part], obj);
            };

            // Apply transform
            const applyTransform = (value, transform) => {
                if (value == null) return value;
                switch (transform) {
                    case 'uppercase': return String(value).toUpperCase();
                    case 'lowercase': return String(value).toLowerCase();
                    case 'trim': return String(value).trim();
                    case 'number': return Number(value);
                    case 'currency': return '₹' + Number(value).toLocaleString('en-IN');
                    default: return value;
                }
            };

            // Extract items from all matching events
            let allItems = [];
            for (const event of events) {
                const itemsPath = config.itemsPath || 'items';
                const items = getNestedValue(event, itemsPath);
                if (Array.isArray(items)) {
                    allItems = allItems.concat(items);
                }
            }

            result.totalFound = allItems.length;

            // Limit items
            const maxItems = config.maxItems || 50;
            const limitedItems = allItems.slice(0, maxItems);

            // Map fields
            result.items = limitedItems.map(item => {
                const mapped = {};
                for (const mapping of config.fieldMappings) {
                    let value = getNestedValue(item, mapping.sourceField);
                    if (value == null && mapping.defaultValue !== undefined) {
                        value = mapping.defaultValue;
                    }
                    if (mapping.transform) {
                        value = applyTransform(value, mapping.transform);
                    }
                    mapped[mapping.outputField] = value;
                }
                return mapped;
            });

            result.success = true;
            return result;

        } catch (error) {
            result.errors.push('Extraction error: ' + error.message);
            return result;
        }
    })
    `;
}

/**
 * Preset configurations for common sites
 */
export const DATALAYER_PRESETS: Record<string, DataLayerExtractConfig> = {
    // RedBus bus listing
    redbus: {
        eventFilter: 'view_item_list',
        itemsPath: 'items',
        maxItems: 50,
        fieldMappings: [
            { outputField: 'id', sourceField: 'item_id' },
            { outputField: 'operator', sourceField: 'item_brand' },
            { outputField: 'busType', sourceField: 'item_category' },
            { outputField: 'rating', sourceField: 'item_category5' },
            { outputField: 'price', sourceField: 'price', transform: 'currency' },
            { outputField: 'priceRaw', sourceField: 'price', transform: 'number' },
            { outputField: 'features', sourceField: 'affiliation', defaultValue: '' },
            { outputField: 'route', sourceField: 'item_name' },
        ],
    },

    // Generic e-commerce (GA4 format)
    ecommerce_ga4: {
        eventFilter: 'view_item_list',
        itemsPath: 'ecommerce.items',
        maxItems: 50,
        fieldMappings: [
            { outputField: 'id', sourceField: 'item_id' },
            { outputField: 'name', sourceField: 'item_name' },
            { outputField: 'brand', sourceField: 'item_brand' },
            { outputField: 'category', sourceField: 'item_category' },
            { outputField: 'price', sourceField: 'price' },
            { outputField: 'quantity', sourceField: 'quantity' },
        ],
    },

    // Generic product listing
    products: {
        eventFilter: 'view_item_list',
        itemsPath: 'items',
        maxItems: 50,
        fieldMappings: [
            { outputField: 'id', sourceField: 'item_id' },
            { outputField: 'name', sourceField: 'item_name' },
            { outputField: 'brand', sourceField: 'item_brand' },
            { outputField: 'price', sourceField: 'price' },
        ],
    },
};

/**
 * Detect which preset to use based on URL
 */
export function detectPreset(url: string): string | null {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('redbus.')) {
        return 'redbus';
    }
    
    // Add more site detections here
    return null;
}
