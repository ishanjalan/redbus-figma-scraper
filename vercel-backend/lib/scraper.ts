import { Browser, Page } from 'puppeteer-core';
import { getBrowser } from './browser';
import { createExtractorScript, SelectorConfig, ExtractedResult } from './selector-extractor';
import { 
    DataLayerExtractConfig, 
    createDataLayerExtractorScript, 
    ExtractedDataLayerResult,
    DATALAYER_PRESETS,
    detectPreset
} from './datalayer-extractor';
import {
    extractViaXHR,
    extractViaInjection,
    XHR_PRESETS,
    XHRExtractionResult,
} from './xhr-extractor';
import {
    fetchBusesDirectAPI,
    parseRedBusUrl,
    DirectAPIResult,
} from './direct-api';

export type ExtractionMode = 'selectors' | 'dataLayer' | 'xhr' | 'direct' | 'auto';

export interface ScrapeOptions {
    waitForJs?: boolean;
    timeout?: number;
    waitForSelector?: string;
    userAgent?: string;
    maxResults?: number; // Maximum results for .all selectors (default: 10)
    extractionMode?: ExtractionMode; // 'selectors' | 'dataLayer' | 'xhr' | 'direct' | 'auto'
    dataLayerConfig?: DataLayerExtractConfig; // Custom dataLayer config
    dataLayerPreset?: string; // Use a preset (e.g., 'redbus')
    xhrPreset?: string; // Use XHR preset (e.g., 'redbus')
    fallbackOnError?: boolean; // If direct/xhr fails, try fallback methods (default: true)
}

export interface ScrapeRequest {
    url: string;
    selectors: SelectorConfig[];
    options?: ScrapeOptions;
}

export interface ScrapeResponse {
    success: boolean;
    url: string;
    results: ExtractedResult[];
    errors: string[];
    timing?: {
        pageLoad: number;
        extraction: number;
        total: number;
    };
    // DataLayer/XHR extraction results
    dataLayerItems?: Record<string, any>[];
    totalItemsFound?: number;
    extractionMode?: ExtractionMode;
    // XHR specific
    interceptedUrl?: string;
}

const DEFAULT_OPTIONS: ScrapeOptions = {
    waitForJs: true,
    timeout: 30000,
    maxResults: 10,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Scrape a website and extract data using CSS selectors
 */
export async function scrapeWebsite(request: ScrapeRequest): Promise<ScrapeResponse> {
    const startTime = Date.now();
    const options = { ...DEFAULT_OPTIONS, ...request.options };
    const errors: string[] = [];
    const fallbackOnError = options.fallbackOnError !== false; // Default true

    // Check if we can use direct API (fastest method)
    const isRedBusUrl = request.url.toLowerCase().includes('redbus.');
    const canUseDirectApi = isRedBusUrl && parseRedBusUrl(request.url);
    
    // Try direct API first if applicable
    if ((options.extractionMode === 'direct' || options.extractionMode === 'auto') && canUseDirectApi) {
        console.log('🚀 Attempting direct API call (fastest method)...');
        
        const searchParams = parseRedBusUrl(request.url)!;
        searchParams.limit = options.maxResults || 20;
        
        const directResult = await fetchBusesDirectAPI(searchParams);
        
        if (directResult.success && directResult.items.length > 0) {
            console.log(`✅ Direct API success: ${directResult.items.length} buses in ${directResult.timing}ms`);
            
            return {
                success: true,
                url: request.url,
                results: directResult.items.map((item, i) => ({
                    id: `item_${i}`,
                    found: true,
                    type: 'text' as const,
                    data: JSON.stringify(item),
                })),
                errors: directResult.errors,
                timing: {
                    pageLoad: 0,
                    extraction: directResult.timing,
                    total: Date.now() - startTime,
                },
                extractionMode: 'direct',
                dataLayerItems: directResult.items,
                totalItemsFound: directResult.totalFound,
            };
        } else if (fallbackOnError) {
            console.log('⚠️ Direct API failed, falling back to browser-based extraction...');
            errors.push(...directResult.errors);
            // Continue to browser-based methods below
        } else {
            return {
                success: false,
                url: request.url,
                results: [],
                errors: directResult.errors,
                timing: {
                    pageLoad: 0,
                    extraction: directResult.timing,
                    total: Date.now() - startTime,
                },
                extractionMode: 'direct',
            };
        }
    }

    // Browser-based extraction (Puppeteer)
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await getBrowser();
        page = await browser.newPage();

        // Set user agent
        if (options.userAgent) {
            await page.setUserAgent(options.userAgent);
        }

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            // Block fonts and unnecessary media to speed up loading
            if (['font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to URL
        const pageLoadStart = Date.now();
        await page.goto(request.url, {
            waitUntil: options.waitForJs ? 'networkidle0' : 'domcontentloaded',
            timeout: options.timeout,
        });
        const pageLoadTime = Date.now() - pageLoadStart;

        // Wait for specific selector if provided
        if (options.waitForSelector) {
            await page.waitForSelector(options.waitForSelector, {
                timeout: options.timeout,
            });
        }

        // Determine extraction mode
        let extractionMode = options.extractionMode || 'selectors';
        if (extractionMode === 'auto') {
            // Auto-detect based on URL - prefer XHR for supported sites
            const detectedPreset = detectPreset(request.url);
            if (detectedPreset && XHR_PRESETS[detectedPreset]) {
                extractionMode = 'xhr';
                if (!options.xhrPreset) {
                    options.xhrPreset = detectedPreset;
                }
            } else if (detectedPreset) {
                extractionMode = 'dataLayer';
                if (!options.dataLayerPreset) {
                    options.dataLayerPreset = detectedPreset;
                }
            } else {
                extractionMode = 'selectors';
            }
        }

        const extractionStart = Date.now();
        let results: ExtractedResult[] = [];
        let dataLayerItems: Record<string, any>[] | undefined;
        let totalItemsFound: number | undefined;
        let interceptedUrl: string | undefined;

        if (extractionMode === 'xhr') {
            // XHR interception mode - best for complete data
            console.log(`🌐 Using XHR interception mode (preset: ${options.xhrPreset || 'auto'})`);
            
            const xhrConfig = options.xhrPreset ? XHR_PRESETS[options.xhrPreset] : XHR_PRESETS.redbus;
            
            // First try XHR interception
            let xhrResult = await extractViaXHR(page, xhrConfig);
            
            // If XHR interception didn't work, try page injection
            if (!xhrResult.success || xhrResult.items.length === 0) {
                console.log('🔄 XHR interception empty, trying page injection...');
                xhrResult = await extractViaInjection(page);
            }
            
            // If still no luck, fall back to dataLayer
            if (!xhrResult.success || xhrResult.items.length === 0) {
                console.log('🔄 Falling back to dataLayer extraction...');
                extractionMode = 'dataLayer';
                options.dataLayerPreset = options.xhrPreset || 'redbus';
            } else {
                dataLayerItems = xhrResult.items;
                totalItemsFound = xhrResult.totalFound;
                interceptedUrl = xhrResult.interceptedUrl;
                
                // Apply max results
                if (options.maxResults && dataLayerItems.length > options.maxResults) {
                    dataLayerItems = dataLayerItems.slice(0, options.maxResults);
                }
                
                // Convert to ExtractedResult format
                results = dataLayerItems.map((item, index) => ({
                    id: `item_${index}`,
                    found: true,
                    type: 'text' as const,
                    data: JSON.stringify(item),
                }));
                
                if (xhrResult.errors.length > 0) {
                    errors.push(...xhrResult.errors);
                }
            }
        }
        
        if (extractionMode === 'dataLayer') {
            // DataLayer extraction mode
            const config = options.dataLayerConfig || 
                (options.dataLayerPreset && DATALAYER_PRESETS[options.dataLayerPreset]) ||
                DATALAYER_PRESETS.products; // fallback to generic

            const extractorScript = createDataLayerExtractorScript();
            const dataLayerResult = await page.evaluate(
                (script, cfg) => {
                    const fn = eval(script);
                    return fn(cfg);
                },
                extractorScript,
                config
            ) as ExtractedDataLayerResult;

            if (!dataLayerResult.success) {
                errors.push(...dataLayerResult.errors);
            }

            dataLayerItems = dataLayerResult.items;
            totalItemsFound = dataLayerResult.totalFound;

            // Convert dataLayer items to ExtractedResult format for compatibility
            results = dataLayerItems.map((item, index) => ({
                id: `item_${index}`,
                found: true,
                type: 'text' as const,
                data: JSON.stringify(item),
            }));

        } else {
            // Selector-based extraction mode
            const maxResults = options.maxResults || 10;
            const extractorScript = createExtractorScript(maxResults);
            results = await page.evaluate(
                (script, selectors, max) => {
                    const fn = eval(script);
                    return fn(selectors, max);
                },
                extractorScript,
                request.selectors,
                maxResults
            ) as ExtractedResult[];

            // Collect errors from results
            results.forEach((result) => {
                if (!result.found && result.error) {
                    errors.push(`${result.id}: ${result.error}`);
                }
            });
        }

        const extractionTime = Date.now() - extractionStart;

        return {
            success: true,
            url: request.url,
            results,
            errors,
            timing: {
                pageLoad: pageLoadTime,
                extraction: extractionTime,
                total: Date.now() - startTime,
            },
            extractionMode,
            dataLayerItems,
            totalItemsFound,
            interceptedUrl,
        };
    } catch (error: any) {
        const errorMessage = error.message || 'Unknown scraping error';
        
        // Provide user-friendly error messages
        let friendlyError = errorMessage;
        if (errorMessage.includes('net::ERR_NAME_NOT_RESOLVED')) {
            friendlyError = 'Website not found. Please check the URL.';
        } else if (errorMessage.includes('net::ERR_CONNECTION_REFUSED')) {
            friendlyError = 'Could not connect to website. It may be down or blocking access.';
        } else if (errorMessage.includes('timeout')) {
            friendlyError = 'Website took too long to load. Try again or increase timeout.';
        } else if (errorMessage.includes('net::ERR_ABORTED')) {
            friendlyError = 'Request was blocked. This website may restrict automated access.';
        }

        return {
            success: false,
            url: request.url,
            results: [],
            errors: [friendlyError],
            timing: {
                pageLoad: 0,
                extraction: 0,
                total: Date.now() - startTime,
            },
        };
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

/**
 * Validate a URL
 */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Sanitize a URL
 */
export function sanitizeUrl(url: string): string {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}
