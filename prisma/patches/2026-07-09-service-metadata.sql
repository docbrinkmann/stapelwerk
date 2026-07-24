-- Service-metadata long-tail curation (2026-07-09).
-- Idempotent UPDATEs for existing rows — the seed is destructive elsewhere
-- (deleteMany), so live catalogs are patched with this file instead:
--   ssh <host> 'docker exec -i stapelwerk_postgres \
--     psql -U stapelwerk_user -d stapelwerk' < prisma/patches/2026-07-09-service-metadata.sql
-- Values mirror prisma/seed.ts exactly (same JSON shapes).

-- ClickHouse: official image supports first-start DB/user/password env.
UPDATE services SET
  "environmentVariables" = '[{"name":"CLICKHOUSE_DB","description":"Database created on first start","required":false,"secret":false,"default":"default"},{"name":"CLICKHOUSE_USER","description":"Initial user","required":false,"secret":false,"default":"default"},{"name":"CLICKHOUSE_PASSWORD","description":"Password for the initial user","required":true,"secret":true}]',
  "updatedAt" = NOW()
WHERE slug = 'clickhouse';

-- Kong: without KONG_DATABASE=off the image expects Postgres and won't start.
UPDATE services SET
  "environmentVariables" = '[{"name":"KONG_DATABASE","description":"Datastore: ''off'' = DB-less (declarative config)","required":false,"secret":false,"default":"off"},{"name":"KONG_DECLARATIVE_CONFIG","description":"Path to kong.yml when running DB-less","required":false,"secret":false,"default":""}]',
  "updatedAt" = NOW()
WHERE slug = 'kong';

-- Keycloak: dev-mode H2/realm data must live on a volume.
UPDATE services SET
  volumes = '[{"containerPath":"/opt/keycloak/data","description":"Realm/H2 data (dev mode) — without it everything is lost on restart","named":true}]',
  "updatedAt" = NOW()
WHERE slug = 'keycloak';

-- Realistic resource floors for the monitoring quartet (0.25/256 was the
-- catch-all default; these are known to need more headroom).
UPDATE services SET
  "resourceRequirements" = '{"cpu":0.5,"memory":512}',
  "updatedAt" = NOW()
WHERE slug IN ('prometheus', 'grafana', 'loki', 'tempo');
