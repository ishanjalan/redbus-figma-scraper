/**
 * Direct API Client for RedBus
 * 
 * Calls RedBus's internal API directly without a browser.
 * This is MUCH faster than Puppeteer (~2s vs 10-30s).
 * 
 * API Endpoint: https://www.redbus.in/rpw/api/searchResults
 */

export interface DirectAPIConfig {
    /** Base URL for the API */
    baseUrl?: string;
    /** Request timeout in ms */
    timeout?: number;
    /** User agent string */
    userAgent?: string;
    /** Add delay between requests (rate limiting) */
    delayMs?: number;
}

export interface BusSearchParams {
    fromCityId: number;
    toCityId: number;
    journeyDate: string; // Format: DD-Mon-YYYY (e.g., "23-Jan-2026")
    limit?: number;
    offset?: number;
}

export interface BusResult {
    id: string;
    operator: string;
    busType: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    durationMinutes: number;
    price: number;
    priceFormatted: string;
    rating: string;
    totalRatings: number;
    seatsAvailable: number;
    route: string;
    boardingPoints: string[];
    droppingPoints: string[];
    amenities: string[];
    isAc: boolean;
    isSleeper: boolean;
    cancellationPolicy: string;
}

export interface DirectAPIResult {
    success: boolean;
    items: BusResult[];
    totalFound: number;
    source: 'direct-api';
    timing: number;
    errors: string[];
}

const DEFAULT_CONFIG: DirectAPIConfig = {
    baseUrl: 'https://www.redbus.in',
    timeout: 10000,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    delayMs: 100,
};

/**
 * Fetch bus listings directly from RedBus API
 */
export async function fetchBusesDirectAPI(
    params: BusSearchParams,
    config: DirectAPIConfig = {}
): Promise<DirectAPIResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    const errors: string[] = [];

    try {
        // Build the API URL
        const queryParams = new URLSearchParams({
            fromCity: String(params.fromCityId),
            toCity: String(params.toCityId),
            DOJ: params.journeyDate,
            limit: String(params.limit || 20),
            offset: String(params.offset || 0),
            meta: 'true',
            groupId: '0',
            sectionId: '0',
            sort: '0',
            sortOrder: '0',
            from: 'initialLoad',
            getUuid: 'true',
            bT: '1',
        });

        const url = `${cfg.baseUrl}/rpw/api/searchResults?${queryParams}`;

        console.log(`📡 Direct API call: ${url.slice(0, 100)}...`);

        // Make the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': cfg.userAgent!,
                'Referer': `${cfg.baseUrl}/bus-tickets`,
                'Origin': cfg.baseUrl!,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'API returned unsuccessful response');
        }

        // Extract bus data
        const inventories = data.data?.inventories || [];
        const totalCount = data.data?.metaData?.totalCount || 0;

        console.log(`✅ Direct API: ${inventories.length} buses returned (${totalCount} total)`);

        // Transform to our format
        const items: BusResult[] = inventories.map((bus: any) => transformBusData(bus));

        return {
            success: true,
            items,
            totalFound: totalCount,
            source: 'direct-api',
            timing: Date.now() - startTime,
            errors,
        };

    } catch (error: any) {
        const errorMsg = error.name === 'AbortError' 
            ? 'Request timed out' 
            : error.message || 'Unknown error';
        
        console.error(`❌ Direct API failed: ${errorMsg}`);
        errors.push(errorMsg);

        return {
            success: false,
            items: [],
            totalFound: 0,
            source: 'direct-api',
            timing: Date.now() - startTime,
            errors,
        };
    }
}

/**
 * Transform RedBus API response to our standard format
 */
function transformBusData(bus: any): BusResult {
    // Parse departure and arrival times
    const depTime = parseDateTime(bus.departureTime);
    const arrTime = parseDateTime(bus.arrivalTime);
    
    // Calculate duration
    const durationMins = calculateDurationMinutes(depTime, arrTime);
    const durationFormatted = formatDuration(durationMins);

    // Extract boarding/dropping points
    const boardingPoints = (bus.boardingPoints || bus.bpList || [])
        .slice(0, 5)
        .map((p: any) => p.name || p.location || p.bpName || String(p))
        .filter(Boolean);
    
    const droppingPoints = (bus.droppingPoints || bus.dpList || [])
        .slice(0, 5)
        .map((p: any) => p.name || p.location || p.dpName || String(p))
        .filter(Boolean);

    // Extract amenities
    const amenities = extractAmenities(bus.amenities || bus.ac || []);

    // Determine bus features
    const busType = bus.busType || '';
    const isAc = busType.toLowerCase().includes('a/c') || busType.toLowerCase().includes('ac');
    const isSleeper = busType.toLowerCase().includes('sleeper');

    return {
        id: String(bus.routeId || bus.serviceId || bus.id || ''),
        operator: bus.travelsName || bus.travels || bus.operatorName || '',
        busType: busType,
        departureTime: formatTime(depTime),
        arrivalTime: formatTime(arrTime),
        duration: durationFormatted,
        durationMinutes: durationMins,
        price: bus.fare || bus.baseFare || 0,
        priceFormatted: `₹${bus.fare || bus.baseFare || 0}`,
        rating: String(bus.rating || bus.busRating || '0'),
        totalRatings: bus.totalRatings || bus.ratingCount || 0,
        seatsAvailable: bus.availableSeats || bus.seatsAvailable || 0,
        route: bus.routeName || `${bus.source || 'Source'} to ${bus.destination || 'Destination'}`,
        boardingPoints,
        droppingPoints,
        amenities,
        isAc,
        isSleeper,
        cancellationPolicy: bus.cancellationPolicy || '',
    };
}

/**
 * Parse datetime string to { hours, minutes }
 */
function parseDateTime(dateStr: string): { hours: number; minutes: number } {
    if (!dateStr) return { hours: 0, minutes: 0 };
    
    // Handle "2026-01-23 22:40:00" format
    const match = dateStr.match(/(\d{2}):(\d{2})/);
    if (match) {
        return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
    }
    
    return { hours: 0, minutes: 0 };
}

/**
 * Calculate duration in minutes
 */
function calculateDurationMinutes(
    dep: { hours: number; minutes: number },
    arr: { hours: number; minutes: number }
): number {
    let depMins = dep.hours * 60 + dep.minutes;
    let arrMins = arr.hours * 60 + arr.minutes;
    
    // Handle overnight journeys
    if (arrMins < depMins) {
        arrMins += 24 * 60;
    }
    
    return arrMins - depMins;
}

/**
 * Format duration as "Xh Ym"
 */
function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

/**
 * Format time as "HH:MM"
 */
function formatTime(time: { hours: number; minutes: number }): string {
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
}

/**
 * Extract amenities from various formats
 */
function extractAmenities(amenities: any): string[] {
    if (!amenities) return [];
    
    if (Array.isArray(amenities)) {
        return amenities.map(a => {
            if (typeof a === 'string') return a;
            return a.name || a.amenity || a.title || '';
        }).filter(Boolean);
    }
    
    if (typeof amenities === 'object') {
        const amenityMap: Record<string, string> = {
            wifi: 'WiFi',
            charging: 'Charging Point',
            water: 'Water Bottle',
            blanket: 'Blanket',
            tv: 'TV',
            ac: 'A/C',
            reading_light: 'Reading Light',
            track: 'Live Tracking',
        };
        
        return Object.entries(amenities)
            .filter(([_, v]) => v === true)
            .map(([k, _]) => amenityMap[k.toLowerCase()] || k);
    }
    
    return [];
}

/**
 * Parse date from URL format (DD-Mon-YYYY) to API format
 */
export function parseRedBusDate(dateStr: string): string {
    // Already in correct format for the API
    return dateStr;
}

/**
 * Extract search params from a RedBus URL
 */
export function parseRedBusUrl(url: string): BusSearchParams | null {
    try {
        const urlObj = new URL(url);
        const fromCityId = urlObj.searchParams.get('fromCityId');
        const toCityId = urlObj.searchParams.get('toCityId');
        const journeyDate = urlObj.searchParams.get('onward') || urlObj.searchParams.get('doj');

        if (!fromCityId || !toCityId || !journeyDate) {
            return null;
        }

        return {
            fromCityId: parseInt(fromCityId),
            toCityId: parseInt(toCityId),
            journeyDate,
        };
    } catch {
        return null;
    }
}
