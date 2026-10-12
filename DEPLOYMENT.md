# Cloudflare Deployment Guide

## Prerequisites

1. **Cloudflare Account** - Sign up at cloudflare.com
2. **Wrangler CLI** - Already installed (check with `wrangler --version`)
3. **Login to Cloudflare** - Run: `wrangler login`

## Step 1: Set Azure OpenAI Secrets

Your AI configuration needs to be in Cloudflare's secret storage (not in code):

```powershell
# Set your Azure Foundry endpoint
wrangler secret put AZURE_FOUNDRY_ENDPOINT
# When prompted, paste: https://YOUR-RESOURCE.openai.azure.com/

# Set your Azure Foundry API key  
wrangler secret put AZURE_FOUNDRY_KEY
# When prompted, paste your key from .dev.vars
```

## Step 2: Create Production Resources

### Create D1 Database (if not exists)
```powershell
# Your database already exists with ID: YOUR_D1_DATABASE_ID
# But if you need to recreate it:
wrangler d1 create accounting-db
```

### Create R2 Buckets
```powershell
# Create production receipt storage bucket
wrangler r2 bucket create accounting-receipts

# Your preview bucket already exists: accounting-receipts-preview
```

### Run Database Migrations
```powershell
# Apply schema to production database
wrangler d1 migrations apply accounting-db --remote
```

## Step 3: Build and Deploy

```powershell
# Build the production version
pnpm build

# Deploy to Cloudflare
wrangler deploy
```

## Step 4: Verify Deployment

After deployment, wrangler will give you a URL like:
```
https://receipt-ledger.your-subdomain.workers.dev
```

Open that URL to see your deployed app!

## Common Issues

### Build Errors (EBUSY)
If you see "resource busy or locked" errors:
1. Close ALL terminals running dev servers
2. Wait 5 seconds
3. Run `pnpm build` again

### Secrets Not Working
If AI recognition fails in production:
```powershell
# List current secrets
wrangler secret list

# Re-set secrets if needed
wrangler secret put AZURE_FOUNDRY_ENDPOINT
wrangler secret put AZURE_FOUNDRY_KEY
```

### Database Not Found
```powershell
# Check if migrations applied
wrangler d1 info accounting-db

# Re-apply migrations
wrangler d1 migrations apply accounting-db --remote
```

### R2 Bucket Not Found
```powershell
# List all buckets
wrangler r2 bucket list

# Create if missing
wrangler r2 bucket create accounting-receipts
```

## Production vs Development

- **Development**: Uses `.dev.vars` for secrets, local D1/R2 in `.wrangler/state`
- **Production**: Uses `wrangler secret put` for secrets, Cloudflare D1/R2 in cloud

## Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker: `receipt-ledger`  
3. Click "Settings" → "Triggers" → "Custom Domains"
4. Add your domain (e.g., `accounting.example.com`)

## Monitoring

- **Logs**: `wrangler tail` (live logs from production)
- **Analytics**: Cloudflare Dashboard → Workers & Pages → receipt-ledger
- **R2 Storage**: Dashboard → R2 → accounting-receipts

## Updating After Changes

```powershell
# After making code changes:
pnpm build
wrangler deploy
```

That's it! Your app is now running on Cloudflare's global network.
