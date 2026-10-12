import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================
// Auth tables (Auth.js compatible)
// ============================================

// Users table for authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  hashedPassword: text("hashed_password"),
  emailVerified: text("email_verified"),
  image: text("image"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Auth accounts (for OAuth providers - kept for future extensibility)
export const authAccounts = sqliteTable("auth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

// Auth sessions (JWT strategy doesn't need this, but kept for database sessions)
export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: text("expires").notNull(),
});

// Verification tokens for email verification
export const authVerificationTokens = sqliteTable("auth_verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: text("expires").notNull(),
});

// ============================================
// Application tables
// ============================================

// Receipts table with JSON storage for flexible data
export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  receiptData: text("receipt_data", { mode: "json" }).notNull(),

  // Generated columns for performance (extracted from JSON)
  vendor: text("vendor").generatedAlwaysAs(sql`json_extract(receipt_data, '$.vendor')`),
  amount: real("amount").generatedAlwaysAs(sql`json_extract(receipt_data, '$.amount')`),
  date: text("date").generatedAlwaysAs(sql`json_extract(receipt_data, '$.date')`),
  category: text("category").generatedAlwaysAs(sql`json_extract(receipt_data, '$.category')`),
  fiscalYear: integer("fiscal_year").generatedAlwaysAs(sql`json_extract(receipt_data, '$.fiscalYear')`),
  status: text("status").generatedAlwaysAs(sql`json_extract(receipt_data, '$.status')`),
  taxDeductible: integer("tax_deductible", { mode: "boolean" })
    .generatedAlwaysAs(sql`json_extract(receipt_data, '$.taxDeductible')`),
  archived: integer("archived", { mode: "boolean" })
    .generatedAlwaysAs(sql`COALESCE(json_extract(receipt_data, '$.archived'), 0)`),

  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Transactions table for double-entry bookkeeping
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  transactionData: text("transaction_data", { mode: "json" }).notNull(),

  // Generated columns for reporting
  date: text("date").generatedAlwaysAs(sql`json_extract(transaction_data, '$.date')`),
  totalAmount: real("total_amount").generatedAlwaysAs(sql`json_extract(transaction_data, '$.total_amount')`),
  status: text("status").generatedAlwaysAs(sql`json_extract(transaction_data, '$.status')`),

  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Expense reports cache (generated annually)
export const expenseReports = sqliteTable("expense_reports", {
  id: text("id").primaryKey(), // e.g., "FY2024"
  fiscalYear: integer("fiscal_year").notNull().unique(),
  reportData: text("report_data", { mode: "json" }).notNull(),
  generatedAt: text("generated_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Settings and configuration
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// Type exports
// ============================================

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type ExpenseReport = typeof expenseReports.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthAccount = typeof authAccounts.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;