#!/usr/bin/env bash
# CI-only proof that PostgreSQL can initialize from installer-owned private inputs.
set -euo pipefail
set +x
[[ ${CI:-} = true ]] || { echo 'PostgreSQL bootstrap acceptance requires isolated CI.' >&2; exit 64; }
: "${SWI_CONFIG_DIR:?}" "${SWI_PROJECT_NAME:?}"
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
name="$SWI_PROJECT_NAME-bootstrap-probe"
if docker container inspect "$name" >/dev/null 2>&1; then
  echo 'Refusing an existing PostgreSQL bootstrap probe container.' >&2
  exit 64
fi
work=$(mktemp -d)
cleanup() {
  status=$?
  [[ $status = 0 ]] || docker logs --tail 30 "$name" >&2 || true
  docker rm -fv "$name" >/dev/null 2>&1 || true
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
umask 077
mkdir "$work/bootstrap"
cp "$root/docker/vps/"{postgres-start.sh,init-database.sh,pg_hba.conf} "$work/bootstrap/"
chmod 600 "$work/bootstrap/pg_hba.conf"
chmod 700 "$work/bootstrap/init-database.sh"
docker run -d --name "$name" --network none --memory 256m --cpus 1 \
  --tmpfs /var/lib/postgresql/data \
  --volume "$work/bootstrap:/bootstrap:ro" \
  --volume "$SWI_CONFIG_DIR/tls/postgres:/run/server-tls:ro" \
  --env POSTGRES_USER=swi --env POSTGRES_DB=swi \
  --env POSTGRES_PASSWORD=disposable-bootstrap-only \
  --env POSTGRES_APP_PASSWORD=disposable-bootstrap-app-only \
  --entrypoint /bin/sh postgres:16-alpine /bootstrap/postgres-start.sh >/dev/null
for ((attempt = 0; attempt < 60; attempt++)); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U swi -d swi >/dev/null 2>&1; then break; fi
  sleep 0.5
done
docker exec --user postgres "$name" sh -ec '
test -r /var/lib/postgresql/bootstrap/pg_hba.conf
test -x /docker-entrypoint-initdb.d/10-app-role.sh
test "$(stat -c %a /var/lib/postgresql/tls/server.key)" = 600
test "$(stat -c %a /var/lib/postgresql/bootstrap/pg_hba.conf)" = 600
test "$(stat -c %a /docker-entrypoint-initdb.d/10-app-role.sh)" = 700
test "$(psql -U swi -d swi -Atqc "SHOW ssl")" = on
test "$(psql -U swi -d swi -Atqc "SELECT rolname FROM pg_roles WHERE rolname = '\''swi_app'\''")" = swi_app
'
printf 'Private-mode PostgreSQL bootstrap and runtime role passed.\n'
