-- Migration: Add archived column to receipts table
-- This is a generated column extracted from receipt_data JSON

-- SQLite doesn't support adding generated columns directly with ALTER TABLE
-- So we need to recreate the table or use a workaround

-- For D1, the column will be automatically available via JSON extraction
-- The schema.ts already defines it as a generated column

-- No DDL changes needed - the generated column is computed at query time
-- from json_extract(receipt_data, '$.archived')

-- This migration is just for documentation purposes
-- The archived field is stored in receipt_data JSON and filtered in queries
