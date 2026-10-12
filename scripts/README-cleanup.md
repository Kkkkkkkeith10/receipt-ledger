# Database & R2 Cleanup Script

This script permanently deletes all testing data from your Cloudflare D1 database and R2 storage, giving you a fresh start.

## ⚠️ Warning

This script will **permanently delete**:
- ✕ All receipts from the database
- ✕ All uploaded files from R2 storage  
- ✕ All transaction history
- ✓ Chart of accounts is **preserved**

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

The script can work with or without R2 credentials:

#### Option A: Full Cleanup (Database + R2)

Create a `.env.local` file with your R2 credentials:

```bash
# Copy example file
cp .env.cleanup.example .env.local
```

Then edit `.env.local` and add:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=receipt-ledger
```

**Finding your credentials:**

1. **Account ID**: Cloudflare Dashboard → Account Home (in URL or sidebar)
2. **R2 API Tokens**: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
   - Permissions: Object Read & Write
   - Copy Access Key ID and Secret Access Key

#### Option B: Database Only

If you skip R2 credentials, the script will:
- ✓ Clean the database
- ⚠️ Skip R2 cleanup (manual deletion required)

### 3. Run the Cleanup

```bash
# Using npm script
pnpm cleanup:all

# Or directly with tsx
npx tsx scripts/cleanup-all-data.ts
```

## How It Works

1. **3-Second Warning**: Gives you time to cancel (Ctrl+C)
2. **Database Cleanup**:
   - Counts existing records
   - Deletes all receipts
   - Resets auto-increment counters
   - Preserves chart of accounts
3. **R2 Storage Cleanup** (if credentials provided):
   - Lists all files in bucket
   - Deletes files in batches of 1,000
   - Confirms deletion count

## Database Location

The script automatically detects your database:

- **Local development**: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/receipt-ledger.sqlite`
- **Remote**: Set `DATABASE_URL` in `.env.local`

To find your remote database URL:

```bash
npx wrangler d1 info receipt-ledger
```

## Safety Features

- ✓ 3-second countdown before execution
- ✓ Detailed progress logging with colors
- ✓ Batch deletion for large R2 buckets
- ✓ Graceful handling of missing credentials
- ✓ Error reporting and exit codes

## Output Example

```
╔════════════════════════════════════════════════════╗
║  CLEANUP SCRIPT - Remove All Testing Data         ║
╚════════════════════════════════════════════════════╝

⚠️  WARNING: This will permanently delete:
   • All receipts from the database
   • All uploaded files from R2 storage
   • All transaction history

⏳ Starting cleanup in 3 seconds...
   Press Ctrl+C to cancel!

📊 Connecting to D1 database...

Found 156 receipts and 24 accounts in database

🗑️  Deleting all receipts...
✓ Deleted 156 receipts
✓ Reset ID counters

☁️  Connecting to R2 storage...

📁 Listing all files in R2 bucket...

Found 312 files in R2 storage

🗑️  Deleting all files from R2...
✓ Deleted batch of 1000 files
✓ Successfully deleted 312 files from R2

╔════════════════════════════════════════════════════╗
║  ✓ CLEANUP COMPLETED SUCCESSFULLY                  ║
╚════════════════════════════════════════════════════╝

ℹ️  Your application now has a fresh start!
ℹ️  All testing data has been removed.
ℹ️  Chart of accounts is preserved.
```

## Troubleshooting

### Error: Cannot find database

**Solution**: Make sure wrangler dev has been run at least once to create the local database:

```bash
pnpm dev:cf
```

### Error: R2 credentials invalid

**Solution**: Verify your credentials in `.env.local`:
- Check Account ID matches your Cloudflare account
- Regenerate R2 API token if needed
- Ensure token has Read & Write permissions

### Error: Permission denied

**Solution**: Close any programs that might have the database open:
- Stop all dev servers
- Close Drizzle Studio
- Close database browsers

## Alternative: Manual Cleanup

### Delete Database Only

```bash
# Stop dev server first
rm .wrangler/state/v3/d1/miniflare-D1DatabaseObject/receipt-ledger.sqlite

# Restart to recreate empty database
pnpm dev:cf
```

### Delete R2 Files Only

Using Cloudflare Dashboard:
1. Go to R2 → Your Bucket
2. Select all files
3. Delete

Using wrangler CLI:
```bash
npx wrangler r2 object delete <bucket-name> --file <key>
```

## After Cleanup

Your application is now ready for fresh data:

1. ✓ Database is empty (except chart of accounts)
2. ✓ R2 storage is empty
3. ✓ Auto-increment counters reset
4. ✓ Ready for production data

You can now:
- Upload new receipts
- Test with clean data
- Deploy to production

## Restore Default Data

To restore the default chart of accounts (if deleted):

```bash
# Re-run migrations
pnpm db:migrate
```

To add sample receipts for testing:

```bash
pnpm seed:receipts
```
