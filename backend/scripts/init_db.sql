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

-- The GRANT SELECT on tables happens AFTER Alembic creates them.
-- This is handled by a post-migration step in the Alembic env.py.
