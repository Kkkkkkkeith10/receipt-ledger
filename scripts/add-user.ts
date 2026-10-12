/**
 * Add a single user directly to the D1 database
 * 
 * Usage: 
 *   npx tsx scripts/add-user.ts          # Add to local database
 *   npx tsx scripts/add-user.ts --remote # Add to remote (production) database
 * 
 * This generates SQL and runs it via wrangler d1 execute
 */

import { execSync } from 'child_process';

// Check if --remote flag is passed
const isRemote = process.argv.includes('--remote');

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

async function main() {
    // Pass credentials via the environment, e.g.
    //   NEW_USER_EMAIL=you@example.com NEW_USER_PASSWORD=... npx tsx scripts/add-user.ts
    const email = process.env.NEW_USER_EMAIL || 'demo@example.com';
    const name = process.env.NEW_USER_NAME || 'Demo User';
    const password = process.env.NEW_USER_PASSWORD;
    if (!password) {
        console.error('Set NEW_USER_PASSWORD first (see .env.example).');
        process.exit(1);
    }

    const dbTarget = isRemote ? 'REMOTE' : 'LOCAL';
    console.log(`Creating user: ${email}`);
    console.log(`Target database: ${dbTarget}`);

    const hashedPassword = await hashPassword(password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Include username for backwards compatibility with old schema
    const sql = `INSERT OR REPLACE INTO users (id, username, email, name, hashed_password, created_at, updated_at) VALUES ('${id}', '${email}', '${email}', '${name}', '${hashedPassword}', '${now}', '${now}');`;

    console.log('\nExecuting SQL:');
    console.log(sql);
    console.log('');

    try {
        // Execute against D1 database (local or remote)
        const localFlag = isRemote ? '--remote' : '--local';
        execSync(`npx wrangler d1 execute DB ${localFlag} --command="${sql}"`, {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        console.log(`\n✓ User created successfully in ${dbTarget} database!`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${password}`);

        if (!isRemote) {
            console.log(`\nYou can now login at http://localhost:8787/login`);
        } else {
            console.log(`\nYou can now login at your production URL`);
        }
    } catch (error) {
        console.error('Failed to create user:', error);

        // Print manual SQL as fallback
        console.log('\n--- If the above failed, run this SQL manually: ---');
        console.log(sql);
    }
}

main().catch(console.error);
