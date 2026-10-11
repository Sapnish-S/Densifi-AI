-- Columns previously added at request time via ALTER TABLE in the frontend server
-- actions. Runtime DDL needs table ownership and an ACCESS EXCLUSIVE lock, which
-- failed (and crashed the dashboard render) for a non-owner app role.
ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE lab_report
  ADD COLUMN IF NOT EXISTS dht NUMERIC,
  ADD COLUMN IF NOT EXISTS "freeT" NUMERIC,
  ADD COLUMN IF NOT EXISTS ferritin NUMERIC;
