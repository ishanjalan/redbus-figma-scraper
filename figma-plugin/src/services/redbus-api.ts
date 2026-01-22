/**
 * RedBus Internal API Client
 * 
 * This module provides direct access to RedBus internal APIs for fetching
 * bus search data. This is the recommended data source as it provides
 * complete data including duration, departure/arrival times, and amenities.
 * 
 * Configuration:
 * - Update API_BASE_URL when the internal API endpoint is available
 * - Update API_KEY with the provisioned key from Engineering
 */

// Configuration - Update these when the internal API is available
const API_BASE_URL = 'https://api-internal.redbus.in'; // Placeholder
const API_KEY = ''; // Will be provided by Engineering team

// Feature flag - set to true when API is configured
const API_ENABLED = false;

export interface BusSearchParams {
    fromCityId: number;
    toCityId: number;
    date: string; // Format: DD-Mon-YYYY (e.g., "23-Jan-2026")
    maxResults?: number;
}

export interface BusListing {
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
    isPrimarySeller: boolean;
    cancellationPolicy: string;
}

export interface BusSearchResponse {
    success: boolean;
    meta: {
        fromCity: string;
        toCity: string;
        journeyDate: string;
        totalResults: number;
        returnedResults: number;
    };
    buses: BusListing[];
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Check if the internal API is configured and available
 */
export function isApiConfigured(): boolean {
    return API_ENABLED && API_KEY.length > 0;
}

/**
 * Get the API configuration status
 */
export function getApiStatus(): { configured: boolean; message: string } {
    if (!API_ENABLED) {
        return {
            configured: false,
            message: 'Internal API is not enabled. Contact Engineering team to enable.'
        };
    }
    if (!API_KEY) {
        return {
            configured: false,
            message: 'API key not configured. Contact Engineering team to get API key.'
        };
    }
    return {
        configured: true,
        message: 'API is configured and ready.'
    };
}

/**
 * Fetch bus listings from the internal API
 * 
 * @param params Search parameters
 * @returns Array of bus listings
 * @throws Error if API is not configured or request fails
 */
export async function fetchBusListings(params: BusSearchParams): Promise<BusListing[]> {
    if (!isApiConfigured()) {
        throw new Error('Internal API is not configured. Please use DataLayer or Selector mode as fallback.');
    }

    const { fromCityId, toCityId, date, maxResults = 10 } = params;

    // Convert date format from DD-Mon-YYYY to YYYY-MM-DD for API
    const journeyDate = convertDateFormat(date);

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/figma/bus-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Figma-Plugin-Key': API_KEY,
            },
            body: JSON.stringify({
                fromCityId,
                toCityId,
                journeyDate,
                maxResults,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: BusSearchResponse = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Unknown API error');
        }

        return data.buses;
    } catch (error: any) {
        // Re-throw with more context
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Cannot reach internal API. Are you connected to the RedBus network?');
        }
        throw error;
    }
}

/**
 * Convert date from DD-Mon-YYYY (RedBus URL format) to YYYY-MM-DD (API format)
 */
function convertDateFormat(dateStr: string): string {
    const months: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    // Handle DD-Mon-YYYY format
    const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/);
    if (match) {
        const [, day, monthStr, year] = match;
        const month = months[monthStr] || '01';
        return `${year}-${month}-${day.padStart(2, '0')}`;
    }

    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Fallback: return today's date
    return new Date().toISOString().split('T')[0];
}

/**
 * Mock data for testing when API is not available
 * This can be used for UI development before the API is ready
 */
export function getMockBusListings(count: number = 10): BusListing[] {
    const operators = ['FRESHBUS', 'IntrCity SmartBus', 'Orange Travels', 'VRL Travels', 'SRS Travels'];
    const busTypes = ['A/C Sleeper (2+1)', 'A/C Seater (2+2)', 'Non A/C Sleeper', 'Volvo Multi-Axle'];
    const amenities = ['WiFi', 'Charging Point', 'Water Bottle', 'Blanket', 'Reading Light', 'TV'];

    return Array.from({ length: count }, (_, i) => ({
        id: `mock_bus_${i + 1}`,
        operator: operators[i % operators.length],
        busType: busTypes[i % busTypes.length],
        departureTime: `${String(20 + (i % 4)).padStart(2, '0')}:${String((i * 15) % 60).padStart(2, '0')}`,
        arrivalTime: `${String(4 + (i % 4)).padStart(2, '0')}:${String((i * 20) % 60).padStart(2, '0')}`,
        duration: `${6 + (i % 3)}h ${(i * 15) % 60}m`,
        durationMinutes: (6 + (i % 3)) * 60 + (i * 15) % 60,
        price: 500 + (i * 100),
        priceFormatted: `₹${500 + (i * 100)}`,
        rating: (3.5 + (i % 15) / 10).toFixed(1),
        totalRatings: 500 + (i * 200),
        seatsAvailable: 10 + (i % 25),
        route: 'Bangalore to Tirupati',
        boardingPoints: ['Majestic', 'Silk Board', 'Electronic City'],
        droppingPoints: ['Tirupati Bus Stand', 'Railway Station'],
        amenities: amenities.slice(0, 3 + (i % 3)),
        isPrimarySeller: i % 2 === 0,
        cancellationPolicy: 'Free cancellation until 6 hours before departure',
    }));
}
