-- Create read-only role for LLM query execution
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cognitwin_readonly') THEN
        CREATE ROLE cognitwin_readonly WITH LOGIN PASSWORD 'readonly';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE cognitwin TO cognitwin_readonly;
GRANT USAGE ON SCHEMA public TO cognitwin_readonly;

-- GRANT SELECT on tables is applied by Alembic revision
-- a13aa534bec5_grant_select_readonly_role, which runs after the schema is
-- created and also sets ALTER DEFAULT PRIVILEGES for future tables.
