/**
 * Password hashing utilities using Web Crypto API
 * Compatible with Cloudflare Workers (no Node.js bcrypt)
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Hash a plain text password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: ITERATIONS,
            hash: 'SHA-256'
        },
        passwordKey,
        KEY_LENGTH * 8
    );

    // Combine salt and hash, encode as base64
    const combined = new Uint8Array(SALT_LENGTH + KEY_LENGTH);
    combined.set(salt);
    combined.set(new Uint8Array(hash), SALT_LENGTH);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a plain text password against a hashed password
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
        const combined = Uint8Array.from(atob(hashedPassword), (c) => c.charCodeAt(0));
        const salt = combined.slice(0, SALT_LENGTH);
        const storedHash = combined.slice(SALT_LENGTH);

        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const hash = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: ITERATIONS,
                hash: 'SHA-256'
            },
            passwordKey,
            KEY_LENGTH * 8
        );

        const hashArray = new Uint8Array(hash);

        // Constant-time comparison
        if (hashArray.length !== storedHash.length) return false;
        let diff = 0;
        for (let i = 0; i < hashArray.length; i++) {
            diff |= hashArray[i] ^ storedHash[i];
        }
        return diff === 0;
    } catch {
        return false;
    }
}
