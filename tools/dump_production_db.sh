docker run --rm -v "$PWD:/backup" postgres:18-alpine   pg_dump "postgresql://neondb_owner:<pwd>@ep-damp-moon-b93bslyq.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"   --no-owner --no-acl -f /backup/neon.sql


docker compose stop backend                         # libera le connessioni al db
docker compose exec db dropdb -U canoa canoa
docker compose exec db createdb -U canoa canoa
docker compose exec -T db psql -U canoa -d canoa < neon.sql
docker compose start backend