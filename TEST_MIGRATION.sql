-- Simple test migration to verify permissions
-- Run this FIRST to test if table creation works

-- Test 1: Create a simple table
CREATE TABLE IF NOT EXISTS test_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test 2: Insert a row
INSERT INTO test_table (name) VALUES ('Test Entry');

-- Test 3: Select the data
SELECT * FROM test_table;

-- Test 4: Drop the test table
DROP TABLE test_table;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Basic table operations work! You can proceed with full migration.';
END $$;
