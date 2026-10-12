import type { RequestHandler } from '@sveltejs/kit';
import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Get a file from R2 bucket
 * GET /api/upload/[...key]
 * 
 * This endpoint serves receipt images/PDFs stored in R2.
 * The key is the full path like: receipts/2026/RCP-2026-0001-abc123.pdf
 */
export const GET: RequestHandler = async ({ params, platform }) => {
    // Get R2 bucket from platform env (Cloudflare Workers runtime)
    const RECEIPTS = platform?.env?.RECEIPTS as R2Bucket | undefined;

    if (!RECEIPTS) {
        console.error('R2 bucket not configured - platform.env.RECEIPTS is undefined');
        return new Response('R2 storage not available', { status: 500 });
    }

    // Reconstruct the key from the catch-all parameter
    const key = params.key;
    if (!key) {
        return new Response('File not found', { status: 404 });
    }

    try {
        const object = await RECEIPTS.get(key);

        if (!object) {
            console.error(`File not found in R2: ${key}`);
            return new Response('File not found', { status: 404 });
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
        headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        headers.set('ETag', object.etag);
        headers.set('Content-Length', object.size.toString());

        return new Response(object.body, { headers });
    } catch (error) {
        console.error('Error fetching file from R2:', error);
        return new Response('Error fetching file', { status: 500 });
    }
};
