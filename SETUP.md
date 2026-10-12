# 🚀 Receipt Ledger Setup Guide

## Overview
This guide will help you set up the complete Year-End Audit-Ready Accounting System built with SvelteKit + TypeScript + Cloudflare infrastructure.

## Prerequisites

### Required Tools
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **pnpm** (recommended) or npm - Install with: `npm install -g pnpm`
- **Wrangler CLI** (Cloudflare's CLI tool) - Install with: `npm install -g wrangler`
- **Git** - For version control

### Required Accounts
1. **Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)
2. **Azure OpenAI Account** (for OCR features) - [Get access here](https://azure.microsoft.com/products/ai-services/openai-service)

---

## 🏗️ Infrastructure Setup

### 1. Cloudflare Configuration

#### Step 1: Create Cloudflare D1 Database
```bash
# Login to Cloudflare
wrangler auth login

# Create the database
wrangler d1 create accounting-db

# Note: Copy the database_id from the output and update wrangler.toml
```

#### Step 2: Create Cloudflare R2 Storage Buckets
```bash
# Create production bucket for receipt storage
wrangler r2 bucket create accounting-receipts

# Create preview bucket for development
wrangler r2 bucket create accounting-receipts-preview
```

#### Step 3: Update wrangler.toml Configuration
Update your `wrangler.toml` file with the actual database ID from Step 1:

```toml
name = "receipt-ledger"
main = "build/index.js"
compatibility_date = "2024-08-15"

[[d1_databases]]
binding = "DB"
database_name = "accounting-db"
database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"  # ← Replace this

[[r2_buckets]]
binding = "RECEIPTS"
bucket_name = "accounting-receipts"
preview_bucket_name = "accounting-receipts-preview"

[vars]
AZURE_OPENAI_ENDPOINT = "YOUR_AZURE_OPENAI_ENDPOINT"
AZURE_OPENAI_KEY = "YOUR_AZURE_OPENAI_KEY"
AZURE_OPENAI_DEPLOYMENT = "gpt-4-vision-preview"
```

### 2. Azure OpenAI Setup (Optional - for OCR features)

1. **Create Azure OpenAI Resource**:
   - Go to [Azure Portal](https://portal.azure.com/)
   - Create a new "Azure OpenAI" resource
   - Deploy a GPT-4 Vision model

2. **Get Credentials**:
   - Copy your endpoint URL (e.g., `https://your-resource.openai.azure.com/`)
   - Copy your API key from the "Keys and Endpoint" section
   - Note your deployment name (usually `gpt-4-vision-preview`)

---

## 💻 Local Development Setup

### Step 1: Install Dependencies
```bash
# Navigate to project directory
cd receipt-ledger

# Install dependencies
pnpm install
# or
npm install
```

### Step 2: Database Setup
```bash
# Generate database migrations
pnpm run db:generate

# Apply migrations to your Cloudflare D1 database
pnpm run db:migrate

# Optional: Open database studio for inspection
pnpm run db:studio
```

### Step 3: Environment Configuration

Create a `.env` file in your project root (this file is already gitignored):

```bash
# .env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4-vision-preview

# Optional: Override Cloudflare settings for local development
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

### Step 4: Start Development Server
```bash
# Start local development server
pnpm run dev
# or
npm run dev

# The app will be available at http://localhost:5173
```

---

## 🚀 Production Deployment

### Step 1: Build for Production
```bash
# Build the application
pnpm run build
# or
npm run build
```

### Step 2: Deploy to Cloudflare Pages
```bash
# Deploy to Cloudflare
wrangler pages deploy build

# Or set up automatic deployment from GitHub
wrangler pages project create receipt-ledger
```

### Step 3: Configure Production Environment Variables
```bash
# Set production environment variables
wrangler secret put AZURE_OPENAI_KEY
wrangler secret put AZURE_OPENAI_ENDPOINT
```

---

## 🔧 Configuration Details

### Database Schema
The system uses the following main tables:
- `receipts` - Stores receipt data with JSON flexibility
- `transactions` - Double-entry bookkeeping records
- `app_settings` - System configuration
- `users` & `sessions` - Authentication system

### File Storage Structure
```
R2 Bucket: accounting-receipts/
├── receipts/
│   ├── 2024/
│   │   ├── 01/
│   │   └── 02/
│   └── processed/
└── exports/
    ├── reports/
    └── backups/
```

### Key Features Ready to Use
- ✅ Receipt upload and processing
- ✅ Expense categorization and tracking
- ✅ Chart of accounts management
- ✅ Financial reporting and analytics
- ✅ Tax compliance features
- ✅ Audit trail maintenance

---

## 🔍 Verification Steps

### Test Local Setup
1. **Homepage**: Visit `http://localhost:5173` - should show the dashboard
2. **Receipt Upload**: Try uploading a receipt image
3. **Database**: Check that data persists between sessions
4. **Navigation**: Test all menu items work correctly

### Test Production Deployment
1. **Live Site**: Verify your deployed URL works
2. **Database Connection**: Confirm Cloudflare D1 is connected
3. **File Uploads**: Test receipt uploads work with R2 storage
4. **Performance**: Check page load speeds and responsiveness

---

## 📚 Additional Resources

- **SvelteKit Docs**: https://kit.svelte.dev/
- **Cloudflare D1 Docs**: https://developers.cloudflare.com/d1/
- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2/
- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Azure OpenAI Docs**: https://learn.microsoft.com/azure/ai-services/openai/

---

## 🆘 Troubleshooting

### Common Issues

**"Database not found" error**:
- Ensure you've run `pnpm run db:migrate`
- Check your `database_id` in `wrangler.toml` is correct

**"Module not found" errors**:
- Run `pnpm install` to ensure all dependencies are installed
- Clear `.svelte-kit` folder and restart dev server

**R2 bucket access denied**:
- Verify bucket names in `wrangler.toml` match created buckets
- Check Cloudflare account permissions

**Azure OpenAI errors**:
- Verify your endpoint URL and API key are correct
- Ensure you have an active GPT-4 Vision deployment

### Getting Help
1. Check the browser console for detailed error messages
2. Review Cloudflare dashboard for resource status
3. Use `wrangler tail` to see live logs during development

---

**🎉 Congratulations!** Your enterprise-grade accounting system is now ready for use. The system is built for scalability and ready for year-end audit requirements.