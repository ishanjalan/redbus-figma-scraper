/**
 * Selector Extractor - Extracts data from DOM using CSS selectors
 * This module is designed to run in the browser context via Puppeteer's page.evaluate()
 */

export interface SelectorConfig {
    id: string;
    selector: string;
    type: 'text' | 'image';
    modifier?: string;
    attribute?: string;
    index?: number; // Pick the Nth element from querySelectorAll results (0-indexed)
}

export interface ExtractedResult {
    id: string;
    found: boolean;
    data?: string;
    type: 'text' | 'image';
    originalId?: string;
    index?: number;
    error?: string;
}

/**
 * Extract data from a single element based on selector config
 */
export function extractFromElement(
    element: Element,
    config: SelectorConfig
): string {
    // Handle attribute extraction
    if (config.modifier === 'attr' && config.attribute) {
        return element.getAttribute(config.attribute) || '';
    }

    // Handle href extraction
    if (config.modifier === 'href' && element instanceof HTMLAnchorElement) {
        return element.href || '';
    }

    // Handle src extraction (for images)
    if (config.modifier === 'src' || config.type === 'image') {
        if (element instanceof HTMLImageElement) {
            return element.src || '';
        }
        
        // Check for background-image
        const style = window.getComputedStyle(element);
        const backgroundImage = style.backgroundImage;
        if (backgroundImage && backgroundImage !== 'none') {
            const match = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
            return match ? match[1] : '';
        }
        
        // Check for srcset
        if (element.hasAttribute('srcset')) {
            const srcset = element.getAttribute('srcset') || '';
            // Get the first (usually smallest) image from srcset
            const firstSrc = srcset.split(',')[0]?.trim().split(' ')[0];
            return firstSrc || '';
        }
        
        return '';
    }

    // Handle inner HTML
    if (config.modifier === 'html') {
        return element.innerHTML || '';
    }

    // Default: text content
    return element.textContent?.trim() || '';
}

/**
 * Extract data from page for all selectors
 * This function is designed to be serialized and run in browser context
 * 
 * @param maxResults - Maximum number of results to return for .all selectors (default: 10)
 */
export function createExtractorScript(maxResults: number = 10): string {
    return `
        (function(selectorsList, maxResults) {
            const results = [];

            // Helper to extract data from an element
            function extractData(element, config) {
                let data = '';
                
                // Attribute extraction
                if (config.modifier === 'attr' && config.attribute) {
                    data = element.getAttribute(config.attribute) || '';
                }
                // Href extraction
                else if (config.modifier === 'href' && element instanceof HTMLAnchorElement) {
                    data = element.href || '';
                }
                // Src/Image extraction
                else if (config.modifier === 'src' || config.type === 'image') {
                    if (element instanceof HTMLImageElement) {
                        data = element.src || '';
                    } else {
                        const style = window.getComputedStyle(element);
                        const bgImage = style.backgroundImage;
                        if (bgImage && bgImage !== 'none') {
                            const match = bgImage.match(/url\\(['"]?(.*?)['"]?\\)/);
                            data = match ? match[1] : '';
                        }
                    }
                }
                // HTML content
                else if (config.modifier === 'html') {
                    data = element.innerHTML || '';
                }
                // Default: text content
                else {
                    data = element.textContent?.trim() || '';
                }
                
                return data;
            }

            selectorsList.forEach((config) => {
                try {
                    if (config.modifier === 'all') {
                        // Handle .all modifier - extract from all matching elements
                        const elements = document.querySelectorAll(config.selector);
                        
                        if (elements.length === 0) {
                            results.push({
                                id: config.id,
                                found: false,
                                type: config.type,
                                error: 'No elements found'
                            });
                            return;
                        }

                        // Limit results to maxResults
                        const limitedElements = Array.from(elements).slice(0, maxResults);
                        
                        limitedElements.forEach((element, index) => {
                            const data = extractData(element, config);
                            results.push({
                                id: config.id + '_' + index,
                                originalId: config.id,
                                found: true,
                                data: data,
                                type: config.type,
                                index: index
                            });
                        });
                    } else if (config.index !== undefined && config.index !== null) {
                        // Handle indexed extraction - pick the Nth element from querySelectorAll results
                        const elements = document.querySelectorAll(config.selector);
                        
                        if (elements.length === 0) {
                            results.push({
                                id: config.id,
                                found: false,
                                type: config.type,
                                error: 'No elements found for selector: ' + config.selector
                            });
                            return;
                        }
                        
                        if (config.index >= elements.length) {
                            results.push({
                                id: config.id,
                                found: false,
                                type: config.type,
                                error: 'Index ' + config.index + ' out of bounds (found ' + elements.length + ' elements)'
                            });
                            return;
                        }
                        
                        const element = elements[config.index];
                        const data = extractData(element, config);
                        
                        results.push({
                            id: config.id,
                            found: true,
                            data: data,
                            type: config.type
                        });
                    } else {
                        // Handle single element (querySelector)
                        const element = document.querySelector(config.selector);
                        
                        if (!element) {
                            results.push({
                                id: config.id,
                                found: false,
                                type: config.type,
                                error: 'Element not found for selector: ' + config.selector
                            });
                            return;
                        }

                        const data = extractData(element, config);

                        results.push({
                            id: config.id,
                            found: true,
                            data: data,
                            type: config.type
                        });
                    }
                } catch (error) {
                    results.push({
                        id: config.id,
                        found: false,
                        type: config.type,
                        error: error.message || 'Extraction error'
                    });
                }
            });

            return results;
        })
    `;
}
