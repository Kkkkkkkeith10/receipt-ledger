import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { D1AuthAdapter } from './d1-auth-adapter';
import { signInSchema } from '$lib/schemas/auth';
import { verifyUserCredentials } from './user-credentials';
import { ZodError } from 'zod';
import { createDB } from '../db';
import type { D1Database } from '@cloudflare/workers-types';

export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
    // Get D1 database from platform
    const d1 = event.platform?.env?.DB as D1Database | undefined;

    // Get AUTH_SECRET from platform env (required for Cloudflare Workers)
    const authSecret = (event.platform?.env as any)?.AUTH_SECRET || process.env.AUTH_SECRET;

    if (!d1) {
        console.warn('D1 database not available - auth will not work');
    }

    const db = d1 ? createDB(d1) : null;

    return {
        secret: authSecret,
        adapter: db ? D1AuthAdapter(db) : undefined,
        session: { strategy: 'jwt' },
        callbacks: {
            async jwt({ token, user }) {
                // On sign-in, persist essential fields into the JWT
                if (user) {
                    (token as any).id = (user as any).id ?? token.sub;
                    token.name = user.name ?? token.name;
                    token.email = user.email ?? token.email;
                }
                return token;
            },
            async session({ session, token }) {
                // Surface id and other fields on session.user for server/client use
                const id = (token as any).id ?? token.sub;
                (session.user as any) = {
                    ...(session.user ?? {}),
                    id,
                    name: session.user?.name ?? (token as any).name ?? undefined,
                    email: session.user?.email ?? token.email
                };
                return session;
            }
        },
        providers: [
            Credentials({
                credentials: {
                    email: {
                        label: 'Email',
                        type: 'email',
                        placeholder: 'your-email@example.com'
                    },
                    password: {
                        label: 'Password',
                        type: 'password',
                        placeholder: 'Enter your password'
                    }
                },
                authorize: async (credentials) => {
                    if (!db) {
                        console.error('Database not available for authentication');
                        return null;
                    }

                    try {
                        // Validate credentials using Zod schema
                        const { email, password } = await signInSchema.parseAsync(credentials);

                        // Verify user credentials
                        const user = await verifyUserCredentials(db, email, password);

                        if (!user) {
                            console.log('Invalid credentials for email:', email);
                            throw new Error('Invalid email or password');
                        }

                        // Return user object in the format Auth.js expects
                        return {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            image: user.image ?? null
                        };
                    } catch (error) {
                        if (error instanceof ZodError) {
                            console.error('Credential validation error:', error.issues);
                            return null;
                        }
                        console.error('Authorization error:', error);
                        return null;
                    }
                }
            })
        ],
        pages: {
            signIn: '/login'
        },
        trustHost: true,
        basePath: '/auth'
    };
});
