/**
 * Local development server for testing the scraper API
 * Run with: npx ts-node dev-server.ts
 */

import express from 'express';
import cors from 'cors';
import { scrapeWebsite, isValidUrl, sanitizeUrl, ExtractionMode } from './lib/scraper';
import { SelectorConfig } from './lib/selector-extractor';
import { DATALAYER_PRESETS } from './lib/datalayer-extractor';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'web-scraper-sync-api (dev)',
    });
});

// Main scrape endpoint
app.post('/api/scrape', async (req, res) => {
    const { url, selectors, options } = req.body;

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

    // Determine extraction mode - default to 'auto' for best results
    const extractionMode: ExtractionMode = options?.extractionMode || 'auto';
    
    // Check if we're using a data extraction mode (doesn't require selectors)
    const isDataExtractionMode = 
        extractionMode === 'dataLayer' || 
        extractionMode === 'xhr' ||
        extractionMode === 'direct' ||
        extractionMode === 'auto' ||
        (options?.dataLayerPreset || options?.dataLayerConfig || options?.xhrPreset);

    // Validate selectors (only required for selector mode)
    if (!isDataExtractionMode) {
        if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Selectors array is required and must not be empty for selector mode',
            });
        }
    }

    // Validate dataLayer preset if specified
    if (options?.dataLayerPreset && !DATALAYER_PRESETS[options.dataLayerPreset]) {
        return res.status(400).json({
            success: false,
            error: `Unknown dataLayer preset: ${options.dataLayerPreset}. Available: ${Object.keys(DATALAYER_PRESETS).join(', ')}`,
        });
    }

    try {
        console.log(`\n🌐 Scraping: ${sanitizedUrl}`);
        console.log(`🔧 Mode: ${extractionMode}${options?.dataLayerPreset ? ` (preset: ${options.dataLayerPreset})` : ''}`);
        if (!isDataExtractionMode) {
            console.log(`📋 Selectors: ${selectors?.length || 0}`);
        }

        const result = await scrapeWebsite({
            url: sanitizedUrl,
            selectors: (selectors as SelectorConfig[]) || [],
            options: {
                waitForJs: options?.waitForJs ?? true,
                timeout: options?.timeout ?? 45000,
                maxResults: options?.maxResults ?? 20,
                extractionMode: extractionMode,
                dataLayerPreset: options?.dataLayerPreset,
                dataLayerConfig: options?.dataLayerConfig,
                xhrPreset: options?.xhrPreset,
                fallbackOnError: options?.fallbackOnError ?? true,
            },
        });

        if (result.extractionMode === 'direct') {
            console.log(`⚡ Direct API: ${result.dataLayerItems?.length || 0} items (${result.totalItemsFound} total)`);
        } else if (result.extractionMode === 'xhr' || result.extractionMode === 'dataLayer') {
            console.log(`✅ ${result.extractionMode} extraction: ${result.dataLayerItems?.length || 0} items (${result.totalItemsFound} found total)`);
        } else {
            console.log(`✅ Selector extraction: ${result.results.filter(r => r.found).length}/${result.results.length} found`);
        }
        
        if (result.timing) {
            console.log(`⏱️  Timing: ${result.timing.total}ms total (${result.timing.pageLoad}ms load, ${result.timing.extraction}ms extract)`);
        }

        return res.json(result);
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred',
            url: sanitizedUrl,
            results: [],
            errors: [error.message],
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Web Scraper Sync API - Development Server         ║
║                                                        ║
║   Running on: http://localhost:${PORT}                   ║
║                                                        ║
║   Endpoints:                                           ║
║   • GET  /api/health - Health check                    ║
║   • POST /api/scrape - Scrape website                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});
