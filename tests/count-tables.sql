SELECT 'receipts' as tbl, COUNT(*) as cnt FROM receipts 
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions 
UNION ALL SELECT 'users', COUNT(*) FROM users 
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions 
UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings;
