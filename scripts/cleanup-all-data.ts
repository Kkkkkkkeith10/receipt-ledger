/**
 * Cleanup script to remove all testing data from D1 database and R2 storage
 * WARNING: This will delete ALL receipts, transactions, and uploaded files!
 * 
 * Usage: npx tsx scripts/cleanup-all-data.ts
 */

import { createClient } from '@libsql/client';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

function log(color: keyof typeof colors, message: string) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanupDatabase() {
    log('blue', '\n📊 Connecting to D1 database...');

    // Get D1 database URL from wrangler
    const dbUrl = process.env.DATABASE_URL || 'file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/receipt-ledger.sqlite';

    const db = createClient({
        url: dbUrl,
    });

    try {
        // Check if tables exist
        const tablesResult = await db.execute(
            `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('receipts', 'accounts')`
        );

        if (tablesResult.rows.length === 0) {
            log('yellow', '\n⚠️  Database tables not found');
            log('blue', 'ℹ️  The database hasn\'t been initialized yet.');
            log('blue', 'ℹ️  Run migrations first: pnpm db:migrate');
            log('green', '✓ No database cleanup needed');
            return;
        }

        // Check which tables exist
        const existingTables = tablesResult.rows.map(row => row.name as string);
        const hasReceipts = existingTables.includes('receipts');
        const hasAccounts = existingTables.includes('accounts');

        let receipts = 0;
        let accounts = 0;

        // Count existing records only if tables exist
        if (hasReceipts) {
            const receiptCount = await db.execute('SELECT COUNT(*) as count FROM receipts');
            receipts = receiptCount.rows[0].count as number;
        }

        if (hasAccounts) {
            const accountCount = await db.execute('SELECT COUNT(*) as count FROM accounts');
            accounts = accountCount.rows[0].count as number;
        }

        log('yellow', `\nFound ${receipts} receipts and ${accounts} accounts in database`);

        if (receipts === 0 && accounts === 0) {
            log('green', '✓ Database is already empty!');
            return;
        }

        // Delete all receipts
        if (hasReceipts && receipts > 0) {
            log('blue', '\n🗑️  Deleting all receipts...');
            await db.execute('DELETE FROM receipts');
            log('green', `✓ Deleted ${receipts} receipts`);

            // Reset auto-increment counters (only if table exists)
            const seqCheck = await db.execute(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`
            );
            if (seqCheck.rows.length > 0) {
                await db.execute('DELETE FROM sqlite_sequence WHERE name = "receipts"');
                log('green', '✓ Reset receipt ID counter');
            }
        }

        // Optional: Reset accounts to defaults (uncomment if needed)
        // if (hasAccounts && accounts > 0) {
        //   log('blue', '\n🗑️  Deleting all accounts...');
        //   await db.execute('DELETE FROM accounts');
        //   log('green', `✓ Deleted ${accounts} accounts`);
        //   await db.execute('DELETE FROM sqlite_sequence WHERE name = "accounts"');
        //   log('yellow', 'ℹ️  Run seed script to restore default chart of accounts');
        // }

    } catch (error) {
        log('red', `✗ Database cleanup failed: ${error}`);
        throw error;
    } finally {
        db.close();
    }
}

async function cleanupR2Storage() {
    log('blue', '\n☁️  Connecting to R2 storage...');

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'receipt-ledger';

    if (!accountId || !accessKeyId || !secretAccessKey) {
        log('yellow', '⚠️  R2 credentials not found in environment variables');
        log('yellow', 'ℹ️  Skipping R2 cleanup. Set these environment variables:');
        log('yellow', '   - CLOUDFLARE_ACCOUNT_ID');
        log('yellow', '   - R2_ACCESS_KEY_ID');
        log('yellow', '   - R2_SECRET_ACCESS_KEY');
        return;
    }

    const r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    try {
        // List all objects in the bucket
        log('blue', '\n📁 Listing all files in R2 bucket...');

        let allObjects: { Key: string }[] = [];
        let continuationToken: string | undefined;

        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
            });

            const response = await r2Client.send(listCommand);

            if (response.Contents) {
                allObjects.push(...response.Contents.map(obj => ({ Key: obj.Key! })));
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        log('yellow', `\nFound ${allObjects.length} files in R2 storage`);

        if (allObjects.length === 0) {
            log('green', '✓ R2 storage is already empty!');
            return;
        }

        // Delete objects in batches of 1000 (R2 limit)
        log('blue', '\n🗑️  Deleting all files from R2...');

        for (let i = 0; i < allObjects.length; i += 1000) {
            const batch = allObjects.slice(i, i + 1000);

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: batch,
                    Quiet: false,
                },
            });

            const result = await r2Client.send(deleteCommand);

            const deleted = result.Deleted?.length || 0;
            log('green', `✓ Deleted batch of ${deleted} files`);
        }

        log('green', `✓ Successfully deleted ${allObjects.length} files from R2`);

    } catch (error) {
        log('red', `✗ R2 cleanup failed: ${error}`);
        throw error;
    }
}

async function main() {
    log('magenta', '\n╔════════════════════════════════════════════════════╗');
    log('magenta', '║  CLEANUP SCRIPT - Remove All Testing Data         ║');
    log('magenta', '╚════════════════════════════════════════════════════╝');

    log('red', '\n⚠️  WARNING: This will permanently delete:');
    log('red', '   • All receipts from the database');
    log('red', '   • All uploaded files from R2 storage');
    log('red', '   • All transaction history');

    // Give user 3 seconds to cancel
    log('yellow', '\n⏳ Starting cleanup in 3 seconds...');
    log('yellow', '   Press Ctrl+C to cancel!');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // Step 1: Clean database
        await cleanupDatabase();

        // Step 2: Clean R2 storage
        await cleanupR2Storage();

        log('green', '\n╔════════════════════════════════════════════════════╗');
        log('green', '║  ✓ CLEANUP COMPLETED SUCCESSFULLY                  ║');
        log('green', '╚════════════════════════════════════════════════════╝');

        log('blue', '\nℹ️  Your application now has a fresh start!');
        log('blue', 'ℹ️  All testing data has been removed.');
        log('blue', 'ℹ️  Chart of accounts is preserved.');

    } catch (error) {
        log('red', '\n✗ Cleanup failed with errors');
        log('red', `Error: ${error}`);
        process.exit(1);
    }
}

// Run the cleanup
main();
