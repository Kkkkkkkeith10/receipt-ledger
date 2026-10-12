import { verifyPassword } from './password';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

export interface UserCredentials {
    id: string;
    email: string;
    name: string;
    hashedPassword?: string | null;
    image?: string | null;
}

/**
 * Get user by email from the users table
 */
export async function getUserByEmail(
    db: DrizzleD1Database<typeof schema>,
    email: string
): Promise<UserCredentials | null> {
    try {
        const result = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!result || result.length === 0) {
            return null;
        }

        const user = result[0];
        return {
            id: user.id,
            email: user.email,
            name: user.name || user.email,
            hashedPassword: user.hashedPassword,
            image: null
        };
    } catch (error) {
        console.error('Error fetching user by email:', error);
        return null;
    }
}

/**
 * Get user by ID from the users table
 */
export async function getUserById(
    db: DrizzleD1Database<typeof schema>,
    id: string
): Promise<UserCredentials | null> {
    try {
        const result = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (!result || result.length === 0) {
            return null;
        }

        const user = result[0];
        return {
            id: user.id,
            email: user.email,
            name: user.name || user.email,
            hashedPassword: user.hashedPassword,
            image: null
        };
    } catch (error) {
        console.error('Error fetching user by id:', error);
        return null;
    }
}

/**
 * Verify user credentials for login
 * Returns the user object if credentials are valid, null otherwise
 */
export async function verifyUserCredentials(
    db: DrizzleD1Database<typeof schema>,
    email: string,
    password: string
): Promise<Omit<UserCredentials, 'hashedPassword'> | null> {
    const user = await getUserByEmail(db, email);

    if (!user || !user.hashedPassword) {
        return null;
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.hashedPassword);

    if (!isValidPassword) {
        return null;
    }

    // Return user without password
    const { hashedPassword: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
