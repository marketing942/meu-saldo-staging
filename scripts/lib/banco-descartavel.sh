# shellcheck shell=bash
# -----------------------------------------------------------------------------
# Funções compartilhadas: sobe um Postgres do Supabase descartável (Docker) e
# aplica as migrations de supabase/migrations, como o `supabase db push` faria.
# Usado por scripts/db-test.sh e scripts/gen-types.sh.
# -----------------------------------------------------------------------------

IMAGE="${SUPABASE_PG_IMAGE:-supabase/postgres:17.11.0.002}"

banco_subir() {
  local container="$1" porta="$2"

  export PGHOST=127.0.0.1 PGPORT="$porta" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
  export BANCO_URL="postgresql://postgres:postgres@127.0.0.1:${porta}/postgres?sslmode=disable"

  docker rm -f "$container" >/dev/null 2>&1 || true
  echo "==> Subindo $IMAGE"
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres -p "$porta:5432" "$IMAGE" >/dev/null

  # A imagem reinicia o Postgres uma vez durante a inicialização: espera ficar estável.
  local pronto=0
  for _ in $(seq 1 90); do
    if psql -XqAtc "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then
      sleep 2
      if psql -XqAtc 'select 1' >/dev/null 2>&1; then
        pronto=1
        break
      fi
    fi
    sleep 1
  done
  if [ "$pronto" -ne 1 ]; then
    echo "O banco não ficou pronto a tempo." >&2
    docker logs "$container" | tail -20 >&2
    return 1
  fi
  psql -XqAtc 'select version()'
}

banco_aplicar_migrations() {
  echo "==> Aplicando migrations"
  local arquivo
  for arquivo in supabase/migrations/*.sql; do
    echo "    $arquivo"
    psql -X -q -v ON_ERROR_STOP=1 -f "$arquivo" >/dev/null
  done
}

banco_remover() {
  docker rm -f "$1" >/dev/null 2>&1 || true
}
