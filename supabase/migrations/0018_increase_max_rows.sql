-- Increase PostgREST max-rows from default 1000 to 100,000
-- so the client can request up to 5000 rows per page without server-side capping.
ALTER ROLE authenticator SET pgrst.db_max_rows = 100000;
