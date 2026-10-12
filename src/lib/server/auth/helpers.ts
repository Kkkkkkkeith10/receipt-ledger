import { error, type RequestEvent } from '@sveltejs/kit';

/**
 * Check if the request is authenticated.
 * Throws a 401 error if not authenticated.
 */
export async function requireAuth(event: RequestEvent) {
    const session = await event.locals.auth();

    if (!session?.user) {
        throw error(401, 'Unauthorized');
    }

    return session;
}

/**
 * Get the session if authenticated, or null if not.
 * Does not throw - use for optional auth.
 */
export async function getSession(event: RequestEvent) {
    return await event.locals.auth();
}
