-- Migration: Update receipts table to add missing generated columns
-- SQLite doesn't support ALTER TABLE ADD COLUMN for generated columns
-- So we need to recreate the table with all columns

-- Step 1: Create new table with full schema
CREATE TABLE IF NOT EXISTS receipts_new (
    id TEXT PRIMARY KEY NOT NULL,
    receipt_data TEXT NOT NULL,
    vendor TEXT GENERATED ALWAYS AS (json_extract(receipt_data, '$.vendor')) VIRTUAL,
    amount REAL GENERATED ALWAYS AS (json_extract(receipt_data, '$.amount')) VIRTUAL,
    date TEXT GENERATED ALWAYS AS (json_extract(receipt_data, '$.date')) VIRTUAL,
    category TEXT GENERATED ALWAYS AS (json_extract(receipt_data, '$.category')) VIRTUAL,
    fiscal_year INTEGER GENERATED ALWAYS AS (json_extract(receipt_data, '$.fiscalYear')) VIRTUAL,
    status TEXT GENERATED ALWAYS AS (json_extract(receipt_data, '$.status')) VIRTUAL,
    tax_deductible INTEGER GENERATED ALWAYS AS (json_extract(receipt_data, '$.taxDeductible')) VIRTUAL,
    archived INTEGER GENERATED ALWAYS AS (COALESCE(json_extract(receipt_data, '$.archived'), 0)) VIRTUAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from old table to new table
INSERT INTO receipts_new (id, receipt_data, created_at, updated_at)
SELECT id, receipt_data, created_at, updated_at FROM receipts;

-- Step 3: Drop old table
DROP TABLE receipts;

-- Step 4: Rename new table to original name
ALTER TABLE receipts_new RENAME TO receipts;

-- Step 5: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_fiscal_year ON receipts(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_archived ON receipts(archived);
