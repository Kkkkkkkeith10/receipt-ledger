/**
 * Seed script to create test users with hashed passwords
 * Run this script after applying the auth migration
 * 
 * Usage: npx tsx scripts/seed-users.ts
 */

// Password hashing using Web Crypto API (same as the app)
const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();

    // Generate salt
    const salt = new Uint8Array(SALT_LENGTH);
    crypto.getRandomValues(salt);

    // Import password as key
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive hash
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

interface User {
    id: string;
    email: string;
    name: string;
    password: string;
}

// Passwords come from SEED_USER_PASSWORD (see .env.example); nothing is hard-coded.
const seedPassword = process.env.SEED_USER_PASSWORD;
if (!seedPassword) {
    console.error('Set SEED_USER_PASSWORD first (see .env.example).');
    process.exit(1);
}

const testUsers: User[] = [
    {
        id: crypto.randomUUID(),
        email: 'demo@example.com',
        name: 'Demo User',
        password: seedPassword
    },
    {
        id: crypto.randomUUID(),
        email: 'admin@example.com',
        name: 'Admin User',
        password: seedPassword
    },
    {
        id: crypto.randomUUID(),
        email: 'test@example.com',
        name: 'Test User',
        password: seedPassword
    }
];

async function main() {
    console.log('Generating SQL INSERT statements for test users...\n');
    console.log('-- Seed users for receipt-ledger');
    console.log('-- Run this SQL in your D1 database\n');

    for (const user of testUsers) {
        const hashedPassword = await hashPassword(user.password);
        const now = new Date().toISOString();

        console.log(`-- User: ${user.email} (password: ${user.password})`);
        console.log(`INSERT INTO users (id, email, name, hashed_password, created_at, updated_at) VALUES (`);
        console.log(`  '${user.id}',`);
        console.log(`  '${user.email}',`);
        console.log(`  '${user.name}',`);
        console.log(`  '${hashedPassword}',`);
        console.log(`  '${now}',`);
        console.log(`  '${now}'`);
        console.log(`);\n`);
    }

    console.log('-- Done!');
}

main().catch(console.error);
