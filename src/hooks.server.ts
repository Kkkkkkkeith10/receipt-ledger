import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createDB } from '$lib/server/db';
import { handle as handleAuth } from '$lib/server/auth';
import type { D1Database } from '@cloudflare/workers-types';

const handleDB: Handle = async ({ event, resolve }) => {
  console.log(`[HOOKS] ${event.request.method} ${event.url.pathname}`);

  // Attach Cloudflare D1 and Drizzle to locals when available (Wrangler/Cloudflare runtime)
  // In Node adapter-auto dev, platform may be undefined.
  const d1 = event.platform?.env?.DB as D1Database | undefined;
  if (d1) {
    // Raw D1 database
    event.locals.db = d1;
    // Drizzle client bound to schema
    event.locals.DB = createDB(d1);
  }

  try {
    const response = await resolve(event);
    console.log(`[HOOKS] Response status: ${response.status}`);
    return response;
  } catch (error) {
    console.error('[HOOKS] Error:', error);
    throw error;
  }
};

export const handle: Handle = sequence(handleAuth, handleDB);
