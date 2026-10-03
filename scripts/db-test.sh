#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Testes do banco sem precisar do `supabase start` completo.
#
# Sobe um container descartável com a mesma imagem Postgres do Supabase,
# aplica todas as migrations de supabase/migrations (como o `supabase db push`
# faria) e roda os testes pgTAP de supabase/tests com pg_prove.
#
# Requisitos: docker, psql e pg_prove (pacote postgresql-client + libtap-parser-sourcehandler-pgtap-perl).
# Uso: scripts/db-test.sh            (ou: npm run test:db, a partir da fase 2)
#
# Alternativa com o Supabase CLI completo:  supabase start && supabase test db
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE="${SUPABASE_PG_IMAGE:-supabase/postgres:17.11.0.002}"
CONTAINER="${DB_TEST_CONTAINER:-financas-db-test}"
PORT="${DB_TEST_PORT:-54399}"

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres

limpar() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap limpar EXIT
limpar

echo "==> Subindo $IMAGE"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null

# A imagem reinicia o Postgres uma vez durante a inicialização: espera ficar estável.
for _ in $(seq 1 90); do
  if psql -XqAtc "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then
    sleep 2
    psql -XqAtc 'select 1' >/dev/null 2>&1 && break
  fi
  sleep 1
done
psql -XqAtc 'select version()'

echo "==> Aplicando migrations"
for arquivo in supabase/migrations/*.sql; do
  echo "    $arquivo"
  psql -X -q -v ON_ERROR_STOP=1 -f "$arquivo" >/dev/null
done

echo "==> Rodando testes pgTAP"
psql -XqAtc 'create extension if not exists pgtap with schema extensions' >/dev/null
pg_prove --ext .sql --verbose supabase/tests/
