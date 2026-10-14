#!/bin/sh
# Runs once, on first start of the Postgres volume. Creates the role the
# NestJS app uses at runtime: it can log in, but it is not a superuser and does
# not own the tables, so Row-Level Security applies to it.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE snapshot_app LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO snapshot_app;
SQL
