/**
 * Direct RedBus API Client
 * 
 * Calls RedBus's internal API directly from the Figma plugin.
 * No backend server needed!
 */

export interface BusSearchParams {
    fromCityId: number;
    toCityId: number;
    journeyDate: string; // Format: DD-Mon-YYYY (e.g., "23-Jan-2026")
    limit?: number;
}

export interface BusResult {
    id: string;
    operator: string;
    busType: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
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
}

export interface FetchResult {
    success: boolean;
    items: BusResult[];
    totalFound: number;
    timing: number;
    error?: string;
}

/**
 * Parse a RedBus URL to extract search parameters
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

/**
 * Fetch bus listings directly from RedBus API
 */
export async function fetchBusesDirect(params: BusSearchParams): Promise<FetchResult> {
    const startTime = Date.now();

    try {
        // Build the API URL
        const queryParams = new URLSearchParams({
            fromCity: String(params.fromCityId),
            toCity: String(params.toCityId),
            DOJ: params.journeyDate,
            limit: String(params.limit || 20),
            offset: '0',
            meta: 'true',
            groupId: '0',
            sectionId: '0',
            sort: '0',
            sortOrder: '0',
            from: 'initialLoad',
            getUuid: 'true',
            bT: '1',
        });

        const url = `https://www.redbus.in/rpw/api/searchResults?${queryParams}`;

        console.log('📡 Calling RedBus API directly...');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

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

        console.log(`✅ Got ${inventories.length} buses (${totalCount} total)`);

        // Transform to our format
        const items: BusResult[] = inventories.map((bus: any) => transformBusData(bus));

        return {
            success: true,
            items,
            totalFound: totalCount,
            timing: Date.now() - startTime,
        };

    } catch (error: any) {
        console.error('❌ API call failed:', error.message);
        return {
            success: false,
            items: [],
            totalFound: 0,
            timing: Date.now() - startTime,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Transform RedBus API response to our standard format
 */
function transformBusData(bus: any): BusResult {
    const depTime = parseTime(bus.departureTime);
    const arrTime = parseTime(bus.arrivalTime);
    const durationMins = calculateDuration(depTime, arrTime);

    const boardingPoints = (bus.boardingPoints || bus.bpList || [])
        .slice(0, 5)
        .map((p: any) => p.name || p.location || p.bpName || String(p))
        .filter(Boolean);

    const droppingPoints = (bus.droppingPoints || bus.dpList || [])
        .slice(0, 5)
        .map((p: any) => p.name || p.location || p.dpName || String(p))
        .filter(Boolean);

    const amenities = extractAmenities(bus.amenities);
    const busType = bus.busType || '';

    return {
        id: String(bus.routeId || bus.serviceId || bus.id || ''),
        operator: bus.travelsName || bus.travels || bus.operatorName || '',
        busType,
        departureTime: formatTime(depTime),
        arrivalTime: formatTime(arrTime),
        duration: formatDuration(durationMins),
        price: bus.fare || bus.baseFare || 0,
        priceFormatted: `₹${bus.fare || bus.baseFare || 0}`,
        rating: String(bus.rating || bus.busRating || '0'),
        totalRatings: bus.totalRatings || bus.ratingCount || 0,
        seatsAvailable: bus.availableSeats || bus.seatsAvailable || 0,
        route: bus.routeName || `${bus.source || 'Source'} to ${bus.destination || 'Destination'}`,
        boardingPoints,
        droppingPoints,
        amenities,
        isAc: busType.toLowerCase().includes('a/c') || busType.toLowerCase().includes('ac'),
        isSleeper: busType.toLowerCase().includes('sleeper'),
    };
}

function parseTime(dateStr: string): { hours: number; minutes: number } {
    if (!dateStr) return { hours: 0, minutes: 0 };
    const match = dateStr.match(/(\d{2}):(\d{2})/);
    if (match) {
        return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
    }
    return { hours: 0, minutes: 0 };
}

function calculateDuration(dep: { hours: number; minutes: number }, arr: { hours: number; minutes: number }): number {
    let depMins = dep.hours * 60 + dep.minutes;
    let arrMins = arr.hours * 60 + arr.minutes;
    if (arrMins < depMins) arrMins += 24 * 60; // overnight
    return arrMins - depMins;
}

function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function formatTime(time: { hours: number; minutes: number }): string {
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
}

function extractAmenities(amenities: any): string[] {
    if (!amenities) return [];
    if (Array.isArray(amenities)) {
        return amenities.map(a => typeof a === 'string' ? a : a.name || a.amenity || '').filter(Boolean);
    }
    return [];
}
