/**
 * Image handling utilities for the Web Scraper Sync plugin
 * 
 * Images require special handling because:
 * - Code sandbox can't make network requests
 * - UI can fetch images but can't access Figma API
 * 
 * Solution: UI fetches image → converts to Uint8Array → sends to Code → Code creates image fill
 */

/**
 * Fetch an image from URL and convert to Uint8Array
 */
export async function fetchImageAsBytes(url: string): Promise<Uint8Array> {
    // Handle relative URLs
    const absoluteUrl = url.startsWith('//') ? `https:${url}` : url;
    
    const response = await fetch(absoluteUrl, {
        mode: 'cors',
        credentials: 'omit',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`URL did not return an image (got ${contentType})`);
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

/**
 * Batch fetch multiple images in parallel with error handling
 */
export async function fetchImagesAsBytes(
    urls: Array<{ id: string; url: string }>
): Promise<Array<{ id: string; bytes?: Uint8Array; error?: string }>> {
    return Promise.all(
        urls.map(async ({ id, url }) => {
            try {
                const bytes = await fetchImageAsBytes(url);
                return { id, bytes };
            } catch (error) {
                return {
                    id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        })
    );
}

/**
 * Check if a URL is likely an image based on extension
 */
export function isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const urlLower = url.toLowerCase();
    return imageExtensions.some((ext) => urlLower.includes(ext));
}

/**
 * Get image dimensions from bytes (basic implementation)
 * Returns null if dimensions cannot be determined
 */
export function getImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
    // PNG signature and IHDR chunk
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        // PNG: width at bytes 16-19, height at bytes 20-23 (big endian)
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
    }

    // JPEG signature
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        // JPEG: need to find SOF0 marker (0xFF 0xC0) and read dimensions
        let i = 2;
        while (i < bytes.length - 9) {
            if (bytes[i] === 0xff) {
                const marker = bytes[i + 1];
                // SOF0, SOF1, SOF2 markers
                if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
                    const height = (bytes[i + 5] << 8) | bytes[i + 6];
                    const width = (bytes[i + 7] << 8) | bytes[i + 8];
                    return { width, height };
                }
                const length = (bytes[i + 2] << 8) | bytes[i + 3];
                i += 2 + length;
            } else {
                i++;
            }
        }
    }

    return null;
}
