-- Tenant isolation enforced by the database, not just by application code.
--
-- The NestJS app connects as `snapshot_app`: a NOLOGIN-by-default, non-owner,
-- non-superuser role (created by docker/postgres/init-app-role.sh). Migrations
-- and the seed run as the owner. Every request runs inside a transaction that
-- does `SELECT set_config('app.broker_id', <broker from verified JWT>, true)`.
--
-- If application code forgets `WHERE broker_id = ?`, these policies still
-- filter the rows. If the setting is missing entirely, current_setting(..., true)
-- returns NULL, `broker_id = NULL` is never true, and the query returns nothing:
-- the failure mode is "empty", never "everyone's data".

-- FORCE makes policies apply to the table owner too (defence against someone
-- later pointing the app at the owner role). Superusers still bypass RLS, which
-- is why the app must never run as one.
ALTER TABLE "brokers"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brokers"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "traders"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "traders"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "fills"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fills"    FORCE  ROW LEVEL SECURITY;

-- The owner (migrations, seed) needs to see everything; the app role does not.
CREATE POLICY owner_all ON "brokers"  TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY owner_all ON "traders"  TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY owner_all ON "accounts" TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY owner_all ON "fills"    TO CURRENT_USER USING (true) WITH CHECK (true);

CREATE POLICY tenant_isolation ON "brokers" TO snapshot_app
  USING ("id" = current_setting('app.broker_id', true));
CREATE POLICY tenant_isolation ON "traders" TO snapshot_app
  USING ("broker_id" = current_setting('app.broker_id', true));
CREATE POLICY tenant_isolation ON "accounts" TO snapshot_app
  USING ("broker_id" = current_setting('app.broker_id', true));
-- WITH CHECK also stops the app from INSERTing a fill into another tenant.
CREATE POLICY tenant_isolation ON "fills" TO snapshot_app
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));

-- Least privilege: the app reads, and may only INSERT fills. No UPDATE/DELETE anywhere.
GRANT USAGE ON SCHEMA public TO snapshot_app;
GRANT SELECT ON "brokers", "traders", "accounts", "fills", "instruments", "market_prices" TO snapshot_app;
GRANT INSERT ON "fills" TO snapshot_app;
GRANT USAGE ON SEQUENCE "fills_seq_seq" TO snapshot_app;

-- Login has to find a trader *before* a tenant is known. Rather than giving the
-- app a cross-tenant read on traders, expose exactly the three columns login
-- needs through a SECURITY DEFINER function (runs as owner, bypasses RLS).
CREATE FUNCTION auth_find_trader(p_email text)
RETURNS TABLE (trader_id text, broker_id text, password_hash text, kyc_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.broker_id, t.password_hash, t.kyc_status
  FROM traders t WHERE lower(t.email) = lower(p_email)
$$;
REVOKE ALL ON FUNCTION auth_find_trader(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_trader(text) TO snapshot_app;

-- The dev-only fill simulator receives a bare account id and has to discover
-- which tenant it belongs to. Same pattern: one narrow lookup, nothing else.
CREATE FUNCTION dev_account_tenant(p_account_id text)
RETURNS TABLE (broker_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.broker_id FROM accounts a WHERE a.id = p_account_id
$$;
REVOKE ALL ON FUNCTION dev_account_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dev_account_tenant(text) TO snapshot_app;
