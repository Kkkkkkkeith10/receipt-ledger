declare global {
	namespace App {
		interface Locals {
			auth: import('@auth/sveltekit').RequestEvent['locals']['auth'];
			db: D1Database;
			DB: import('drizzle-orm/d1').DrizzleD1Database<typeof import('$lib/server/db/schema') >;
			user: import('lucia').User | null;
			session: import('lucia').Session | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				RECEIPTS: R2Bucket;
				// Azure OpenAI for receipt AI recognition
				AZURE_OPENAI_ENDPOINT: string;
				AZURE_OPENAI_KEY: string;
				AZURE_OPENAI_DEPLOYMENT: string;
				// Auth.js secret
				AUTH_SECRET: string;
			};
		}
	}
}

export { };
