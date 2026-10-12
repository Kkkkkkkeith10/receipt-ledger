# 📋 Setup Checklist

Use this checklist to track your setup progress:

## Prerequisites Setup
- [ ] **Node.js 18+** installed from https://nodejs.org/
- [ ] **pnpm** installed with `npm install -g pnpm` (recommended over npm)
- [ ] **Wrangler CLI** installed with `npm install -g wrangler`  
- [ ] **Cloudflare account** created at https://dash.cloudflare.com/sign-up
- [ ] **Azure OpenAI account** setup (optional, for OCR features)

## Infrastructure Configuration

### Cloudflare Setup
- [ ] Login to Cloudflare: `wrangler auth login`
- [ ] Create D1 database: `wrangler d1 create accounting-db`
- [ ] **Copy the database_id** from the output
- [ ] Create production R2 bucket: `wrangler r2 bucket create accounting-receipts`  
- [ ] Create preview R2 bucket: `wrangler r2 bucket create accounting-receipts-preview`
- [ ] Update `wrangler.toml` with your actual database_id

### Azure OpenAI Setup (Optional)
- [ ] Create Azure OpenAI resource in Azure Portal
- [ ] Deploy GPT-4 Vision model
- [ ] Copy endpoint URL (e.g., `https://your-resource.openai.azure.com/`)
- [ ] Copy API key from "Keys and Endpoint" section
- [ ] Note deployment name (usually `gpt-4-vision-preview`)

## Local Development Setup
- [ ] Clone/download the project repository
- [ ] Run `pnpm install` (or `npm install`)
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in your Azure OpenAI credentials in `.env`
- [ ] Generate database schema: `pnpm run db:generate`
- [ ] Apply database migrations: `pnpm run db:migrate`
- [ ] Test local development: `pnpm run dev`
- [ ] Verify app loads at `http://localhost:5173`

## Verification Tests
- [ ] **Homepage loads** - Dashboard displays properly
- [ ] **Navigation works** - All menu items accessible  
- [ ] **Receipt upload** - Can select files (even if processing fails without OCR)
- [ ] **Chart of Accounts** - Predefined accounts display
- [ ] **Reports page** - Interface loads without errors
- [ ] **Settings page** - Configuration options available

## Production Deployment (Optional)
- [ ] Build application: `pnpm run build`
- [ ] Deploy to Cloudflare: `wrangler pages deploy build`
- [ ] Set production secrets: `wrangler secret put AZURE_OPENAI_KEY`
- [ ] Test live deployment URL
- [ ] Verify database connection works in production
- [ ] Test file upload functionality with R2

## Configuration Files Summary

### Key Files to Configure:
1. **`wrangler.toml`** - Update `database_id` with actual ID from Cloudflare
2. **`.env`** - Add Azure OpenAI credentials (copy from `.env.example`)
3. **Production secrets** - Use `wrangler secret put` for sensitive values

### Example Values Needed:
```
wrangler.toml:
- database_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

.env:
- AZURE_OPENAI_ENDPOINT: "https://your-resource.openai.azure.com/"
- AZURE_OPENAI_KEY: "<your key>"
- AZURE_OPENAI_DEPLOYMENT: "gpt-4-vision-preview"
```

---

**🎯 Pro Tips:**
- Use `wrangler d1 info accounting-db` to verify database connection
- Use `pnpm run db:studio` to inspect your database  
- Check browser console for any JavaScript errors during testing
- Use `wrangler tail` to view live logs during development

**✅ Setup Complete?** 
Once all items are checked, your accounting system is ready for professional use!