import puppeteer, { Browser } from 'puppeteer-core';

// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function getBrowser(): Promise<Browser> {
    if (isVercel) {
        // Use @sparticuz/chromium for Vercel serverless
        const chromium = await import('@sparticuz/chromium');
        const executablePath = await chromium.default.executablePath();

        return puppeteer.launch({
            args: chromium.default.args,
            executablePath,
            headless: true,
        });
    } else {
        // Local development - use regular puppeteer
        const puppeteerFull = await import('puppeteer');
        return puppeteerFull.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        }) as unknown as Browser;
    }
}
