-- PostgreSQL initialization script for development environment
-- This script runs when the PostgreSQL container is first created

-- Create additional databases if needed
-- The main database 'build_my_stack_dev' is already created by environment variables

-- Create a test database for running tests in Docker
CREATE DATABASE build_my_stack_test;

-- Grant permissions to postgres user (default user)
GRANT ALL PRIVILEGES ON DATABASE build_my_stack_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE build_my_stack_test TO postgres;

-- Set default transaction isolation level for better performance in development
ALTER DATABASE build_my_stack_dev SET default_transaction_isolation TO 'read committed';
ALTER DATABASE build_my_stack_test SET default_transaction_isolation TO 'read committed';

-- Enable extensions that might be useful for development
\c build_my_stack_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

\c build_my_stack_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Log completion
\echo 'Database initialization completed successfully.';