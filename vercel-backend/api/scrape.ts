import { VercelRequest, VercelResponse } from '@vercel/node';
import { scrapeWebsite, isValidUrl, sanitizeUrl, ExtractionMode } from '../lib/scraper';
import { SelectorConfig } from '../lib/selector-extractor';
import { DataLayerExtractConfig, DATALAYER_PRESETS } from '../lib/datalayer-extractor';
import { XHR_PRESETS } from '../lib/xhr-extractor';

interface ScrapeRequestBody {
    url: string;
    selectors?: SelectorConfig[]; // Optional when using dataLayer/xhr/direct mode
    options?: {
        waitForJs?: boolean;
        timeout?: number;
        waitForSelector?: string;
        maxResults?: number; // Maximum results for .all selectors (default: 10)
        extractionMode?: ExtractionMode; // 'selectors' | 'dataLayer' | 'xhr' | 'direct' | 'auto'
        dataLayerPreset?: string; // Use a preset (e.g., 'redbus', 'products')
        dataLayerConfig?: DataLayerExtractConfig; // Custom dataLayer config
        xhrPreset?: string; // Use XHR preset (e.g., 'redbus')
        fallbackOnError?: boolean; // If direct/xhr fails, try fallback methods
    };
}

// Maximum number of selectors per request
const MAX_SELECTORS = 50;
// Maximum results for .all modifier
const MAX_RESULTS_LIMIT = 100;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        const body = req.body as ScrapeRequestBody;
        const { url, selectors, options } = body;

        // Validate URL
        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'URL is required',
            });
        }

        const sanitizedUrl = sanitizeUrl(url.trim());
        
        if (!isValidUrl(sanitizedUrl)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL. Please provide a valid HTTP/HTTPS URL.',
            });
        }

        // Determine extraction mode
        const extractionMode = options?.extractionMode || 'auto'; // Default to auto for best results
        const isDataExtractionMode = 
            extractionMode === 'dataLayer' || 
            extractionMode === 'xhr' ||
            extractionMode === 'direct' ||
            extractionMode === 'auto' ||
            (options?.dataLayerPreset || options?.dataLayerConfig || options?.xhrPreset);

        // Validate selectors (only required for selector mode)
        if (!isDataExtractionMode) {
            if (!selectors || !Array.isArray(selectors)) {
                return res.status(400).json({
                    success: false,
                    error: 'Selectors array is required for selector extraction mode',
                });
            }

            if (selectors.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one selector is required',
                });
            }

            if (selectors.length > MAX_SELECTORS) {
                return res.status(400).json({
                    success: false,
                    error: `Too many selectors. Maximum is ${MAX_SELECTORS}.`,
                });
            }

            // Validate each selector
            for (const selector of selectors) {
                if (!selector.id || !selector.selector) {
                    return res.status(400).json({
                        success: false,
                        error: 'Each selector must have an id and selector property',
                    });
                }
            }
        }

        // Validate dataLayer preset if specified
        if (options?.dataLayerPreset && !DATALAYER_PRESETS[options.dataLayerPreset]) {
            return res.status(400).json({
                success: false,
                error: `Unknown dataLayer preset: ${options.dataLayerPreset}. Available: ${Object.keys(DATALAYER_PRESETS).join(', ')}`,
            });
        }

        // Validate XHR preset if specified
        if (options?.xhrPreset && !XHR_PRESETS[options.xhrPreset]) {
            return res.status(400).json({
                success: false,
                error: `Unknown XHR preset: ${options.xhrPreset}. Available: ${Object.keys(XHR_PRESETS).join(', ')}`,
            });
        }

        // Scrape the website
        const result = await scrapeWebsite({
            url: sanitizedUrl,
            selectors: selectors || [],
            options: {
                waitForJs: options?.waitForJs ?? true,
                timeout: Math.min(options?.timeout ?? 30000, 55000), // Cap at 55s to stay within Vercel limits
                waitForSelector: options?.waitForSelector,
                maxResults: Math.min(options?.maxResults ?? 20, MAX_RESULTS_LIMIT), // Cap at 100 results
                extractionMode: options?.extractionMode || 'auto', // Default to auto
                dataLayerPreset: options?.dataLayerPreset,
                dataLayerConfig: options?.dataLayerConfig,
                xhrPreset: options?.xhrPreset,
                fallbackOnError: options?.fallbackOnError ?? true, // Default to true
            },
        });

        // Return response
        return res.status(result.success ? 200 : 500).json(result);

    } catch (error: any) {
        console.error('Scrape API error:', error);

        // Handle specific error types
        if (error.name === 'TimeoutError') {
            return res.status(504).json({
                success: false,
                error: 'Request timed out. The website took too long to load.',
                url: req.body?.url,
                results: [],
                errors: ['Timeout'],
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred',
            url: req.body?.url,
            results: [],
            errors: [error.message],
        });
    }
}
