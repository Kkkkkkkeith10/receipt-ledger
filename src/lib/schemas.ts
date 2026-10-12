import { z } from 'zod';

// Receipt schema matching the requirements
export const receiptDataSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date string
  vendor: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('HKD'),

  // Tax & Accounting Classification
  category: z.string(),
  categoryName: z.string(),
  taxDeductible: z.boolean(),
  taxAmount: z.number().optional(),
  gstAmount: z.number().optional(), // Not applicable for HK - no GST/VAT
  gstIncluded: z.boolean().optional(), // Not applicable for HK

  // Payment Information
  paymentMethod: z.enum(['cash', 'company_card', 'bank_transfer', 'check']),
  cardLastFour: z.string().optional(),
  authorizationCode: z.string().optional(),

  // Audit Trail (Required for Tax Compliance)
  auditInfo: z.object({
    businessPurpose: z.string().min(10, 'Business purpose must be at least 10 characters'),
    projectCode: z.string().optional(),
    attendees: z.string().optional(),
    location: z.string().optional(),
    businessMeal: z.boolean().default(false),
    travelRelated: z.boolean().default(false),
  }),

  // Supporting Documentation
  receiptImageUrl: z.string().optional(),
  receiptThumbnailUrl: z.string().optional(),
  receiptNumber: z.string().optional(),

  // OCR and AI Processing
  ocrData: z.object({
    processedAt: z.string().optional(),
    confidenceScore: z.number().optional(),
    extractionMethod: z.string().optional(),
    manualReviewRequired: z.boolean().default(false),
    extractedText: z.string().optional(),
    aiSuggestions: z.object({
      category: z.string().optional(),
      vendorNormalized: z.string().optional(),
      confidence: z.number().optional(),
    }).optional(),
  }).optional(),

  // Workflow and Status
  status: z.enum(['draft', 'approved', 'rejected']).default('draft'),
  approvalDate: z.string().optional(),
  approvedBy: z.string().optional(),
  linkedTransaction: z.string().optional(),

  // Additional fields
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  recurring: z.boolean().default(false),
  reimbursable: z.boolean().default(false),

  // System metadata
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().default(1),
});

// Transaction schema for double-entry bookkeeping
export const transactionDataSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date string
  reference: z.string(),
  description: z.string(),
  totalAmount: z.number().positive(),
  currency: z.string().default('HKD'),

  // Double-entry journal entries (must balance)
  entries: z.array(z.object({
    id: z.string(),
    accountCode: z.string(),
    accountName: z.string(),
    accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    debitAmount: z.number().min(0),
    creditAmount: z.number().min(0),
    description: z.string(),
    lineMemo: z.string().optional(),
  })).min(2, 'Transaction must have at least 2 entries'),

  // Supporting documents
  supportingDocuments: z.array(z.string()).default([]),
  receiptIds: z.array(z.string()).default([]),

  // Status and workflow
  status: z.enum(['draft', 'posted', 'reconciled']).default('draft'),
  batchId: z.string().optional(),
  postedDate: z.string().optional(),
  reconciled: z.boolean().default(false),
  reconciledDate: z.string().optional(),

  // Classification
  transactionType: z.enum(['expense', 'revenue', 'transfer', 'adjustment']),
  tags: z.array(z.string()).default([]),
  department: z.string().optional(),
  projectCode: z.string().optional(),
  costCenter: z.string().optional(),

  // System metadata
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().default(1),
});

// Chart of Accounts structure
export const chartOfAccountsSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent: z.string().optional(),
  taxDeductible: z.boolean().default(false),
  deductionPercentage: z.number().min(0).max(100).default(100),
  active: z.boolean().default(true),
  description: z.string().optional(),
});

// File upload schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(10 * 1024 * 1024), // 10MB default
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'application/pdf']),
});

export type ReceiptData = z.infer<typeof receiptDataSchema>;
export type TransactionData = z.infer<typeof transactionDataSchema>;
export type ChartOfAccount = z.infer<typeof chartOfAccountsSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;