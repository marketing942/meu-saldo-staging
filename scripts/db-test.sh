#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Testes do banco sem precisar do `supabase start` completo.
#
# Sobe um container descartável com a mesma imagem Postgres do Supabase,
# aplica todas as migrations e roda os testes pgTAP de supabase/tests.
#
# Requisitos: docker, psql e pg_prove
#   (Ubuntu: postgresql-client e libtap-parser-sourcehandler-pgtap-perl).
# Uso: npm run test:db
#      SUPABASE_PG_IMAGE=supabase/postgres:15.8.1.085 npm run test:db
#
# Alternativa com o Supabase CLI completo:  supabase start && supabase test db
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/banco-descartavel.sh

CONTAINER="${DB_TEST_CONTAINER:-financas-db-test}"
trap 'banco_remover "$CONTAINER"' EXIT

banco_subir "$CONTAINER" "${DB_TEST_PORT:-54399}"
banco_aplicar_migrations

echo "==> Rodando testes pgTAP"
psql -XqAtc 'create extension if not exists pgtap with schema extensions' >/dev/null
pg_prove --ext .sql --verbose supabase/tests/
