// Additional TypeScript types for the application

// Receipt status workflow
export type ReceiptStatus = 'draft' | 'pending' | 'approved' | 'rejected';

// Payment methods
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other';

// Supported currencies
export type Currency = 'HKD' | 'JPY' | 'TWD' | 'USD' | 'CNY' | 'EUR' | 'GBP';

/**
 * Receipt - main data structure for expense receipts
 */
export interface Receipt {
  id: string;
  vendor: string;
  amount: number; // GST-inclusive amount
  currency?: Currency; // Currency code (default: HKD)
  gstAmount?: number;
  netAmount?: number;
  gstFree?: boolean;
  date: string; // ISO date string
  fiscalYear: number;
  category: string;
  subcategory?: string;
  categoryName?: string;
  status: ReceiptStatus;
  taxDeductible: boolean;
  paymentMethod?: PaymentMethod;
  receiptImageUrl?: string | null;
  receiptImageKey?: string; // R2 object key
  thumbnailUrl?: string | null;
  notes?: string;
  tags?: string[];
  auditInfo?: {
    businessPurpose?: string;
    projectCode?: string;
    location?: string;
    attendees?: string;
    businessMeal?: boolean;
    travelRelated?: boolean;
  };
  ocrData?: {
    extractedAt?: string;
    confidence?: number;
    rawText?: string;
    brNumber?: string; // Business Registration Number (Hong Kong)
    currency?: Currency; // Currency detected by AI
  };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * Receipt form data for create/edit
 */
export interface ReceiptFormData {
  vendor: string;
  amount: number;
  currency?: Currency;
  gstFree?: boolean;
  date: string;
  category: string;
  subcategory?: string;
  paymentMethod?: PaymentMethod;
  taxDeductible?: boolean;
  notes?: string;
  tags?: string[];
  auditInfo?: {
    businessPurpose?: string;
    projectCode?: string;
    location?: string;
    attendees?: string;
    businessMeal?: boolean;
    travelRelated?: boolean;
  };
}

/**
 * Filter parameters for receipt list
 */
export interface FilterParams {
  query?: string;
  category?: string;
  status?: ReceiptStatus | '';
  dateFrom?: string;
  dateTo?: string;
  fiscalYear?: number;
  taxDeductible?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Expense summary by category
 */
export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalAmount: number;
  gstAmount: number;
  netAmount: number;
  receiptCount: number;
  percentOfTotal: number;
}

/**
 * Monthly expense summary
 */
export interface MonthlySummary {
  month: number; // 1-12
  monthName: string;
  fiscalMonth: number; // 1-12 (July = 1)
  totalAmount: number;
  gstAmount: number;
  receiptCount: number;
}

/**
 * Quarterly expense summary (for BAS)
 */
export interface QuarterlySummary {
  quarter: number; // 1-4
  quarterName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  gstAmount: number;
  netAmount: number;
  receiptCount: number;
}

/**
 * Annual expense report
 */
export interface ExpenseReport {
  fiscalYear: number;
  fiscalYearDisplay: string;
  startDate: string;
  endDate: string;
  totalExpenses: number;
  totalGst: number;
  totalNetExpenses: number;
  receiptCount: number;
  categoryBreakdown: CategorySummary[];
  monthlyBreakdown: MonthlySummary[];
  quarterlyBreakdown: QuarterlySummary[];
  taxDeductibleTotal: number;
  nonDeductibleTotal: number;
  topVendors: { vendor: string; total: number; count: number }[];
  generatedAt: string;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  currentFiscalYear: number;
  ytdExpenses: number;
  ytdGst: number;
  thisMonth: {
    total: number;
    count: number;
    change: number; // percentage vs last month
  };
  pendingApproval: number;
  recentReceipts: Receipt[];
  categoryTotals: CategorySummary[];
  monthlyTrend: MonthlySummary[];
}

/**
 * App settings
 */
export interface AppSettings {
  businessName?: string;
  brNumber?: string; // Business Registration Number (Hong Kong)
  gstRegistered?: boolean;
  defaultFiscalYearStart?: number;
  currency?: string;
  dateFormat?: string;
  defaultCategory?: string;
  autoApproveBelow?: number;
}