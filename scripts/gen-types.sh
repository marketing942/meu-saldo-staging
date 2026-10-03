#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Gera src/types/database.ts com `supabase gen types` a partir das migrations.
#
#   npm run gen:types              banco descartável com as migrations do repo
#   npm run gen:types -- --check   falha se o arquivo commitado estiver desatualizado (CI)
#
# Para gerar a partir de um projeto remoto já migrado:
#   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/banco-descartavel.sh

DESTINO=src/types/database.ts
CONTAINER="${GEN_TYPES_CONTAINER:-financas-gen-types}"
trap 'banco_remover "$CONTAINER"' EXIT

banco_subir "$CONTAINER" "${GEN_TYPES_PORT:-54397}"
banco_aplicar_migrations

echo "==> Gerando tipos"
TEMP="$(mktemp)"
{
  echo '// Arquivo gerado por `npm run gen:types` (supabase gen types). Não edite à mão.'
  npx --no-install supabase gen types typescript --db-url "$BANCO_URL" --schema public
} >"$TEMP"
npx --no-install prettier --stdin-filepath "$DESTINO" <"$TEMP" >"$TEMP.fmt"

if [ "${1:-}" = "--check" ]; then
  if ! diff -u "$DESTINO" "$TEMP.fmt"; then
    echo "src/types/database.ts está desatualizado. Rode: npm run gen:types" >&2
    exit 1
  fi
  echo "Tipos em dia com as migrations."
else
  mkdir -p "$(dirname "$DESTINO")"
  mv "$TEMP.fmt" "$DESTINO"
  echo "Tipos gerados em $DESTINO"
fi
rm -f "$TEMP" "$TEMP.fmt"
