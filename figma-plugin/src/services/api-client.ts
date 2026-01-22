import { ScrapeAPIRequest, ScrapeAPIResponse } from '../types/messages';

// Configure your backend URL here - use localhost for development
const API_BASE_URL = 'http://localhost:3000';

export class APIClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    async scrape(request: ScrapeAPIRequest): Promise<ScrapeAPIResponse> {
        const response = await fetch(`${this.baseUrl}/api/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async fetchImageAsBytes(url: string): Promise<Uint8Array> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }
}

export const apiClient = new APIClient();
