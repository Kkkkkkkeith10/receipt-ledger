-- Add one test item to each table

-- 1. Receipts table
INSERT INTO receipts (id, receipt_data, created_at, updated_at) 
VALUES (
  'TEST-RECEIPT-001', 
  '{"id":"TEST-RECEIPT-001","vendor":"Office Supplies Co","amount":149.99,"date":"2026-01-06","category":"Office","status":"approved","taxDeductible":true}', 
  datetime('now'), 
  datetime('now')
);

-- 2. Transactions table
INSERT INTO transactions (id, transaction_data, created_at, updated_at) 
VALUES (
  'TEST-TXN-001', 
  '{"id":"TEST-TXN-001","date":"2026-01-06","description":"Monthly office supplies purchase","total_amount":149.99,"status":"completed","receipt_ids":["TEST-RECEIPT-001"]}', 
  datetime('now'), 
  datetime('now')
);

-- 3. Users table
INSERT INTO users (id, username, hashed_password, created_at) 
VALUES (
  'TEST-USER-001', 
  'testuser', 
  '$2b$10$dummyhashedpasswordfortesting123456789', 
  datetime('now')
);

-- 4. Sessions table
INSERT INTO sessions (id, user_id, expires_at) 
VALUES (
  'TEST-SESSION-001', 
  'TEST-USER-001', 
  strftime('%s', 'now', '+7 days')
);

-- 5. App Settings table
INSERT INTO app_settings (key, value, updated_at) 
VALUES (
  'test_setting', 
  '{"enabled":true,"description":"Test configuration setting"}', 
  datetime('now')
);
