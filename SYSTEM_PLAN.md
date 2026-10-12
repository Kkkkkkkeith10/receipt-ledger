# Receipt Ledger - Complete Plan

## Overview

A lightweight expense tracking and reporting system built on Cloudflare infrastructure (D1 + R2 + Workers). Designed for small businesses to upload receipts, categorize expenses, and generate yearly tax reports.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | SvelteKit 2.x | UI Framework |
| Styling | TailwindCSS | Styling |
| Database | Cloudflare D1 (SQLite) | Data persistence |
| ORM | Drizzle ORM | Type-safe database queries |
| File Storage | Cloudflare R2 | Receipt image storage |
| Hosting | Cloudflare Workers | Serverless deployment |
| Validation | Zod | Schema validation |
| Charts | Chart.js | Report visualizations |

---

## Data Structures

### 1. Receipts (Core Entity)

```typescript
// src/lib/typings/receipt.ts
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

export const ReceiptStatus = z.enum(['pending', 'approved', 'rejected']);
export type ReceiptStatus = z.infer<typeof ReceiptStatus>;

export const PaymentMethod = z.enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const Receipt = z.object({
  id: z.string().default(() => `RCP-${Date.now()}`),
  
  // Core fields
  vendor: z.string().min(1, 'Vendor is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('AUD'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  
  // Categorization
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  
  // Tax & Business
  taxDeductible: z.boolean().default(true),
  gstIncluded: z.boolean().default(true),
  gstAmount: z.number().default(0),
  businessPurpose: z.string().optional(),
  projectCode: z.string().optional(),
  
  // Payment
  paymentMethod: PaymentMethod.default('credit_card'),
  paymentReference: z.string().optional(),
  
  // Receipt Image
  receiptImageUrl: z.string().optional(),
  receiptImageKey: z.string().optional(), // R2 object key
  
  // Status & Workflow
  status: ReceiptStatus.default('pending'),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  
  // Fiscal tracking
  fiscalYear: z.number(),
  fiscalQuarter: z.number().min(1).max(4),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  
  // Audit
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type Receipt = z.infer<typeof Receipt>;
```

### 2. Expense Categories

```typescript
// src/lib/typings/category.ts
import { z } from 'zod';

export const ExpenseCategory = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  taxDeductible: z.boolean().default(true),
  description: z.string().optional(),
  subcategories: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).default([]),
  sortOrder: z.number().default(0),
  active: z.boolean().default(true),
});

export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

// Default categories
export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'office',
    name: 'Office Supplies',
    icon: '🖊️',
    color: '#3B82F6',
    taxDeductible: true,
    subcategories: [
      { id: 'stationery', name: 'Stationery' },
      { id: 'furniture', name: 'Furniture' },
      { id: 'supplies', name: 'General Supplies' },
    ],
    sortOrder: 1,
    active: true,
  },
  {
    id: 'travel',
    name: 'Travel & Transport',
    icon: '✈️',
    color: '#10B981',
    taxDeductible: true,
    subcategories: [
      { id: 'flights', name: 'Flights' },
      { id: 'accommodation', name: 'Accommodation' },
      { id: 'car', name: 'Car/Taxi/Uber' },
      { id: 'parking', name: 'Parking' },
      { id: 'public_transport', name: 'Public Transport' },
    ],
    sortOrder: 2,
    active: true,
  },
  {
    id: 'meals',
    name: 'Meals & Entertainment',
    icon: '🍽️',
    color: '#F59E0B',
    taxDeductible: true,
    description: 'Business meals are 50% deductible',
    subcategories: [
      { id: 'client_meals', name: 'Client Meals' },
      { id: 'team_meals', name: 'Team Meals' },
      { id: 'entertainment', name: 'Entertainment' },
    ],
    sortOrder: 3,
    active: true,
  },
  {
    id: 'software',
    name: 'Software & Subscriptions',
    icon: '💻',
    color: '#8B5CF6',
    taxDeductible: true,
    subcategories: [
      { id: 'saas', name: 'SaaS Subscriptions' },
      { id: 'licenses', name: 'Software Licenses' },
      { id: 'cloud', name: 'Cloud Services' },
      { id: 'domains', name: 'Domains & Hosting' },
    ],
    sortOrder: 4,
    active: true,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: '💡',
    color: '#EC4899',
    taxDeductible: true,
    subcategories: [
      { id: 'electricity', name: 'Electricity' },
      { id: 'internet', name: 'Internet' },
      { id: 'phone', name: 'Phone/Mobile' },
      { id: 'water', name: 'Water' },
    ],
    sortOrder: 5,
    active: true,
  },
  {
    id: 'professional',
    name: 'Professional Services',
    icon: '👔',
    color: '#6366F1',
    taxDeductible: true,
    subcategories: [
      { id: 'accounting', name: 'Accounting' },
      { id: 'legal', name: 'Legal' },
      { id: 'consulting', name: 'Consulting' },
      { id: 'contractors', name: 'Contractors' },
    ],
    sortOrder: 6,
    active: true,
  },
  {
    id: 'marketing',
    name: 'Marketing & Advertising',
    icon: '📢',
    color: '#EF4444',
    taxDeductible: true,
    subcategories: [
      { id: 'ads', name: 'Online Ads' },
      { id: 'print', name: 'Print Materials' },
      { id: 'events', name: 'Events & Sponsorship' },
    ],
    sortOrder: 7,
    active: true,
  },
  {
    id: 'equipment',
    name: 'Equipment & Assets',
    icon: '🔧',
    color: '#14B8A6',
    taxDeductible: true,
    description: 'May be depreciated over time',
    subcategories: [
      { id: 'computers', name: 'Computers' },
      { id: 'electronics', name: 'Electronics' },
      { id: 'machinery', name: 'Machinery' },
    ],
    sortOrder: 8,
    active: true,
  },
  {
    id: 'insurance',
    name: 'Insurance',
    icon: '🛡️',
    color: '#0EA5E9',
    taxDeductible: true,
    subcategories: [
      { id: 'business', name: 'Business Insurance' },
      { id: 'professional', name: 'Professional Indemnity' },
      { id: 'vehicle', name: 'Vehicle Insurance' },
    ],
    sortOrder: 9,
    active: true,
  },
  {
    id: 'rent',
    name: 'Rent & Premises',
    icon: '🏢',
    color: '#84CC16',
    taxDeductible: true,
    subcategories: [
      { id: 'office_rent', name: 'Office Rent' },
      { id: 'coworking', name: 'Coworking Space' },
      { id: 'storage', name: 'Storage' },
    ],
    sortOrder: 10,
    active: true,
  },
  {
    id: 'other',
    name: 'Other Expenses',
    icon: '📦',
    color: '#6B7280',
    taxDeductible: true,
    subcategories: [],
    sortOrder: 99,
    active: true,
  },
];
```

### 3. Expense Reports

```typescript
// src/lib/typings/report.ts
import { z } from 'zod';

export const ExpenseReport = z.object({
  id: z.string().default(() => `RPT-${Date.now()}`),
  
  // Report Period
  fiscalYear: z.number(),
  periodType: z.enum(['yearly', 'quarterly', 'monthly', 'custom']),
  periodStart: z.string(),
  periodEnd: z.string(),
  
  // Summary
  totalExpenses: z.number(),
  totalTaxDeductible: z.number(),
  totalGst: z.number(),
  receiptCount: z.number(),
  
  // Breakdown by Category
  categoryBreakdown: z.array(z.object({
    categoryId: z.string(),
    categoryName: z.string(),
    total: z.number(),
    count: z.number(),
    percentage: z.number(),
  })),
  
  // Monthly Breakdown
  monthlyBreakdown: z.array(z.object({
    month: z.string(), // YYYY-MM
    total: z.number(),
    count: z.number(),
  })),
  
  // Status Breakdown
  statusBreakdown: z.object({
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
  
  // Metadata
  generatedAt: z.string().default(() => new Date().toISOString()),
  generatedBy: z.string().optional(),
});

export type ExpenseReport = z.infer<typeof ExpenseReport>;
```

### 4. App Settings

```typescript
// src/lib/typings/settings.ts
import { z } from 'zod';

export const AppSettings = z.object({
  // Business Info
  businessName: z.string().default('My Business'),
  businessABN: z.string().optional(),
  businessAddress: z.string().optional(),
  
  // Fiscal Year Settings
  fiscalYearStart: z.number().min(1).max(12).default(7), // July for Australia
  currentFiscalYear: z.number(),
  
  // Currency
  defaultCurrency: z.string().default('AUD'),
  
  // GST Settings (Australia)
  gstRate: z.number().default(10),
  gstRegistered: z.boolean().default(true),
  
  // Categories
  categories: z.array(z.any()).default([]),
  
  // AI Settings (for future)
  aiEnabled: z.boolean().default(false),
  aiProvider: z.string().optional(),
  aiApiKey: z.string().optional(),
});

export type AppSettings = z.infer<typeof AppSettings>;
```

---

## Database Schema (Drizzle)

```typescript
// src/lib/server/db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// Receipts table with JSON storage pattern
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  receiptData: text('receipt_data').notNull(), // JSON blob
  
  // Generated columns for indexing/querying
  vendor: text('vendor').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.vendor')`
  ),
  amount: real('amount').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.amount')`
  ),
  date: text('date').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.date')`
  ),
  category: text('category').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.category')`
  ),
  fiscalYear: integer('fiscal_year').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.fiscalYear')`
  ),
  status: text('status').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.status')`
  ),
  taxDeductible: integer('tax_deductible').generatedAlwaysAs(
    sql`json_extract(receipt_data, '$.taxDeductible')`
  ),
  
  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Categories table (customizable)
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  categoryData: text('category_data').notNull(), // JSON blob
  sortOrder: integer('sort_order').default(0),
  active: integer('active').default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// App settings table
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Expense reports (cached/generated)
export const expenseReports = sqliteTable('expense_reports', {
  id: text('id').primaryKey(),
  reportData: text('report_data').notNull(), // JSON blob
  fiscalYear: integer('fiscal_year').notNull(),
  periodType: text('period_type').notNull(),
  generatedAt: text('generated_at').default(sql`CURRENT_TIMESTAMP`),
});
```

---

## Application Routes

### Public Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `+page.svelte` | Dashboard with summary |
| `/login` | `login/+page.svelte` | Login page (future) |

### Receipt Management

| Route | File | Description |
|-------|------|-------------|
| `/receipts` | `receipts/+page.svelte` | List all receipts |
| `/receipts/new` | `receipts/new/+page.svelte` | Upload new receipt |
| `/receipts/[id]` | `receipts/[id]/+page.svelte` | View receipt detail |
| `/receipts/[id]/edit` | `receipts/[id]/edit/+page.svelte` | Edit receipt |

### Reports

| Route | File | Description |
|-------|------|-------------|
| `/reports` | `reports/+page.svelte` | Report selection |
| `/reports/[year]` | `reports/[year]/+page.svelte` | Yearly report |
| `/reports/[year]/[quarter]` | `reports/[year]/[quarter]/+page.svelte` | Quarterly report |
| `/reports/export` | `reports/export/+page.svelte` | Export reports |

### Settings

| Route | File | Description |
|-------|------|-------------|
| `/settings` | `settings/+page.svelte` | App settings |
| `/settings/categories` | `settings/categories/+page.svelte` | Manage categories |
| `/settings/business` | `settings/business/+page.svelte` | Business info |

---

## API Endpoints

### Receipts API

```typescript
// GET /api/receipts
// Query params: fiscalYear, category, status, startDate, endDate, page, limit
Response: { receipts: Receipt[], total: number, page: number, pages: number }

// POST /api/receipts
Request: Receipt (without id)
Response: { receipt: Receipt }

// GET /api/receipts/[id]
Response: { receipt: Receipt }

// PUT /api/receipts/[id]
Request: Partial<Receipt>
Response: { receipt: Receipt }

// DELETE /api/receipts/[id]
Response: { success: true }

// POST /api/receipts/[id]/approve
Response: { receipt: Receipt }

// POST /api/receipts/[id]/reject
Request: { reason: string }
Response: { receipt: Receipt }
```

### Storage API

```typescript
// POST /api/storage/upload
Request: FormData { file: File, folder?: string }
Response: { key: string, url: string }

// GET /api/storage/file/[...key]
Response: File stream

// DELETE /api/storage/file/[...key]
Response: { success: true }
```

### Reports API

```typescript
// GET /api/reports/[year]
Response: { report: ExpenseReport }

// GET /api/reports/[year]/[quarter]
Response: { report: ExpenseReport }

// GET /api/reports/[year]/export?format=csv|pdf
Response: File download

// POST /api/reports/[year]/generate
Response: { report: ExpenseReport }
```

### Categories API

```typescript
// GET /api/categories
Response: { categories: ExpenseCategory[] }

// POST /api/categories
Request: ExpenseCategory
Response: { category: ExpenseCategory }

// PUT /api/categories/[id]
Request: Partial<ExpenseCategory>
Response: { category: ExpenseCategory }

// DELETE /api/categories/[id]
Response: { success: true }
```

### Settings API

```typescript
// GET /api/settings
Response: { settings: AppSettings }

// PUT /api/settings
Request: Partial<AppSettings>
Response: { settings: AppSettings }
```

---

## UI Components

### Core Components

```
src/lib/components/
├── layout/
│   ├── Header.svelte           # Top navigation
│   ├── Sidebar.svelte          # Side navigation
│   └── PageLayout.svelte       # Page wrapper
├── receipts/
│   ├── ReceiptCard.svelte      # Receipt preview card
│   ├── ReceiptForm.svelte      # Create/edit form
│   ├── ReceiptList.svelte      # List with filters
│   ├── ReceiptDetail.svelte    # Full receipt view
│   ├── ReceiptUpload.svelte    # Image upload
│   └── ReceiptFilters.svelte   # Filter controls
├── reports/
│   ├── ReportSummary.svelte    # Summary stats
│   ├── CategoryChart.svelte    # Pie chart
│   ├── MonthlyChart.svelte     # Bar chart
│   ├── ReportTable.svelte      # Detailed table
│   └── ExportButton.svelte     # Export controls
├── common/
│   ├── Button.svelte           # Standard button
│   ├── Input.svelte            # Form input
│   ├── Select.svelte           # Dropdown
│   ├── DatePicker.svelte       # Date selection
│   ├── FileUpload.svelte       # File drop zone
│   ├── Modal.svelte            # Modal dialog
│   ├── Toast.svelte            # Notifications
│   ├── Spinner.svelte          # Loading state
│   └── EmptyState.svelte       # No data message
└── dashboard/
    ├── DashboardCard.svelte    # Stat card
    ├── RecentReceipts.svelte   # Recent list
    └── QuickActions.svelte     # Action buttons
```

---

## User Flows

### 1. Upload Receipt Flow

```
[Dashboard] 
    → Click "Upload Receipt"
    → [Receipt Upload Page]
        → Drag/drop or select image
        → (Future: AI extracts data)
        → Fill in receipt details:
            - Vendor name
            - Amount (auto-calculate GST)
            - Date
            - Category (dropdown)
            - Payment method
            - Business purpose
        → Click "Save Receipt"
    → [Receipt saved, redirect to detail page]
    → Option to upload another
```

### 2. View Reports Flow

```
[Dashboard]
    → Click "Reports" in sidebar
    → [Report Selection Page]
        → Select fiscal year
        → Select period (Yearly/Quarterly)
    → [Report Page]
        → View summary stats
        → View category breakdown (pie chart)
        → View monthly trend (bar chart)
        → Filter by category
        → Export to CSV/PDF
```

### 3. Manage Receipts Flow

```
[Dashboard]
    → Click "Receipts" in sidebar
    → [Receipt List Page]
        → Filter by: Year, Category, Status, Date range
        → Search by vendor name
        → Sort by date/amount
        → Click receipt to view detail
    → [Receipt Detail Page]
        → View full details
        → View receipt image
        → Edit details
        → Change status (approve/reject)
        → Delete receipt
```

---

## Fiscal Year Handling

```typescript
// src/lib/utils/fiscal.ts

// Australian fiscal year: July 1 - June 30
export function getFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  // If July or later, fiscal year is next calendar year
  // FY2026 = July 2025 - June 2026
  return month >= 6 ? year + 1 : year;
}

export function getFiscalQuarter(date: Date = new Date()): number {
  const month = date.getMonth();
  // Q1: Jul-Sep (6,7,8), Q2: Oct-Dec (9,10,11), Q3: Jan-Mar (0,1,2), Q4: Apr-Jun (3,4,5)
  if (month >= 6 && month <= 8) return 1;
  if (month >= 9 && month <= 11) return 2;
  if (month >= 0 && month <= 2) return 3;
  return 4;
}

export function getFiscalYearDateRange(fy: number): { start: Date, end: Date } {
  return {
    start: new Date(fy - 1, 6, 1),  // July 1 of previous year
    end: new Date(fy, 5, 30),       // June 30 of FY year
  };
}

export function formatFiscalYear(fy: number): string {
  return `FY${fy} (Jul ${fy-1} - Jun ${fy})`;
}
```

---

## GST Calculations

```typescript
// src/lib/utils/gst.ts

const GST_RATE = 0.10; // 10% in Australia

export function calculateGstFromTotal(totalIncGst: number): {
  gstAmount: number;
  netAmount: number;
} {
  const gstAmount = totalIncGst - (totalIncGst / (1 + GST_RATE));
  const netAmount = totalIncGst - gstAmount;
  return {
    gstAmount: Math.round(gstAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
  };
}

export function calculateGstFromNet(netAmount: number): {
  gstAmount: number;
  totalIncGst: number;
} {
  const gstAmount = netAmount * GST_RATE;
  const totalIncGst = netAmount + gstAmount;
  return {
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalIncGst: Math.round(totalIncGst * 100) / 100,
  };
}
```

---

## Implementation Phases

### Phase 1: Core Receipt Management ✅ (Partial)
- [x] Database schema with D1
- [x] Receipt CRUD API
- [x] R2 image upload
- [ ] Improved receipt form UI
- [ ] Receipt detail page
- [ ] Receipt edit page
- [ ] Better receipt list with filters

### Phase 2: Yearly Reports 🎯
- [ ] Report data aggregation API
- [ ] Yearly report page
- [ ] Category breakdown chart
- [ ] Monthly trend chart
- [ ] Report summary stats
- [ ] CSV export

### Phase 3: Categories & Settings
- [ ] Category management page
- [ ] Custom categories CRUD
- [ ] Business settings page
- [ ] Fiscal year configuration

### Phase 4: Enhanced Features
- [ ] Quarterly reports
- [ ] Receipt approval workflow
- [ ] Bulk receipt upload
- [ ] Receipt search
- [ ] Dashboard improvements

### Phase 5: AI Integration (Future)
- [ ] Receipt OCR with OpenAI Vision
- [ ] Auto-categorization
- [ ] Duplicate detection
- [ ] Smart suggestions

---

## File Structure

```
receipt-ledger/
├── src/
│   ├── app.html
│   ├── app.css
│   ├── app.d.ts
│   ├── hooks.server.ts
│   ├── lib/
│   │   ├── index.ts
│   │   ├── typings/
│   │   │   ├── receipt.ts
│   │   │   ├── category.ts
│   │   │   ├── report.ts
│   │   │   └── settings.ts
│   │   ├── utils/
│   │   │   ├── fiscal.ts
│   │   │   ├── gst.ts
│   │   │   ├── format.ts
│   │   │   └── validation.ts
│   │   ├── stores/
│   │   │   ├── receipts.ts
│   │   │   ├── categories.ts
│   │   │   └── settings.ts
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── receipts/
│   │   │   ├── reports/
│   │   │   ├── common/
│   │   │   └── dashboard/
│   │   └── server/
│   │       ├── db/
│   │       │   ├── index.ts
│   │       │   └── schema.ts
│   │       └── storage/
│   │           └── r2.ts
│   └── routes/
│       ├── +layout.svelte
│       ├── +layout.server.ts
│       ├── +page.svelte              # Dashboard
│       ├── receipts/
│       │   ├── +page.svelte          # List
│       │   ├── +page.server.ts
│       │   ├── new/
│       │   │   └── +page.svelte      # Create
│       │   └── [id]/
│       │       ├── +page.svelte      # Detail
│       │       ├── +page.server.ts
│       │       └── edit/
│       │           └── +page.svelte  # Edit
│       ├── reports/
│       │   ├── +page.svelte          # Report home
│       │   ├── [year]/
│       │   │   ├── +page.svelte      # Yearly
│       │   │   └── +page.server.ts
│       │   └── export/
│       │       └── +page.svelte
│       ├── settings/
│       │   ├── +page.svelte
│       │   ├── categories/
│       │   │   └── +page.svelte
│       │   └── business/
│       │       └── +page.svelte
│       └── api/
│           ├── receipts/
│           │   ├── +server.ts
│           │   └── [id]/
│           │       └── +server.ts
│           ├── reports/
│           │   └── [year]/
│           │       └── +server.ts
│           ├── categories/
│           │   └── +server.ts
│           ├── settings/
│           │   └── +server.ts
│           └── storage/
│               ├── upload/
│               │   └── +server.ts
│               ├── list/
│               │   └── +server.ts
│               └── file/
│                   └── [...key]/
│                       └── +server.ts
├── migrations/
├── tests/
├── static/
├── drizzle.config.ts
├── svelte.config.js
├── tailwind.config.js
├── vite.config.ts
├── wrangler.toml
└── package.json
```

---

## Deployment

### Development
```bash
pnpm dev:cf          # Local with D1/R2 emulation
pnpm dev:cf:remote   # Local with real Cloudflare
```

### Production
```bash
pnpm build
pnpm wrangler deploy
```

### Database Migrations
```bash
# Generate migration
pnpm drizzle-kit generate:sqlite

# Apply to local
pnpm wrangler d1 execute accounting-db --file migrations/XXXX.sql

# Apply to production
pnpm wrangler d1 execute accounting-db --remote --file migrations/XXXX.sql
```

---

## Environment Variables

```toml
# wrangler.toml
[vars]
# AI (future)
AZURE_OPENAI_ENDPOINT = ""
AZURE_OPENAI_KEY = ""
AZURE_OPENAI_DEPLOYMENT = ""

# App Config
APP_ENV = "development"
```

---

## Security Considerations

1. **Authentication** (Future)
   - Add Cloudflare Access or custom auth
   - Protect all API routes
   - Session management

2. **Data Validation**
   - Zod schemas on all inputs
   - Sanitize file uploads
   - Rate limiting on APIs

3. **File Security**
   - Validate file types (images only)
   - Size limits on uploads
   - Signed URLs for private files

---

## Performance Optimizations

1. **Database**
   - Generated columns for common queries
   - Indexes on date, category, fiscal_year
   - Pagination on list endpoints

2. **Storage**
   - Image compression before upload
   - Thumbnail generation
   - CDN caching via R2

3. **Frontend**
   - Lazy loading for images
   - Virtual scrolling for large lists
   - Report caching

---

## Testing Strategy

```bash
# Infrastructure tests
pnpm test:direct     # Test real Cloudflare D1/R2

# Unit tests (future)
pnpm test:unit       # Component/utility tests

# E2E tests (future)
pnpm test:e2e        # Playwright tests
```
