import type {
    Adapter,
    AdapterAccount,
    AdapterSession,
    AdapterUser,
    VerificationToken
} from '@auth/core/adapters';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
    users,
    authAccounts,
    authSessions,
    authVerificationTokens
} from '../db/schema';

export function D1AuthAdapter(db: DrizzleD1Database<typeof schema>): Adapter {
    return {
        // Users
        async createUser(data) {
            const id = crypto.randomUUID();
            const user: AdapterUser = {
                id,
                name: data.name ?? null,
                email: data.email!,
                emailVerified: data.emailVerified ?? null,
                image: data.image ?? null
            };

            await db.insert(users).values({
                id,
                email: user.email,
                name: user.name ?? undefined,
                emailVerified: user.emailVerified?.toISOString() ?? null,
                image: user.image ?? null
            });

            return user;
        },

        async getUser(id) {
            try {
                const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
                if (!result || result.length === 0) return null;

                const user = result[0];
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                    image: user.image
                };
            } catch {
                return null;
            }
        },

        async getUserByEmail(email) {
            try {
                const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
                if (!result || result.length === 0) return null;

                const user = result[0];
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                    image: user.image
                };
            } catch {
                return null;
            }
        },

        async getUserByAccount({ provider, providerAccountId }) {
            try {
                const result = await db
                    .select()
                    .from(authAccounts)
                    .where(
                        and(
                            eq(authAccounts.provider, provider),
                            eq(authAccounts.providerAccountId, providerAccountId)
                        )
                    )
                    .limit(1);

                if (!result || result.length === 0) return null;

                const account = result[0];
                const userResult = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, account.userId))
                    .limit(1);

                if (!userResult || userResult.length === 0) return null;

                const user = userResult[0];
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                    image: user.image
                };
            } catch {
                return null;
            }
        },

        async updateUser(data) {
            if (!data.id) throw new Error('updateUser requires id');

            await db
                .update(users)
                .set({
                    name: data.name ?? undefined,
                    email: data.email ?? undefined,
                    emailVerified: data.emailVerified?.toISOString() ?? undefined,
                    image: data.image ?? undefined,
                    updatedAt: new Date().toISOString()
                })
                .where(eq(users.id, data.id));

            const result = await db.select().from(users).where(eq(users.id, data.id)).limit(1);
            const user = result[0];

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                image: user.image
            };
        },

        async deleteUser(id) {
            try {
                const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
                if (!result || result.length === 0) return null;

                await db.delete(users).where(eq(users.id, id));

                const user = result[0];
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                    image: user.image
                };
            } catch {
                return null;
            }
        },

        // Accounts
        async linkAccount(data) {
            const id = `${data.provider}:${data.providerAccountId}`;
            await db.insert(authAccounts).values({
                id,
                userId: data.userId,
                type: data.type,
                provider: data.provider,
                providerAccountId: data.providerAccountId,
                refreshToken: data.refresh_token ?? null,
                accessToken: data.access_token ?? null,
                expiresAt: typeof data.expires_at === 'number' ? data.expires_at : null,
                tokenType: data.token_type ?? null,
                scope: data.scope ?? null,
                idToken: data.id_token ?? null,
                sessionState: typeof data.session_state === 'string' ? data.session_state : null
            });

            return data as AdapterAccount;
        },

        async unlinkAccount({ provider, providerAccountId }) {
            const id = `${provider}:${providerAccountId}`;
            try {
                await db.delete(authAccounts).where(eq(authAccounts.id, id));
            } catch {
                /* ignore */
            }
        },

        // Sessions
        async createSession(data) {
            const session = {
                id: data.sessionToken,
                sessionToken: data.sessionToken,
                userId: data.userId,
                expires: data.expires.toISOString()
            };

            await db.insert(authSessions).values(session);

            return {
                sessionToken: session.sessionToken,
                userId: session.userId,
                expires: new Date(session.expires)
            };
        },

        async getSessionAndUser(sessionToken) {
            try {
                const sessionResult = await db
                    .select()
                    .from(authSessions)
                    .where(eq(authSessions.sessionToken, sessionToken))
                    .limit(1);

                if (!sessionResult || sessionResult.length === 0) return null;

                const session = sessionResult[0];
                const userResult = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, session.userId))
                    .limit(1);

                if (!userResult || userResult.length === 0) return null;

                const user = userResult[0];

                return {
                    session: {
                        sessionToken: session.sessionToken,
                        userId: session.userId,
                        expires: new Date(session.expires)
                    },
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                        image: user.image
                    }
                };
            } catch {
                return null;
            }
        },

        async updateSession(data) {
            const sessionToken = data.sessionToken;

            await db
                .update(authSessions)
                .set({
                    expires: data.expires?.toISOString()
                })
                .where(eq(authSessions.sessionToken, sessionToken));

            const result = await db
                .select()
                .from(authSessions)
                .where(eq(authSessions.sessionToken, sessionToken))
                .limit(1);

            if (!result || result.length === 0) return null;

            const session = result[0];
            return {
                sessionToken: session.sessionToken,
                userId: session.userId,
                expires: new Date(session.expires)
            };
        },

        async deleteSession(sessionToken) {
            try {
                const result = await db
                    .select()
                    .from(authSessions)
                    .where(eq(authSessions.sessionToken, sessionToken))
                    .limit(1);

                if (result && result.length > 0) {
                    await db.delete(authSessions).where(eq(authSessions.sessionToken, sessionToken));
                }
            } catch {
                /* ignore */
            }
        },

        // Verification Tokens
        async createVerificationToken(data) {
            const id = `${data.identifier}:${data.token}`;
            await db.insert(authVerificationTokens).values({
                id,
                identifier: data.identifier,
                token: data.token,
                expires: data.expires.toISOString()
            });

            return data;
        },

        async useVerificationToken({ identifier, token }) {
            try {
                const id = `${identifier}:${token}`;
                const result = await db
                    .select()
                    .from(authVerificationTokens)
                    .where(eq(authVerificationTokens.id, id))
                    .limit(1);

                if (!result || result.length === 0) return null;

                await db.delete(authVerificationTokens).where(eq(authVerificationTokens.id, id));

                const verificationToken = result[0];
                return {
                    identifier: verificationToken.identifier,
                    token: verificationToken.token,
                    expires: new Date(verificationToken.expires)
                };
            } catch {
                return null;
            }
        }
    };
}
