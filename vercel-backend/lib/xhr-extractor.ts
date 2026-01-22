/**
 * XHR Interceptor
 * 
 * Intercepts internal API calls made by websites to get complete structured data.
 * This is more reliable than scraping HTML and provides complete data like
 * departure times, duration, amenities, etc.
 */

import { Page, HTTPResponse } from 'puppeteer-core';

export interface XHRInterceptConfig {
    /** URL patterns to intercept (regex or string includes) */
    urlPatterns: (string | RegExp)[];
    /** Transform function to apply to response */
    transform?: (data: any) => any[];
    /** Maximum items to return */
    maxItems?: number;
    /** Timeout for waiting for the XHR (ms) */
    timeout?: number;
}

export interface XHRExtractionResult {
    success: boolean;
    items: Record<string, any>[];
    totalFound: number;
    interceptedUrl?: string;
    errors: string[];
}

/**
 * RedBus specific bus data interface (from their internal API)
 */
export interface RedBusBusData {
    id: string;
    travels: string;           // Operator name
    busType: string;           // e.g., "A/C Sleeper (2+1)"
    departureTime: string;     // e.g., "22:30"
    arrivalTime: string;       // e.g., "05:45"
    duration: string;          // e.g., "7h 15m" (computed)
    durationMinutes: number;   // Duration in minutes
    fare: number;              // Base fare
    rating: number;            // Star rating
    totalRatings: number;      // Number of ratings
    availableSeats: number;    // Available seats
    boardingPoints: string[];  // Boarding point names
    droppingPoints: string[];  // Dropping point names
    amenities: string[];       // Amenities list
    routeName: string;         // Route description
}

/**
 * Preset configurations for different sites
 */
export const XHR_PRESETS: Record<string, XHRInterceptConfig> = {
    redbus: {
        urlPatterns: [
            /\/search\/getbuslist/i,
            /\/bus-tickets.*getbuslist/i,
            /api.*buslist/i,
            /getSearchResult/i,
        ],
        maxItems: 50,
        timeout: 15000,
        transform: (data: any) => transformRedBusData(data),
    },
};

/**
 * Transform RedBus API response to our standard format
 */
function transformRedBusData(data: any): any[] {
    try {
        // RedBus returns data in various formats, handle them
        let busList: any[] = [];
        
        // Try different possible response structures
        if (data?.inventoryItems) {
            busList = data.inventoryItems;
        } else if (data?.busListData?.busList) {
            busList = data.busListData.busList;
        } else if (data?.busList) {
            busList = data.busList;
        } else if (data?.result?.inventoryItems) {
            busList = data.result.inventoryItems;
        } else if (Array.isArray(data)) {
            busList = data;
        } else if (data?.data?.busList) {
            busList = data.data.busList;
        } else if (data?.data?.inventoryItems) {
            busList = data.data.inventoryItems;
        }

        if (!Array.isArray(busList) || busList.length === 0) {
            console.log('RedBus data structure:', JSON.stringify(data).slice(0, 500));
            return [];
        }

        return busList.map((bus: any) => {
            // Calculate duration from departure and arrival times
            const depTime = bus.departureTime || bus.depTime || bus.dt || '';
            const arrTime = bus.arrivalTime || bus.arrTime || bus.at || '';
            const durationMins = bus.duration || bus.durationInMins || 
                calculateDuration(depTime, arrTime);
            
            // Format duration as human readable
            const durationFormatted = formatDuration(durationMins);

            // Extract boarding points
            const boardingPoints = extractPoints(bus.boardingPoints || bus.bpList || bus.bp || []);
            const droppingPoints = extractPoints(bus.droppingPoints || bus.dpList || bus.dp || []);

            // Extract amenities
            const amenities = extractAmenities(bus.amenities || bus.ac || []);

            return {
                id: String(bus.id || bus.busId || bus.serviceId || ''),
                operator: bus.travels || bus.travelsName || bus.operator || bus.busOperator || '',
                busType: bus.busType || bus.busTypeName || bus.type || '',
                departureTime: formatTime(depTime),
                arrivalTime: formatTime(arrTime),
                duration: durationFormatted,
                durationMinutes: durationMins,
                price: bus.fare || bus.fares?.[0]?.totalFare || bus.baseFare || 0,
                priceFormatted: `₹${bus.fare || bus.fares?.[0]?.totalFare || bus.baseFare || 0}`,
                rating: String(bus.rating || bus.busRating || bus.ratings?.overall || '0'),
                totalRatings: bus.totalRatings || bus.ratingCount || bus.ratings?.count || 0,
                seatsAvailable: bus.availableSeats || bus.seatsAvailable || bus.availSeats || 0,
                route: bus.routeName || bus.route || `${bus.source || ''} to ${bus.destination || ''}`,
                boardingPoints,
                droppingPoints,
                amenities,
                // Additional fields
                busPartner: bus.busPartner || bus.partner || '',
                cancellationPolicy: bus.cancellationPolicy || bus.partialCancellationAllowed ? 'Partial cancellation allowed' : '',
                isAc: bus.ac || bus.isAC || bus.busType?.toLowerCase().includes('a/c') || false,
                isSleeper: bus.sleeper || bus.isSleeper || bus.busType?.toLowerCase().includes('sleeper') || false,
            };
        });
    } catch (error) {
        console.error('Error transforming RedBus data:', error);
        return [];
    }
}

/**
 * Calculate duration in minutes from departure and arrival times
 */
function calculateDuration(depTime: string, arrTime: string): number {
    try {
        const [depH, depM] = depTime.split(':').map(Number);
        const [arrH, arrM] = arrTime.split(':').map(Number);
        
        let depMins = depH * 60 + depM;
        let arrMins = arrH * 60 + arrM;
        
        // Handle overnight journeys
        if (arrMins < depMins) {
            arrMins += 24 * 60;
        }
        
        return arrMins - depMins;
    } catch {
        return 0;
    }
}

/**
 * Format duration from minutes to human readable string
 */
function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

/**
 * Format time to HH:MM format
 */
function formatTime(time: string | number): string {
    if (!time) return '';
    if (typeof time === 'number') {
        // Handle time as minutes from midnight
        const hours = Math.floor(time / 60);
        const mins = time % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    // Already a string, just ensure format
    const match = String(time).match(/(\d{1,2}):?(\d{2})/);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return String(time);
}

/**
 * Extract boarding/dropping points from various formats
 */
function extractPoints(points: any): string[] {
    if (!points) return [];
    if (Array.isArray(points)) {
        return points.map(p => {
            if (typeof p === 'string') return p;
            return p.name || p.location || p.bpName || p.dpName || String(p);
        }).filter(Boolean).slice(0, 5); // Limit to 5 points
    }
    return [];
}

/**
 * Extract amenities from various formats
 */
function extractAmenities(amenities: any): string[] {
    if (!amenities) return [];
    if (Array.isArray(amenities)) {
        return amenities.map(a => {
            if (typeof a === 'string') return a;
            return a.name || a.amenity || a.title || String(a);
        }).filter(Boolean);
    }
    if (typeof amenities === 'object') {
        // Handle object format { wifi: true, charging: true, ... }
        return Object.entries(amenities)
            .filter(([_, v]) => v === true)
            .map(([k, _]) => formatAmenityName(k));
    }
    return [];
}

/**
 * Format amenity names from camelCase to readable
 */
function formatAmenityName(name: string): string {
    const map: Record<string, string> = {
        wifi: 'WiFi',
        charging: 'Charging Point',
        water: 'Water Bottle',
        blanket: 'Blanket',
        tv: 'TV',
        ac: 'A/C',
        reading_light: 'Reading Light',
        track: 'Live Tracking',
    };
    return map[name.toLowerCase()] || name.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Intercept XHR/fetch requests and extract data
 */
export async function extractViaXHR(
    page: Page,
    config: XHRInterceptConfig
): Promise<XHRExtractionResult> {
    const result: XHRExtractionResult = {
        success: false,
        items: [],
        totalFound: 0,
        errors: [],
    };

    const capturedData: any[] = [];
    const timeout = config.timeout || 15000;

    // Set up response interception
    const responseHandler = async (response: HTTPResponse) => {
        try {
            const url = response.url();
            const matchesPattern = config.urlPatterns.some(pattern => {
                if (pattern instanceof RegExp) {
                    return pattern.test(url);
                }
                return url.includes(pattern);
            });

            if (matchesPattern) {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    try {
                        const data = await response.json();
                        console.log(`📡 Intercepted XHR: ${url.slice(0, 100)}...`);
                        result.interceptedUrl = url;
                        capturedData.push(data);
                    } catch (e) {
                        // Response might not be JSON or already consumed
                    }
                }
            }
        } catch (e) {
            // Ignore errors from response handling
        }
    };

    page.on('response', responseHandler);

    try {
        // Wait for XHR data to be captured
        // The page should already be loaded, we're just waiting for any pending requests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // If no data captured yet, try scrolling to trigger lazy loading
        if (capturedData.length === 0) {
            console.log('🔄 Scrolling to trigger XHR requests...');
            await page.evaluate(() => {
                window.scrollBy(0, 500);
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Process captured data
        if (capturedData.length > 0) {
            for (const data of capturedData) {
                const transformed = config.transform ? config.transform(data) : [data];
                result.items.push(...transformed);
            }
            
            result.totalFound = result.items.length;
            
            // Apply max items limit
            if (config.maxItems && result.items.length > config.maxItems) {
                result.items = result.items.slice(0, config.maxItems);
            }
            
            result.success = result.items.length > 0;
            
            if (!result.success) {
                result.errors.push('XHR intercepted but no items extracted - data format may have changed');
            }
        } else {
            result.errors.push('No matching XHR requests intercepted');
        }

    } finally {
        page.off('response', responseHandler);
    }

    return result;
}

/**
 * Alternative: Extract from page's fetch/XHR by injecting a script
 * This captures requests that may have already completed before our listener
 */
export async function extractViaInjection(page: Page): Promise<XHRExtractionResult> {
    const result: XHRExtractionResult = {
        success: false,
        items: [],
        totalFound: 0,
        errors: [],
    };

    try {
        // Try to find RedBus data in various global variables
        const data = await page.evaluate(() => {
            // RedBus stores data in various places
            const w = window as any;
            
            // Check common data stores
            const sources = [
                w.__INITIAL_STATE__,
                w.__PRELOADED_STATE__,
                w.__REDUX_STATE__,
                w.busListData,
                w.searchResult,
                w.pageData,
                w.__NEXT_DATA__?.props?.pageProps,
                document.querySelector('script#__NEXT_DATA__')?.textContent,
            ];

            for (const source of sources) {
                if (source) {
                    try {
                        const data = typeof source === 'string' ? JSON.parse(source) : source;
                        // Look for bus list in the data
                        const findBusList = (obj: any, depth = 0): any[] | null => {
                            if (depth > 5 || !obj) return null;
                            if (Array.isArray(obj) && obj.length > 0 && obj[0]?.travels) {
                                return obj;
                            }
                            if (typeof obj === 'object') {
                                for (const key of Object.keys(obj)) {
                                    if (key.toLowerCase().includes('bus') || 
                                        key.toLowerCase().includes('inventory') ||
                                        key.toLowerCase().includes('result')) {
                                        const found = findBusList(obj[key], depth + 1);
                                        if (found) return found;
                                    }
                                }
                            }
                            return null;
                        };
                        
                        const busList = findBusList(data);
                        if (busList && busList.length > 0) {
                            return { found: true, data: busList };
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            return { found: false, data: null };
        });

        if (data.found && data.data) {
            result.items = transformRedBusData({ busList: data.data });
            result.totalFound = result.items.length;
            result.success = result.items.length > 0;
        } else {
            result.errors.push('Could not find bus data in page state');
        }

    } catch (error: any) {
        result.errors.push(`Injection extraction failed: ${error.message}`);
    }

    return result;
}
