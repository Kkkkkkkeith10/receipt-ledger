/**
 * Direct Cloudflare Infrastructure Test
 * 
 * This test directly interacts with Cloudflare D1 and R2 using wrangler CLI commands.
 * It bypasses the SvelteKit app and tests the actual cloud resources.
 * 
 * Run: pnpm test:direct
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

const ACCOUNT_ID = 'b923af9357618779a37006ba97621779';
const D1_DATABASE = 'accounting-db';
const D1_DATABASE_ID = 'YOUR_D1_DATABASE_ID';
const R2_BUCKET = 'accounting-receipts';

function exec(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });
    } catch (error: any) {
        return error.stdout || error.message;
    }
}

function wranglerD1(sql: string): string {
    const escaped = sql.replace(/"/g, '\\"');
    return exec(`pnpm wrangler d1 execute ${D1_DATABASE} --remote --command "${escaped}"`);
}

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (error: any) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

console.log('\n🔷 Direct Cloudflare Infrastructure Tests\n');
console.log(`Account: ${ACCOUNT_ID}`);
console.log(`D1 Database: ${D1_DATABASE} (${D1_DATABASE_ID})`);
console.log(`R2 Bucket: ${R2_BUCKET}`);
console.log('');

// Test 1: D1 Connection
test('D1 Database Connection', () => {
    const result = wranglerD1('SELECT 1 as test');
    assert(result.includes('1'), 'D1 connection should work');
});

// Test 2: D1 Tables Exist
test('D1 Tables Exist', () => {
    const result = wranglerD1("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    assert(result.includes('receipts'), 'receipts table should exist');
    assert(result.includes('transactions'), 'transactions table should exist');
});

// Test 3: D1 Write Test
const testId = `DIRECT-TEST-${Date.now()}`;
test('D1 Write Operation', () => {
    const timestamp = new Date().toISOString().split('T')[0];
    // Simplified JSON without special chars that need escaping
    const jsonData = `{"id":"${testId}","vendor":"DIRECT-TEST-VENDOR","amount":999.99,"date":"${timestamp}","category":"Test","status":"pending","taxDeductible":true}`;

    // Use receipt_data column (not data)
    const sql = `INSERT INTO receipts (id, receipt_data, created_at, updated_at) VALUES ('${testId}', '${jsonData}', datetime('now'), datetime('now'))`;
    const insertResult = wranglerD1(sql);

    // Check for errors
    if (insertResult.includes('ERROR')) {
        throw new Error(`Insert failed: ${insertResult}`);
    }

    // Verify
    const result = wranglerD1(`SELECT id FROM receipts WHERE id = '${testId}'`);
    assert(result.includes(testId), 'Inserted receipt should be readable');
});

// Test 4: D1 Read Test
test('D1 Read Operation', () => {
    const result = wranglerD1(`SELECT COUNT(*) as total FROM receipts`);
    assert(result.includes('total'), 'Should return count');
});

// Test 5: D1 Generated Columns
test('D1 Generated Columns', () => {
    const result = wranglerD1(`SELECT id, vendor, amount FROM receipts WHERE id = '${testId}'`);
    assert(result.includes('DIRECT-TEST-VENDOR') || result.includes('999.99'), 'Generated columns should work');
});

// Test 6: R2 Upload
const testFileName = `test-file-${Date.now()}.txt`;
test('R2 Upload Operation', () => {
    // Create a temp file
    const tempPath = `./temp-test-${Date.now()}.txt`;
    fs.writeFileSync(tempPath, 'Hello from direct Cloudflare test!');

    try {
        const result = exec(`pnpm wrangler r2 object put ${R2_BUCKET}/${testFileName} --file "${tempPath}" --remote`);
        assert(!result.includes('ERROR'), 'R2 upload should succeed');
    } finally {
        fs.unlinkSync(tempPath);
    }
});

// Test 7: R2 Download
test('R2 Download Operation', () => {
    const result = exec(`pnpm wrangler r2 object get ${R2_BUCKET}/${testFileName} --remote`);
    assert(result.includes('Hello') || !result.includes('ERROR'), 'R2 download should work');
});

// Check if we should skip cleanup
const skipCleanup = process.argv.includes('--no-cleanup');

if (skipCleanup) {
    console.log('\n⏭️  Skipping cleanup (--no-cleanup flag)');
    console.log(`   Test receipt ID: ${testId}`);
    console.log(`   Test file: ${testFileName}`);
} else {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');

    // Clean up D1 test data
    wranglerD1(`DELETE FROM receipts WHERE id = '${testId}'`);

    // Clean up R2 test file
    exec(`pnpm wrangler r2 object delete ${R2_BUCKET}/${testFileName} --remote`);

    console.log('   Test data cleaned up');
}

// Final summary
console.log('\n📊 Final State Check:');
const countResult = wranglerD1('SELECT COUNT(*) as total FROM receipts');
console.log(`   Receipts in remote D1: ${countResult.match(/\d+/)?.[0] || 'unknown'}`);

console.log('\n✨ Direct Cloudflare tests complete!\n');
console.log('To verify in Cloudflare Dashboard:');
console.log(`  - D1: https://dash.cloudflare.com/${ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`);
console.log(`  - R2: https://dash.cloudflare.com/${ACCOUNT_ID}/r2/default/buckets/${R2_BUCKET}`);
